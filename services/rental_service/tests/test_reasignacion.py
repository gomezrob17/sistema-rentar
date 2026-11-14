from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.db import ProcesoAveria, Reserva
from app.reasignacion import procesar_averia
from test_servicer import sembrar, svc  # noqa: F401


class Buscador:
    """Sustituto falso del cliente gRPC: devuelve los resultados en orden."""

    def __init__(self, resultados=None):
        self.resultados = list(resultados or [])
        self.llamadas = []

    def __call__(self, vehiculo_id, fecha_inicio, fecha_fin, excluidos):
        self.llamadas.append((vehiculo_id, fecha_inicio, fecha_fin, list(excluidos)))
        return self.resultados.pop(0) if self.resultados else None


class Publicador:
    def __init__(self):
        self.eventos = []

    def __call__(self, routing_key, payload, correlation_id=None):
        self.eventos.append((routing_key, payload, correlation_id))


def sustituto(id=2, patente="BBB222"):
    return SimpleNamespace(
        id=id, patente=patente, marca="Toyota", modelo="Corolla",
        tipo="SEDAN", precio_diario="1500",
    )


def evento(averia_id=1, vehiculo_id=1):
    return {"averiaId": averia_id, "vehiculoId": vehiculo_id, "patente": "AAA111",
            "motivo": "Falla de frenos"}


def test_reasigna_reserva_futura_y_publica_confirmacion(svc):
    reserva_id = sembrar(svc, vehiculo_id=1, desde=3, hasta=5)
    buscador = Buscador([sustituto()])
    publicador = Publicador()

    assert procesar_averia(svc.sesiones, buscador, publicador, evento()) is True

    with svc.sesiones() as sesion:
        reserva = sesion.get(Reserva, reserva_id)
        assert (reserva.vehiculo_id, reserva.vehiculo_original_id, reserva.averia_id) == (2, 1, 1)
        assert reserva.reasignacion == "REASIGNADA"
        assert "BBB222" in reserva.reasignacion_detalle
        # El precio pactado no cambia.
        assert Decimal(reserva.precio_diario) == Decimal("1500")
        assert sesion.get(ProcesoAveria, 1).resultado == "PROCESADA"

    assert buscador.llamadas[0][0] == 1
    assert 1 in buscador.llamadas[0][3]  # el averiado nunca es candidato
    assert publicador.eventos == [(
        "reserva.reasignada",
        {
            "reservaId": reserva_id,
            "averiaId": 1,
            "vehiculoAnteriorId": 1,
            "vehiculoNuevoId": 2,
            "patenteNueva": "BBB222",
            "fechaInicio": publicador.eventos[0][1]["fechaInicio"],
            "fechaFin": publicador.eventos[0][1]["fechaFin"],
        },
        str(reserva_id),
    )]


def test_evento_repetido_no_vuelve_a_procesar(svc):
    sembrar(svc, vehiculo_id=1, desde=3, hasta=5)
    buscador = Buscador([sustituto()])
    publicador = Publicador()

    assert procesar_averia(svc.sesiones, buscador, publicador, evento()) is True
    assert procesar_averia(svc.sesiones, buscador, publicador, evento()) is False

    assert len(buscador.llamadas) == 1
    assert len(publicador.eventos) == 1


def test_sin_reservas_futuras_no_busca_sustituto(svc):
    # Vencida y cancelada: no son reservas futuras confirmadas.
    sembrar(svc, vehiculo_id=1, desde=-5, hasta=-3)
    sembrar(svc, vehiculo_id=1, desde=3, hasta=5, estado="CANCELADA")
    buscador = Buscador([sustituto()])
    publicador = Publicador()

    assert procesar_averia(svc.sesiones, buscador, publicador, evento()) is True
    assert buscador.llamadas == []
    assert publicador.eventos == []
    with svc.sesiones() as sesion:
        proceso = sesion.get(ProcesoAveria, 1)
        assert proceso.resultado == "SIN_RESERVAS"


def test_sin_sustituto_marca_fallida_para_intervencion(svc):
    reserva_id = sembrar(svc, vehiculo_id=1, desde=3, hasta=5)
    buscador = Buscador([])
    publicador = Publicador()

    assert procesar_averia(svc.sesiones, buscador, publicador, evento()) is True

    with svc.sesiones() as sesion:
        reserva = sesion.get(Reserva, reserva_id)
        assert reserva.vehiculo_id == 1
        assert reserva.reasignacion == "FALLIDA"
        assert "No se encontró" in reserva.reasignacion_detalle
    assert publicador.eventos == []


def test_excluye_vehiculos_ocupados_en_la_ventana(svc):
    reserva_id = sembrar(svc, vehiculo_id=1, desde=3, hasta=5)
    # Otro vehículo ya tiene una reserva confirmada que se superpone.
    sembrar(svc, vehiculo_id=9, desde=4, hasta=6)
    buscador = Buscador([sustituto()])

    procesar_averia(svc.sesiones, buscador, Publicador(), evento())

    excluidos = buscador.llamadas[0][3]
    assert {1, 9}.issubset(set(excluidos))
    with svc.sesiones() as sesion:
        assert sesion.get(Reserva, reserva_id).vehiculo_id == 2


def test_dos_reservas_del_mismo_vehiculo_no_reciben_el_mismo_sustituto(svc):
    primera = sembrar(svc, vehiculo_id=1, desde=3, hasta=5)
    segunda = sembrar(svc, vehiculo_id=1, desde=4, hasta=6)

    def buscador(vehiculo_id, inicio, fin, excluidos):
        # Simula que el Vehicle Service no devuelve un vehículo ya excluido.
        return None if 2 in excluidos else sustituto(id=2)

    publicador = Publicador()
    procesar_averia(svc.sesiones, buscador, publicador, evento())

    with svc.sesiones() as sesion:
        estados = {r.id: (r.vehiculo_id, r.reasignacion) for r in [sesion.get(Reserva, primera), sesion.get(Reserva, segunda)]}
    assert estados[primera] == (2, "REASIGNADA")
    assert estados[segunda] == (1, "FALLIDA")


def test_vehiculo_sin_reserva_solo_se_ignora_si_el_evento_es_invalido(svc):
    with pytest.raises(ValueError):
        procesar_averia(svc.sesiones, Buscador(), Publicador(), {"averiaId": "x"})
