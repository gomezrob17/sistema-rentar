from unittest.mock import Mock

import pytest
from sqlalchemy import func, select

from app.db import EventoReserva, Reserva
from app.generated.rentar.alquileres.v1 import rental_pb2 as pb
from app.mantenimiento import publicar_pendientes, registrar_resultado
from test_servicer import svc, crear, ctx, error  # noqa: F401


def resultado(reserva, estado="REALIZADO", **cambios):
    return {"reservaId": reserva.id, "vehiculoId": reserva.vehiculo_id, "resultado": estado, **cambios}


def test_confirma_sin_broker_y_reintenta_evento(svc):
    r = crear(svc)
    assert r.estado == pb.ESTADO_RESERVA_CONFIRMADA
    assert r.mantenimiento == "PENDIENTE"
    caido = Mock(side_effect=ConnectionError("broker detenido"))
    with pytest.raises(ConnectionError):
        publicar_pendientes(svc.sesiones, caido)
    with svc.sesiones() as s:
        assert s.get(Reserva, r.id).estado == "CONFIRMADA"
        assert not s.get(EventoReserva, r.id).publicado
    publicado = Mock()
    publicar_pendientes(svc.sesiones, publicado)
    publicado.assert_called_once_with("reserva.confirmada", {
        "reservaId": r.id, "vehiculoId": r.vehiculo_id,
        "fechaInicio": r.fecha_inicio, "fechaFin": r.fecha_fin,
    }, str(r.id))
    publicar_pendientes(svc.sesiones, publicado)
    assert publicado.call_count == 1


def test_no_genera_evento_para_reserva_rechazada(svc):
    crear(svc)
    error(lambda: crear(svc))
    with svc.sesiones() as s:
        assert s.scalar(select(func.count()).select_from(EventoReserva)) == 1


@pytest.mark.parametrize("estado", ["REALIZADO", "NO_REALIZADO"])
def test_resultado_asociado_sin_modificar_reserva_y_duplicado(svc, estado):
    r = crear(svc)
    assert registrar_resultado(svc.sesiones, resultado(r, estado))
    assert not registrar_resultado(svc.sesiones, resultado(r, estado))
    actual = svc.BuscarReservaPorId(pb.BuscarReservaPorIdRequest(id=r.id), ctx).reserva
    assert actual.mantenimiento == estado
    assert (actual.estado, actual.importe_total, actual.fecha_inicio, actual.fecha_fin) == (
        r.estado, r.importe_total, r.fecha_inicio, r.fecha_fin,
    )


@pytest.mark.parametrize("cambios", [{"vehiculoId": 999}, {"reservaId": 999}, {"resultado": "PENDIENTE"}])
def test_rechaza_resultados_invalidos(svc, cambios):
    r = crear(svc)
    with pytest.raises(ValueError):
        registrar_resultado(svc.sesiones, resultado(r, **cambios))
    with svc.sesiones() as s:
        assert s.get(Reserva, r.id).mantenimiento == "PENDIENTE"


def test_resultado_contradictorio_no_sobrescribe(svc):
    r = crear(svc)
    registrar_resultado(svc.sesiones, resultado(r))
    with pytest.raises(ValueError):
        registrar_resultado(svc.sesiones, resultado(r, "NO_REALIZADO"))


def test_cancelacion_no_se_revierte_al_recibir_resultado(svc):
    r = crear(svc)
    svc.CancelarReserva(pb.CancelarReservaRequest(id=r.id, cliente_id=r.cliente_id), ctx)
    registrar_resultado(svc.sesiones, resultado(r))
    actual = svc.HistorialCliente(pb.HistorialClienteRequest(cliente_id=r.cliente_id), ctx).reservas[0]
    assert actual.estado == pb.ESTADO_RESERVA_CANCELADA
    assert actual.mantenimiento == "REALIZADO"
