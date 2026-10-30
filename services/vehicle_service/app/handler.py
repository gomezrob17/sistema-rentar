import logging

from messaging import EXTERNOS_VALIDACION_COMPLETADA
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db import RESULTADOS_VALIDACION, VERIFICACIONES, Vehiculo, VehiculoExterno

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


def _aplicar_validacion(
    sesiones,
    publicar,
    evento: dict,
    campo: str,
    motivo_rechazo: str,
    correlation_id: str | None = None,
) -> bool:
    """Aplica una validación parcial y correlaciona si ya están las dos.

    Es idempotente: si la solicitud ya no está PENDIENTE o el campo ya tiene un
    resultado, se ignora el evento repetido. Un resultado inválido lanza ValueError
    y el mensaje va a la cola de muertos.
    """
    externo_id = evento["vehiculoExternoId"]
    patente = evento["patente"]
    resultado = evento["resultado"]
    if resultado not in RESULTADOS_VALIDACION:
        raise ValueError(f"Resultado de validación inválido: {resultado!r}")

    with sesiones() as sesion:
        externo = sesion.get(VehiculoExterno, externo_id)
        if externo is None:
            log.warning("Validación para el vehículo externo %s inexistente: se ignora", externo_id)
            return False
        if externo.patente != patente:
            log.warning(
                "La validación del vehículo externo %s tiene patente %s y se esperaba %s: se ignora",
                externo_id, patente, externo.patente,
            )
            return False
        if externo.estado != "PENDIENTE":
            log.info(
                "El vehículo externo %s ya está %s: se ignora la validación %s",
                externo_id, externo.estado, campo,
            )
            return False
        if getattr(externo, campo) is not None:
            log.info(
                "El vehículo externo %s ya tenía %s=%s: se ignora el repetido",
                externo_id, campo, getattr(externo, campo),
            )
            return False

        setattr(externo, campo, resultado)
        if resultado == "RECHAZADO":
            externo.estado = "RECHAZADO"
            externo.motivo_rechazo = motivo_rechazo
            sesion.commit()
            log.info("Vehículo externo %s rechazado: %s", externo_id, motivo_rechazo)
            return True

        completar = (
            externo.validacion_patente == "VALIDADO"
            and externo.validacion_titularidad == "VALIDADO"
            and not externo.completada_publicada
        )
        if completar:
            externo.completada_publicada = True
        sesion.commit()

    if completar:
        publicar(
            EXTERNOS_VALIDACION_COMPLETADA,
            {"vehiculoExternoId": externo_id},
            correlation_id or str(externo_id),
        )
        log.info("Vehículo externo %s: validaciones completas, se pidió la incorporación", externo_id)
    return True


def procesar_validacion_patente(
    sesiones, publicar, evento: dict, correlation_id: str | None = None
) -> bool:
    return _aplicar_validacion(
        sesiones,
        publicar,
        evento,
        "validacion_patente",
        "La patente está denunciada como robada",
        correlation_id,
    )


def procesar_validacion_titularidad(
    sesiones, publicar, evento: dict, correlation_id: str | None = None
) -> bool:
    cliente_id = evento["clienteId"]
    externo_id = evento["vehiculoExternoId"]

    with sesiones() as sesion:
        externo = sesion.get(VehiculoExterno, externo_id)
        if externo is not None and externo.cliente_id != cliente_id:
            log.warning(
                "La validación de titularidad del vehículo externo %s es del cliente %s y se esperaba %s: se ignora",
                externo_id, cliente_id, externo.cliente_id,
            )
            return False

    return _aplicar_validacion(
        sesiones,
        publicar,
        evento,
        "validacion_titularidad",
        "El cliente no es el titular del vehículo",
        correlation_id,
    )


def procesar_incorporacion(sesiones, evento: dict) -> bool:
    """Consume vehiculos.externos.validacion.completada e incorpora el vehículo.

    Idempotente: si la solicitud ya está APROBADA, o no tiene las dos validaciones,
    se ignora. La patente es única en `vehiculos`; si otra alta ganó la carrera,
    la solicitud se rechaza sin duplicar la flota.
    """
    externo_id = evento["vehiculoExternoId"]
    with sesiones() as sesion:
        externo = sesion.get(VehiculoExterno, externo_id)
        if externo is None:
            log.warning("Incorporación del vehículo externo %s inexistente: se ignora", externo_id)
            return False
        if externo.estado == "APROBADO":
            log.info("El vehículo externo %s ya estaba incorporado: se ignora", externo_id)
            return False
        if (
            externo.estado != "PENDIENTE"
            or externo.validacion_patente != "VALIDADO"
            or externo.validacion_titularidad != "VALIDADO"
        ):
            log.warning(
                "El vehículo externo %s no está listo para incorporarse (estado=%s, patente=%s, titularidad=%s)",
                externo_id, externo.estado, externo.validacion_patente, externo.validacion_titularidad,
            )
            return False

        existente = sesion.scalar(select(Vehiculo).where(Vehiculo.patente == externo.patente))
        if existente is not None:
            externo.estado = "RECHAZADO"
            externo.motivo_rechazo = "Ya existe un vehículo con esa patente"
            sesion.commit()
            log.warning("Vehículo externo %s rechazado: la patente ya existe", externo_id)
            return False

        vehiculo = Vehiculo(
            patente=externo.patente,
            marca=externo.marca,
            modelo=externo.modelo,
            anio=externo.anio,
            color=externo.color,
            tipo=externo.tipo,
            precio_diario=externo.precio_diario,
            estado="DISPONIBLE",
            activo=True,
            verificacion="VALIDADO",
        )
        sesion.add(vehiculo)
        try:
            sesion.flush()
        except IntegrityError:
            sesion.rollback()
            externo = sesion.get(VehiculoExterno, externo_id)
            externo.estado = "RECHAZADO"
            externo.motivo_rechazo = "Ya existe un vehículo con esa patente"
            sesion.commit()
            log.warning("Vehículo externo %s rechazado: la patente ya existe", externo_id)
            return False

        externo.estado = "APROBADO"
        externo.vehiculo_id = vehiculo.id
        sesion.commit()
        log.info(
            "Vehículo externo %s incorporado como vehículo %s (%s)",
            externo_id, vehiculo.id, externo.patente,
        )
        return True
