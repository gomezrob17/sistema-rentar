import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, PatenteRobada, cargar_denuncias
from app.handler import esta_robada, procesar_solicitud


class Publicador:
    """Publicador falso: guarda los eventos en vez de mandarlos al broker."""

    def __init__(self):
        self.eventos = []

    def __call__(self, routing_key, payload, correlation_id=None):
        self.eventos.append((routing_key, payload, correlation_id))


@pytest.fixture
def sesiones():
    # ponytail: SQLite en memoria para probar las reglas sin levantar Postgres.
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sesiones = sessionmaker(engine, expire_on_commit=False)
    cargar_denuncias(sesiones)
    return sesiones


@pytest.mark.parametrize(
    "patente, robada",
    [("ROB123", True), ("rob 123", True), ("AC-452-KL", True), ("ABC123", False)],
)
def test_chequeo_de_patente(sesiones, patente, robada):
    assert esta_robada(sesiones, patente) is robada


def test_patente_limpia_publica_validado(sesiones):
    publicar = Publicador()
    assert procesar_solicitud(sesiones, publicar, {"vehiculoId": 15, "patente": "ABC123"}, "id-1") == "VALIDADO"
    assert publicar.eventos == [
        (
            "vehiculos.verificacion.resultado",
            {"vehiculoId": 15, "patente": "ABC123", "resultado": "VALIDADO"},
            "id-1",
        )
    ]


def test_patente_robada_publica_robado(sesiones):
    publicar = Publicador()
    procesar_solicitud(sesiones, publicar, {"vehiculoId": 16, "patente": "ROB123"})
    assert publicar.eventos[0][1] == {"vehiculoId": 16, "patente": "ROB123", "resultado": "ROBADO"}


def test_pedido_repetido_publica_el_mismo_resultado(sesiones):
    publicar = Publicador()
    evento = {"vehiculoId": 16, "patente": "ROB123"}
    procesar_solicitud(sesiones, publicar, evento)
    procesar_solicitud(sesiones, publicar, evento)
    assert publicar.eventos[0] == publicar.eventos[1]


def test_evento_incompleto_falla_sin_publicar(sesiones):
    publicar = Publicador()
    with pytest.raises(KeyError):
        procesar_solicitud(sesiones, publicar, {"vehiculoId": 16})
    assert publicar.eventos == []


def test_carga_de_denuncias_idempotente(sesiones):
    cargar_denuncias(sesiones)
    with sesiones() as sesion:
        assert sesion.query(PatenteRobada).count() == 4
