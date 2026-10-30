"""Simulación reproducible del taller: registra, procesa y publica por separado."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from messaging import MANTENIMIENTO_RESULTADO

from app.db import Solicitud, ahora

log = logging.getLogger(__name__)


def _fecha(valor):
    fecha = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    if fecha.tzinfo is not None:
        fecha = fecha.astimezone(timezone.utc).replace(tzinfo=None)
    return fecha


def registrar_solicitud(sesiones, evento, demora_segundos=2):
    reserva_id, vehiculo_id = evento["reservaId"], evento["vehiculoId"]
    if any(type(i) is not int or i <= 0 for i in (reserva_id, vehiculo_id)):
        raise ValueError("Los identificadores deben ser enteros positivos")
    inicio, fin = _fecha(evento["fechaInicio"]), _fecha(evento["fechaFin"])
    if inicio >= fin:
        raise ValueError("El período de la reserva no es válido")
    with sesiones() as sesion:
        existente = sesion.get(Solicitud, reserva_id)
        if existente:
            if (existente.vehiculo_id, existente.fecha_inicio, existente.fecha_fin) != (vehiculo_id, inicio, fin):
                raise ValueError("Evento repetido con datos distintos para la misma reserva")
            return False
        sesion.add(Solicitud(
            reserva_id=reserva_id, vehiculo_id=vehiculo_id,
            fecha_inicio=inicio, fecha_fin=fin,
            procesar_desde=ahora() + timedelta(seconds=demora_segundos),
        ))
        try:
            sesion.commit()
        except IntegrityError:
            # Otra instancia pudo registrar la misma entrega. Verificar los datos.
            sesion.rollback()
            existente = sesion.get(Solicitud, reserva_id)
            if existente and (existente.vehiculo_id, existente.fecha_inicio, existente.fecha_fin) == (vehiculo_id, inicio, fin):
                return False
            raise
    log.info("Solicitud de mantenimiento registrada: reserva %s vehículo %s", reserva_id, vehiculo_id)
    return True


def procesar_pendientes(sesiones, no_realizados=frozenset(), momento=None):
    momento = momento or ahora()
    with sesiones() as sesion:
        pendientes = sesion.scalars(select(Solicitud).where(
            Solicitud.resultado.is_(None), Solicitud.procesar_desde <= momento
        ).order_by(Solicitud.reserva_id).limit(100).with_for_update(skip_locked=True))
        for solicitud in pendientes:
            # Simulación del taller: sin tiempo antes del inicio o sin recursos para
            # los vehículos configurados, el resultado es NO_REALIZADO.
            solicitud.resultado = (
                "NO_REALIZADO" if solicitud.fecha_inicio <= momento or solicitud.vehiculo_id in no_realizados
                else "REALIZADO"
            )
            solicitud.procesada_at = momento
            log.info("Mantenimiento reserva %s: %s", solicitud.reserva_id, solicitud.resultado)
        sesion.commit()


def publicar_resultados(sesiones, publicador):
    with sesiones() as sesion:
        ids = list(sesion.scalars(select(Solicitud.reserva_id).where(
            Solicitud.resultado.is_not(None), Solicitud.publicado.is_(False)
        ).order_by(Solicitud.reserva_id).limit(100)))
    for reserva_id in ids:
        with sesiones() as sesion:
            solicitud = sesion.get(Solicitud, reserva_id)
            publicador(MANTENIMIENTO_RESULTADO, {
                "reservaId": solicitud.reserva_id,
                "vehiculoId": solicitud.vehiculo_id,
                "resultado": solicitud.resultado,
            }, str(solicitud.reserva_id))
            solicitud.publicado = True
            sesion.commit()
