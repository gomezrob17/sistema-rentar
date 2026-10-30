from datetime import timedelta
from unittest.mock import Mock

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.db import Base, Solicitud, ahora
from app.handler import registrar_solicitud, procesar_pendientes, publicar_resultados


@pytest.fixture
def sesiones():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    yield sessionmaker(engine, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def evento():
    inicio = ahora() + timedelta(days=3)
    return {"reservaId": 150, "vehiculoId": 15, "fechaInicio": inicio.isoformat() + "Z",
            "fechaFin": (inicio + timedelta(days=2)).isoformat() + "Z"}


def test_registro_durable_y_duplicado(sesiones, evento):
    assert registrar_solicitud(sesiones, evento, demora_segundos=30)
    assert not registrar_solicitud(sesiones, evento)
    procesar_pendientes(sesiones)
    with sesiones() as s:
        assert s.scalar(select(func.count()).select_from(Solicitud)) == 1
        solicitud = s.get(Solicitud, 150)
        assert solicitud.resultado is None
        assert solicitud.vehiculo_id == 15
    procesar_pendientes(sesiones, momento=ahora() + timedelta(seconds=31))
    with sesiones() as s:
        assert s.get(Solicitud, 150).resultado == "REALIZADO"


@pytest.mark.parametrize("no_realizados,esperado", [(set(), "REALIZADO"), ({15}, "NO_REALIZADO")])
def test_resultados_y_publicacion(sesiones, evento, no_realizados, esperado):
    registrar_solicitud(sesiones, evento, demora_segundos=0)
    procesar_pendientes(sesiones, no_realizados)
    publicado = Mock()
    publicar_resultados(sesiones, publicado)
    publicado.assert_called_once_with("mantenimiento.resultado", {
        "reservaId": 150, "vehiculoId": 15, "resultado": esperado,
    }, "150")
    # Entrega repetida o reinicio: ni otra solicitud ni otra publicación procesada.
    registrar_solicitud(sesiones, evento, demora_segundos=0)
    procesar_pendientes(sesiones)
    publicar_resultados(sesiones, publicado)
    assert publicado.call_count == 1


def test_sin_tiempo_para_mantenimiento(sesiones, evento):
    registrar_solicitud(sesiones, evento, demora_segundos=0)
    procesar_pendientes(sesiones, momento=ahora() + timedelta(days=4))
    with sesiones() as s:
        assert s.get(Solicitud, 150).resultado == "NO_REALIZADO"


def test_reintento_tras_caida_del_broker_conserva_resultado(sesiones, evento):
    registrar_solicitud(sesiones, evento, demora_segundos=0)
    procesar_pendientes(sesiones)
    with pytest.raises(ConnectionError):
        publicar_resultados(sesiones, Mock(side_effect=ConnectionError()))
    with sesiones() as s:
        assert s.get(Solicitud, 150).resultado == "REALIZADO"
        assert not s.get(Solicitud, 150).publicado
    publicado = Mock()
    publicar_resultados(sesiones, publicado)
    assert publicado.call_count == 1


def test_repetido_con_otro_vehiculo_se_rechaza(sesiones, evento):
    registrar_solicitud(sesiones, evento)
    with pytest.raises(ValueError):
        registrar_solicitud(sesiones, {**evento, "vehiculoId": 99})


@pytest.mark.parametrize("cambios", [{"reservaId": -1}, {"vehiculoId": "15"}, {"fechaFin": "2000-01-01"}])
def test_evento_invalido_no_crea_solicitud(sesiones, evento, cambios):
    with pytest.raises(ValueError):
        registrar_solicitud(sesiones, {**evento, **cambios})
    with sesiones() as s:
        assert s.scalar(select(func.count()).select_from(Solicitud)) == 0
