import logging

from messaging import (
    EXTERNOS_VALIDACION_PATENTE,
    EXTERNOS_VALIDACION_TITULARIDAD,
    VERIFICACION_RESULTADO,
)

from app.db import PatenteRobada, Titularidad

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


def esta_denunciada(sesiones, patente: str) -> bool:
    return esta_robada(sesiones, patente)


def es_titular(sesiones, patente: str, documento: str) -> bool:
    with sesiones() as sesion:
        titularidad = sesion.get(Titularidad, normalizar(patente))
        return titularidad is not None and titularidad.documento == documento.strip()


def procesar_externo_patente(
    sesiones, publicar, evento: dict, correlation_id: str | None = None
) -> str:
    """Valida que la patente del vehículo externo no esté denunciada como robada.

    Publica vehiculos.externos.validacion.patente con el resultado. Es idempotente:
    el mismo evento produce el mismo resultado y el correlador ignora el repetido.
    """
    externo_id = evento["vehiculoExternoId"]
    patente = evento["patente"]
    resultado = "RECHAZADO" if esta_denunciada(sesiones, patente) else "VALIDADO"
    publicar(
        EXTERNOS_VALIDACION_PATENTE,
        {"vehiculoExternoId": externo_id, "patente": patente, "resultado": resultado},
        correlation_id,
    )
    log.info("Vehículo externo %s, patente %s: %s", externo_id, patente, resultado)
    return resultado


def procesar_externo_titularidad(
    sesiones,
    publicar,
    obtener_documento,
    evento: dict,
    correlation_id: str | None = None,
) -> str:
    """Valida que el cliente sea el titular de la patente en el registro simulado.

    obtener_documento(cliente_id) consulta el Customer Service por gRPC. El
    resultado incluye el documento, tal como pide el contrato del evento.
    """
    externo_id = evento["vehiculoExternoId"]
    cliente_id = evento["clienteId"]
    patente = evento["patente"]
    documento = obtener_documento(cliente_id)
    resultado = "VALIDADO" if es_titular(sesiones, patente, documento) else "RECHAZADO"
    publicar(
        EXTERNOS_VALIDACION_TITULARIDAD,
        {
            "vehiculoExternoId": externo_id,
            "clienteId": cliente_id,
            "documento": documento,
            "patente": patente,
            "resultado": resultado,
        },
        correlation_id,
    )
    log.info(
        "Vehículo externo %s, patente %s, cliente %s: %s",
        externo_id,
        patente,
        cliente_id,
        resultado,
    )
    return resultado
