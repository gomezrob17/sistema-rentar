"""Productor y consumidor de mantenimiento, fuera del hilo de la reserva gRPC."""

import logging
import time

from sqlalchemy import select, update
from messaging import RESERVA_CONFIRMADA, declarar_topologia, publicar

from app.db import EventoReserva, Reserva

log = logging.getLogger(__name__)


def publicar_pendientes(sesiones, publicador):
    with sesiones() as sesion:
        ids = list(sesion.scalars(select(EventoReserva.reserva_id).where(
            EventoReserva.publicado.is_(False)
        ).order_by(EventoReserva.reserva_id).limit(100)))
    for reserva_id in ids:
        with sesiones() as sesion:
            reserva = sesion.get(Reserva, reserva_id)
            publicador(RESERVA_CONFIRMADA, {
                "reservaId": reserva.id,
                "vehiculoId": reserva.vehiculo_id,
                "fechaInicio": reserva.fecha_inicio.isoformat(timespec="milliseconds") + "Z",
                "fechaFin": reserva.fecha_fin.isoformat(timespec="milliseconds") + "Z",
            }, str(reserva.id))
            # Solo después del publisher confirm. Si se corta aquí, puede repetirse;
            # el consumidor deduplica por reservaId.
            sesion.get(EventoReserva, reserva_id).publicado = True
            sesion.commit()


def ejecutar_publicador(sesiones):
    while True:
        try:
            declarar_topologia()
            publicar_pendientes(sesiones, publicar)
        except Exception:
            log.exception("No se pudo publicar reserva.confirmada; se reintentará sin bloquear reservas")
        time.sleep(2)


def registrar_resultado(sesiones, evento):
    resultado = evento["resultado"]
    if resultado not in ("REALIZADO", "NO_REALIZADO"):
        raise ValueError("Resultado de mantenimiento inválido")
    with sesiones() as sesion:
        reserva = sesion.get(Reserva, evento["reservaId"])
        if reserva is None or reserva.vehiculo_id != evento["vehiculoId"]:
            raise ValueError("El resultado no corresponde a la reserva y al vehículo indicados")
        if reserva.mantenimiento == resultado:
            return False
        if reserva.mantenimiento != "PENDIENTE":
            raise ValueError("La reserva no espera un resultado o ya tiene uno diferente")
        cambio = sesion.execute(update(Reserva).where(
            Reserva.id == reserva.id, Reserva.mantenimiento == "PENDIENTE"
        ).values(mantenimiento=resultado))
        sesion.commit()
        log.info("Reserva %s vehículo %s: mantenimiento %s", reserva.id, reserva.vehiculo_id, resultado)
        return cambio.rowcount == 1
