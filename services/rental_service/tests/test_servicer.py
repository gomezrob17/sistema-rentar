from datetime import datetime, timedelta, timezone
from decimal import Decimal

import grpc
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, Reserva
from app.generated import rental_pb2 as pb
from app.servicer import RentalServicer


class Abortado(Exception):
    pass


class Contexto:
    """Imita el context de gRPC: abort corta la ejecución con el código y el mensaje."""

    def abort(self, codigo, mensaje):
        raise Abortado(codigo, mensaje)


ctx = Contexto()


@pytest.fixture
def svc():
    # ponytail: SQLite en memoria para probar las reglas sin levantar Postgres.
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return RentalServicer(sessionmaker(engine, expire_on_commit=False))


def iso(dias: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


def crear(svc, vehiculo_id=1, cliente_id=1, desde=3, hasta=5, precio="1500"):
    return svc.CrearReserva(
        pb.CrearReservaRequest(
            cliente_id=cliente_id,
            vehiculo_id=vehiculo_id,
            fecha_inicio=iso(desde),
            fecha_fin=iso(hasta),
            precio_diario=precio,
        ),
        ctx,
    )


def sembrar(svc, vehiculo_id=1, cliente_id=1, desde=3, hasta=5, estado="CONFIRMADA", precio="1500"):
    """Inserta una reserva con estado y fechas arbitrarias para probar consultas."""
    with svc.sesiones() as sesion:
        reserva = Reserva(
            cliente_id=cliente_id,
            vehiculo_id=vehiculo_id,
            fecha_inicio=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=desde),
            fecha_fin=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=hasta),
            precio_diario=Decimal(precio),
            importe_total=Decimal(precio),
            estado=estado,
        )
        sesion.add(reserva)
        sesion.commit()
        return reserva.id


def error(llamada):
    with pytest.raises(Abortado) as e:
        llamada()
    return e.value.args


def test_alta_calcula_dias_e_importe(svc):
    r = crear(svc, desde=3, hasta=6, precio="1500.5")
    assert (r.estado, r.importe_total) == (pb.CONFIRMADA, "4501.5")


def test_alta_de_un_dia_minimo(svc):
    r = crear(svc, desde=3, hasta=3.2, precio="100")
    assert r.importe_total == "100"


@pytest.mark.parametrize(
    "desde, hasta, mensaje",
    [
        (5, 3, "La fecha de fin debe ser posterior a la de inicio"),
        (-2, 1, "La fecha de inicio debe ser futura"),
    ],
)
def test_alta_valida_fechas(svc, desde, hasta, mensaje):
    assert error(lambda: crear(svc, desde=desde, hasta=hasta)) == (
        grpc.StatusCode.INVALID_ARGUMENT,
        mensaje,
    )


def test_alta_precio_invalido(svc):
    assert error(lambda: crear(svc, precio="0")) == (
        grpc.StatusCode.INVALID_ARGUMENT,
        "El precio diario debe ser mayor a 0",
    )


def test_alta_rechaza_solapamiento(svc):
    crear(svc, vehiculo_id=1, desde=3, hasta=6)
    assert error(lambda: crear(svc, vehiculo_id=1, desde=4, hasta=5)) == (
        grpc.StatusCode.FAILED_PRECONDITION,
        "El vehículo con id 1 no está disponible en el período solicitado",
    )
    # Otro vehículo en el mismo período sí se puede.
    assert crear(svc, vehiculo_id=2, desde=4, hasta=5).id > 0


def test_inexistente(svc):
    assert error(lambda: svc.BuscarReservaPorId(pb.ReservaId(id=99), ctx)) == (
        grpc.StatusCode.NOT_FOUND,
        "No se encontró la reserva con id 99",
    )


def test_cancelar_propia(svc):
    r = crear(svc)
    cancelada = svc.CancelarReserva(
        pb.CancelarReservaRequest(id=r.id, cliente_id=1), ctx
    )
    assert cancelada.estado == pb.CANCELADA


def test_cancelar_ajena_o_inexistente(svc):
    r = crear(svc, cliente_id=1)
    assert error(
        lambda: svc.CancelarReserva(pb.CancelarReservaRequest(id=r.id, cliente_id=2), ctx)
    ) == (grpc.StatusCode.NOT_FOUND, "No se encontró la reserva")
    assert error(
        lambda: svc.CancelarReserva(pb.CancelarReservaRequest(id=99, cliente_id=1), ctx)
    ) == (grpc.StatusCode.NOT_FOUND, "No se encontró la reserva")


def test_cancelar_no_confirmada(svc):
    r = sembrar(svc, estado="CANCELADA")
    assert error(
        lambda: svc.CancelarReserva(pb.CancelarReservaRequest(id=r, cliente_id=1), ctx)
    ) == (grpc.StatusCode.ABORTED, "Solo se pueden cancelar reservas confirmadas")


def test_cancelar_alquiler_iniciado(svc):
    r = sembrar(svc, desde=-1, hasta=2)
    assert error(
        lambda: svc.CancelarReserva(pb.CancelarReservaRequest(id=r, cliente_id=1), ctx)
    ) == (grpc.StatusCode.FAILED_PRECONDITION, "El período de alquiler ya comenzó")


def test_listar_filtra_por_cliente_y_estado_efectivo(svc):
    mia = sembrar(svc, cliente_id=1, desde=1, hasta=2)
    sembrar(svc, cliente_id=2, desde=1, hasta=2)
    vencida = sembrar(svc, cliente_id=1, desde=-10, hasta=-8)
    cancelada = sembrar(svc, cliente_id=1, desde=20, hasta=21, estado="CANCELADA")

    por_cliente = svc.ListarReservas(pb.FiltroReservas(cliente_id=1), ctx).reservas
    assert [r.id for r in por_cliente] == [cancelada, mia, vencida]

    finalizadas = svc.ListarReservas(pb.FiltroReservas(estado=pb.FINALIZADA), ctx).reservas
    assert [r.id for r in finalizadas] == [vencida]
    assert finalizadas[0].estado == pb.FINALIZADA


def test_historial_incluye_vencidas_canceladas_y_excluye_vigentes(svc):
    vencida = sembrar(svc, desde=-10, hasta=-8)
    cancelada = sembrar(svc, desde=20, hasta=21, estado="CANCELADA")
    finalizada = sembrar(svc, desde=-30, hasta=-28, estado="FINALIZADA")
    vigente = sembrar(svc, desde=-1, hasta=2)
    futura = sembrar(svc, desde=10, hasta=12)
    ajena = sembrar(svc, cliente_id=2, desde=-10, hasta=-8)

    ids = [r.id for r in svc.HistorialCliente(pb.ClienteId(cliente_id=1), ctx).reservas]
    assert set(ids) == {vencida, finalizada, cancelada}
    for excluida in [vigente, futura, ajena]:
        assert excluida not in ids


def test_vehiculos_ocupados_distintos_y_solapados(svc):
    sembrar(svc, vehiculo_id=1, desde=1, hasta=4)
    sembrar(svc, vehiculo_id=1, desde=1, hasta=4, estado="CANCELADA")
    sembrar(svc, vehiculo_id=2, desde=3, hasta=6)
    sembrar(svc, vehiculo_id=3, desde=30, hasta=41)

    ocupados = svc.VehiculosOcupados(
        pb.Periodo(fecha_inicio=iso(2), fecha_fin=iso(5)), ctx
    )
    assert set(ocupados.ids) == {1, 2}
