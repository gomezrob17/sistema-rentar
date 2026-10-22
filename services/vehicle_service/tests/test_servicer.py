from datetime import datetime, timedelta, timezone

import grpc
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.generated import vehicle_pb2 as pb
from app.handler import procesar_resultado
from app.servicer import VehicleServicer


class Abortado(Exception):
    pass


class Contexto:
    """Imita el context de gRPC: abort corta la ejecución con el código y el mensaje."""

    def abort(self, codigo, mensaje):
        raise Abortado(codigo, mensaje)


ctx = Contexto()


class Publicador:
    """Publicador falso: guarda los eventos en vez de mandarlos al broker."""

    def __init__(self, falla=False):
        self.eventos = []
        self.falla = falla

    def __call__(self, routing_key, payload, correlation_id=None):
        if self.falla:
            raise ConnectionError("broker caído")
        self.eventos.append((routing_key, payload))


@pytest.fixture
def svc():
    # ponytail: SQLite en memoria para probar las reglas sin levantar Postgres.
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return VehicleServicer(sessionmaker(engine, expire_on_commit=False), Publicador())


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


# --- Verificación de vehículos (Hito 3) ---


def resultado(svc, v, valor, patente=None):
    evento = {"vehiculoId": v.id, "patente": patente or v.patente, "resultado": valor}
    return procesar_resultado(svc.sesiones, evento)


def verificacion(svc, v):
    return pb.VerificacionVehiculo.Name(svc.BuscarVehiculoPorId(pb.VehiculoId(id=v.id), ctx).verificacion)


def test_alta_pide_verificacion_y_queda_pendiente(svc):
    v = crear(svc)
    assert v.verificacion == pb.PENDIENTE
    assert svc.publicar.eventos == [
        ("vehiculos.verificacion.solicitada", {"vehiculoId": v.id, "patente": "AB123CD"})
    ]


def test_alta_no_se_revierte_si_falla_el_broker(svc):
    svc.publicar = Publicador(falla=True)
    v = crear(svc)
    assert verificacion(svc, v) == "PENDIENTE"


def test_resultado_validado(svc):
    v = crear(svc)
    assert resultado(svc, v, "VALIDADO") is True
    assert verificacion(svc, v) == "VALIDADO"
    assert svc.ValidarVehiculoParaReserva(pb.VehiculoId(id=v.id), ctx).id == v.id


def test_resultado_robado_inhabilita_el_vehiculo(svc):
    limpio = crear(svc, "AAA111")
    robado = crear(svc, "ROB123")
    pendiente = crear(svc, "CCC333")
    resultado(svc, limpio, "VALIDADO")
    resultado(svc, robado, "ROBADO")

    # Sigue DISPONIBLE: ROBADO no es un estado operativo.
    assert svc.BuscarVehiculoPorId(pb.VehiculoId(id=robado.id), ctx).estado == pb.DISPONIBLE
    disponibles = svc.BuscarVehiculosDisponibles(periodo(), ctx)
    assert [v.id for v in disponibles.vehiculos] == [limpio.id, pendiente.id]

    assert error(lambda: svc.ValidarVehiculoParaReserva(pb.VehiculoId(id=robado.id), ctx)) == (
        grpc.StatusCode.FAILED_PRECONDITION,
        f"El vehículo con id {robado.id} está inhabilitado por denuncia de robo",
    )
    pedido = pb.ActualizarEstadoRequest(id=robado.id, estado=pb.EN_ALQUILER)
    assert error(lambda: svc.ActualizarEstadoVehiculo(pedido, ctx)) == (
        grpc.StatusCode.FAILED_PRECONDITION,
        "No se puede cambiar el estado de un vehículo inhabilitado por denuncia de robo",
    )


def test_resultado_repetido_es_idempotente(svc):
    v = crear(svc)
    assert resultado(svc, v, "ROBADO") is True
    assert resultado(svc, v, "ROBADO") is False
    # Un resultado distinto para un vehículo ya verificado tampoco lo cambia.
    assert resultado(svc, v, "VALIDADO") is False
    assert verificacion(svc, v) == "ROBADO"


def test_resultado_de_vehiculo_inexistente_se_ignora(svc):
    evento = {"vehiculoId": 99, "patente": "ZZZ999", "resultado": "ROBADO"}
    assert procesar_resultado(svc.sesiones, evento) is False


def test_resultado_con_otra_patente_se_ignora(svc):
    v = crear(svc)
    assert resultado(svc, v, "ROBADO", patente="OTRA999") is False
    assert verificacion(svc, v) == "PENDIENTE"


@pytest.mark.parametrize("valor", ["PENDIENTE", "DUDOSO"])
def test_resultado_invalido_falla(svc, valor):
    v = crear(svc)
    with pytest.raises(ValueError):
        resultado(svc, v, valor)
