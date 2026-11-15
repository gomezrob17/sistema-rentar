"""Publicador del outbox de averías, fuera del hilo de la llamada gRPC."""

import logging
import time
from datetime import timezone

from messaging import VEHICULO_AVERIADO, declarar_topologia, publicar
from sqlalchemy import select

from app.db import Averia, Vehiculo

log = logging.getLogger(__name__)


def _iso(fecha):
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    texto = fecha.astimezone(timezone.utc).isoformat(timespec="milliseconds")
    return texto.replace("+00:00", "Z")


def _precio(valor):
    return format(valor.normalize(), "f")


def publicar_pendientes(sesiones, publicador):
    """Publica las averías registradas que todavía no llegaron al broker.

    La avería y el vehículo INHABILITADO ya están confirmados en la base. Si el
    broker falla, el registro queda con publicado = false y se reintenta.
    """
    with sesiones() as sesion:
        ids = list(
            sesion.scalars(
                select(Averia.id)
                .where(Averia.publicado.is_(False))
                .order_by(Averia.id)
                .limit(100)
            )
        )

    for averia_id in ids:
        with sesiones() as sesion:
            averia = sesion.get(Averia, averia_id)
            vehiculo = sesion.get(Vehiculo, averia.vehiculo_id)
            if vehiculo is None:
                log.error("La avería %s apunta a un vehículo inexistente: se descarta", averia_id)
                averia.publicado = True
                sesion.commit()
                continue

            publicador(
                VEHICULO_AVERIADO,
                {
                    "averiaId": averia.id,
                    "vehiculoId": vehiculo.id,
                    "patente": vehiculo.patente,
                    "motivo": averia.motivo,
                    "tipo": vehiculo.tipo,
                    "precioDiario": _precio(vehiculo.precio_diario),
                    "fecha": _iso(averia.created_at),
                },
                str(averia.id),
            )
            # Solo después de la confirmación del broker. Si el proceso se corta
            # entre publicar y marcar, el evento se repite: Rental deduplica por averiaId.
            averia.publicado = True
            sesion.commit()


def ejecutar_publicador(sesiones):
    while True:
        try:
            declarar_topologia()
            publicar_pendientes(sesiones, publicar)
        except Exception:
            log.exception("No se pudo publicar vehiculo.averiado; se reintentará")
        time.sleep(2)
