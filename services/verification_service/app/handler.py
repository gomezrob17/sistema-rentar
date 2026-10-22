import logging

from messaging import VERIFICACION_RESULTADO

from app.db import PatenteRobada

log = logging.getLogger(__name__)


def normalizar(patente: str) -> str:
    return patente.upper().replace(" ", "").replace("-", "")


def esta_robada(sesiones, patente: str) -> bool:
    with sesiones() as sesion:
        return sesion.get(PatenteRobada, normalizar(patente)) is not None


def procesar_solicitud(sesiones, publicar, evento: dict, correlation_id: str | None = None) -> str:
    """Consulta el registro policial y publica el resultado de la verificación.

    Es idempotente: si el mismo pedido llega dos veces se publica el mismo resultado,
    y el Vehicle Service ignora el repetido. Un evento sin vehiculoId o patente lanza
    KeyError y va a la cola de muertos.
    """
    patente = evento["patente"]
    resultado = "ROBADO" if esta_robada(sesiones, patente) else "VALIDADO"
    publicar(
        VERIFICACION_RESULTADO,
        {"vehiculoId": evento["vehiculoId"], "patente": patente, "resultado": resultado},
        correlation_id,
    )
    log.info("Vehículo %s, patente %s: %s", evento["vehiculoId"], patente, resultado)
    return resultado
