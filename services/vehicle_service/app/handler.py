import logging

from app.db import VERIFICACIONES, Vehiculo

log = logging.getLogger(__name__)


def procesar_resultado(sesiones, evento: dict) -> bool:
    """Aplica el resultado de vehiculos.verificacion.resultado. Devuelve si cambió el vehículo.

    Idempotente (RabbitMQ entrega at-least-once): solo se aplica sobre un vehículo con
    verificación PENDIENTE. Un vehículo inexistente o ya verificado se ignora y se loguea,
    y el mensaje se confirma igual para que no vuelva. Un resultado inválido lanza
    ValueError y el mensaje va a la cola de muertos.
    """
    vehiculo_id, patente, resultado = evento["vehiculoId"], evento["patente"], evento["resultado"]
    if resultado not in VERIFICACIONES or resultado == "PENDIENTE":
        raise ValueError(f"Resultado de verificación inválido: {resultado!r}")

    with sesiones() as sesion:
        vehiculo = sesion.get(Vehiculo, vehiculo_id)
        if vehiculo is None or vehiculo.patente != patente:
            log.warning("Resultado para el vehículo %s (%s) inexistente: se ignora", vehiculo_id, patente)
            return False
        if vehiculo.verificacion != "PENDIENTE":
            log.info(
                "El vehículo %s ya estaba verificado como %s: se ignora %s",
                vehiculo_id, vehiculo.verificacion, resultado,
            )
            return False
        vehiculo.verificacion = resultado
        sesion.commit()
    log.info("Vehículo %s (%s) verificado: %s", vehiculo_id, patente, resultado)
    return True
