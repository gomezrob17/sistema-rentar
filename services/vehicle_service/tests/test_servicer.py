from datetime import datetime, timedelta, timezone

import grpc
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.generated import vehicle_pb2 as pb
from app.servicer import VehicleServicer


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
    return VehicleServicer(sessionmaker(engine, expire_on_commit=False))


def crear(svc, patente="AB123CD", **cambios):
    datos = dict(
        patente=patente,
        marca="Toyota",
        modelo="Corolla",
        anio=2022,
        tipo="SEDAN",
        precio_diario="15000.5",
    )
    return svc.CrearVehiculo(pb.CrearVehiculoRequest(**(datos | cambios)), ctx)


def error(llamada):
    with pytest.raises(Abortado) as e:
        llamada()
    return e.value.args


def periodo(desde_dias=1, dias=2, **filtros):
    inicio = datetime.now(timezone.utc) + timedelta(days=desde_dias)
    fin = inicio + timedelta(days=dias)
    return pb.FiltroDisponibilidad(
        fecha_inicio=inicio.isoformat(), fecha_fin=fin.isoformat(), **filtros
    )


def test_alta_queda_disponible_y_activo(svc):
    v = crear(svc)
    assert (v.estado, v.activo, v.precio_diario) == (pb.DISPONIBLE, True, "15000.5")
    assert not v.HasField("color")


def test_patente_repetida(svc):
    crear(svc)
    assert error(lambda: crear(svc)) == (
        grpc.StatusCode.ALREADY_EXISTS,
        "Ya existe un vehículo con la patente AB123CD",
    )


@pytest.mark.parametrize(
    "cambios, mensaje",
    [
        ({"precio_diario": "0"}, "El precio diario debe ser un número mayor a 0"),
        ({"precio_diario": "abc"}, "El precio diario debe ser un número mayor a 0"),
        ({"anio": 1800}, "El año debe ser 1900 o posterior"),
        ({"marca": " "}, "La marca es obligatoria"),
        ({"tipo": "TIPO_VEHICULO_SIN_ESPECIFICAR"}, "El tipo de vehículo no es válido"),
    ],
)
def test_validaciones_del_alta(svc, cambios, mensaje):
    assert error(lambda: crear(svc, **cambios)) == (grpc.StatusCode.INVALID_ARGUMENT, mensaje)


def test_edicion_parcial(svc):
    v = crear(svc, color="Gris")
    editado = svc.ActualizarVehiculo(pb.ActualizarVehiculoRequest(id=v.id, precio_diario="20000"), ctx)
    assert (editado.precio_diario, editado.color, editado.patente) == ("20000", "Gris", "AB123CD")


def test_inexistente(svc):
    assert error(lambda: svc.BuscarVehiculoPorId(pb.VehiculoId(id=99), ctx)) == (
        grpc.StatusCode.NOT_FOUND,
        "No se encontró el vehículo con id 99",
    )


def test_no_cambia_estado_si_esta_dado_de_baja(svc):
    v = crear(svc)
    svc.DarDeBajaVehiculo(pb.VehiculoId(id=v.id), ctx)
    pedido = pb.ActualizarEstadoRequest(id=v.id, estado=pb.RESERVADO)
    assert error(lambda: svc.ActualizarEstadoVehiculo(pedido, ctx))[0] == (
        grpc.StatusCode.FAILED_PRECONDITION
    )


def test_listar_combina_filtros(svc):
    corolla = crear(svc, "AAA111")
    crear(svc, "BBB222", modelo="Hilux", tipo="PICKUP")
    crear(svc, "CCC333", marca="Ford", modelo="Ka", tipo="HATCHBACK")
    filtro = pb.FiltroVehiculos(texto="toyota", tipo=pb.SEDAN)
    assert [v.id for v in svc.ListarVehiculos(filtro, ctx).vehiculos] == [corolla.id]


def test_disponibles_excluye_y_ordena_por_precio(svc):
    caro = crear(svc, "AAA111", precio_diario="300")
    barato = crear(svc, "BBB222", precio_diario="100")
    ocupado = crear(svc, "CCC333")
    baja = crear(svc, "DDD444")
    svc.DarDeBajaVehiculo(pb.VehiculoId(id=baja.id), ctx)
    reservado = crear(svc, "EEE555")
    svc.ActualizarEstadoVehiculo(pb.ActualizarEstadoRequest(id=reservado.id, estado=pb.RESERVADO), ctx)

    disponibles = svc.BuscarVehiculosDisponibles(periodo(excluidos=[ocupado.id]), ctx)
    assert [v.id for v in disponibles.vehiculos] == [barato.id, caro.id]

    hasta_200 = svc.BuscarVehiculosDisponibles(periodo(precio_max="200", excluidos=[ocupado.id]), ctx)
    assert [v.id for v in hasta_200.vehiculos] == [barato.id]


@pytest.mark.parametrize(
    "filtro, mensaje",
    [
        (periodo(dias=0), "La fecha de fin debe ser posterior a la de inicio"),
        (periodo(desde_dias=-3), "La fecha de inicio debe ser futura"),
    ],
)
def test_disponibles_valida_el_periodo(svc, filtro, mensaje):
    assert error(lambda: svc.BuscarVehiculosDisponibles(filtro, ctx)) == (
        grpc.StatusCode.INVALID_ARGUMENT,
        mensaje,
    )


def test_validar_para_reserva(svc):
    v = crear(svc)
    assert svc.ValidarVehiculoParaReserva(pb.VehiculoId(id=v.id), ctx).precio_diario == "15000.5"
    svc.DarDeBajaVehiculo(pb.VehiculoId(id=v.id), ctx)
    assert error(lambda: svc.ValidarVehiculoParaReserva(pb.VehiculoId(id=v.id), ctx)) == (
        grpc.StatusCode.FAILED_PRECONDITION,
        f"El vehículo con id {v.id} no está activo",
    )
