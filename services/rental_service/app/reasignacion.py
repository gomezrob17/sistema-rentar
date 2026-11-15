"""Consumidor de vehiculo.averiado: reasigna reservas futuras confirmadas.
"""

import logging
from datetime import timezone

from messaging import RESERVA_REASIGNADA
from sqlalchemy import select

from app.db import ProcesoAveria, Reserva, ahora

log = logging.getLogger(__name__)

REASIGNADA = "REASIGNADA"
FALLIDA = "FALLIDA"
SIN_RESERVAS = "SIN_RESERVAS"
PROCESADA = "PROCESADA"
PARCIAL = "PARCIAL"


def _iso(fecha):
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    texto = fecha.astimezone(timezone.utc).isoformat(timespec="milliseconds")
    return texto.replace("+00:00", "Z")


def _ocupados(sesion, inicio, fin) -> list[int]:
    """Ids de vehículos con una reserva confirmada que se superpone con la ventana."""
    return list(
        sesion.scalars(
            select(Reserva.vehiculo_id)
            .where(
                Reserva.estado == "CONFIRMADA",
                Reserva.fecha_inicio < fin,
                Reserva.fecha_fin > inicio,
            )
            .distinct()
        )
    )


def _cambiar(
    sesion,
    reserva: Reserva,
    averia_id: int,
    vehiculo_original_id: int,
    reasignacion: str,
    detalle: str,
) -> None:
    if reserva.vehiculo_original_id is None:
        reserva.vehiculo_original_id = vehiculo_original_id
    reserva.averia_id = averia_id
    reserva.reasignacion = reasignacion
    reserva.reasignacion_detalle = detalle


def procesar_averia(sesiones, buscar_sustituto, publicador, evento: dict) -> bool:
    """Procesa una avería. Devuelve False si ya había sido procesada.

    Es idempotente por `averiaId`: RabbitMQ puede entregar el mismo evento más
    de una vez. Las reservas que ya no están CONFIRMADA o que ya cambiaron de
    vehículo se ignoran. El precio pactado al cliente no se modifica.
    """
    try:
        averia_id = int(evento["averiaId"])
        vehiculo_id = int(evento["vehiculoId"])
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("Evento vehiculo.averiado inválido") from error

    with sesiones() as sesion:
        if sesion.get(ProcesoAveria, averia_id) is not None:
            log.info("La avería %s ya fue procesada: se ignora el duplicado", averia_id)
            return False

        # Solo reservas futuras y confirmadas: las que todavía no comenzaron.
        reservas = list(
            sesion.scalars(
                select(Reserva)
                .where(
                    Reserva.vehiculo_id == vehiculo_id,
                    Reserva.estado == "CONFIRMADA",
                    Reserva.fecha_inicio > ahora(),
                )
                .order_by(Reserva.fecha_inicio, Reserva.id)
            )
        )

    if not reservas:
        with sesiones() as sesion:
            sesion.add(
                ProcesoAveria(
                    averia_id=averia_id,
                    vehiculo_id=vehiculo_id,
                    resultado=SIN_RESERVAS,
                    detalle="La unidad no tenía reservas futuras confirmadas",
                )
            )
            sesion.commit()
        log.info("Avería %s: el vehículo %s no tenía reservas futuras", averia_id, vehiculo_id)
        return True

    # Se copian los datos porque cada consulta y cada llamada gRPC usan su
    # propia sesión y no conviene mantener una transacción abierta mientras se
    # espera al Vehicle Service.
    pendientes = [(r.id, r.fecha_inicio, r.fecha_fin) for r in reservas]
    reasignadas = 0
    fallidas = 0

    for reserva_id, inicio, fin in pendientes:
        with sesiones() as sesion:
            reserva = sesion.get(Reserva, reserva_id)
            if (
                reserva is None
                or reserva.estado != "CONFIRMADA"
                or reserva.vehiculo_id != vehiculo_id
            ):
                continue
            excluidos = _ocupados(sesion, inicio, fin)

        try:
            sustituto = buscar_sustituto(
                vehiculo_id,
                _iso(inicio),
                _iso(fin),
                sorted(set(excluidos + [vehiculo_id])),
            )
        except Exception:
            # Sin el Vehicle Service no se puede decidir. Se propaga para que el
            # mensaje quede en la cola de muertos y un operador lo reprocese.
            log.exception("Avería %s: falló la búsqueda de sustituto", averia_id)
            raise

        confirmacion = None
        with sesiones() as sesion:
            reserva = sesion.get(Reserva, reserva_id)
            if (
                reserva is None
                or reserva.estado != "CONFIRMADA"
                or reserva.vehiculo_id != vehiculo_id
            ):
                continue

            if sustituto is None:
                _cambiar(
                    sesion,
                    reserva,
                    averia_id,
                    vehiculo_id,
                    FALLIDA,
                    "No se encontró un vehículo sustituto equivalente disponible "
                    "para toda la ventana temporal",
                )
                fallidas += 1
                log.warning(
                    "Avería %s: reserva %s sin sustituto compatible", averia_id, reserva_id
                )
            else:
                detalle = (
                    f"Reasignada a {sustituto.patente} "
                    f"({sustituto.marca} {sustituto.modelo})"
                )
                _cambiar(
                    sesion,
                    reserva,
                    averia_id,
                    vehiculo_id,
                    REASIGNADA,
                    detalle,
                )
                reserva.vehiculo_id = sustituto.id
                reasignadas += 1
                confirmacion = {
                    "reservaId": reserva.id,
                    "averiaId": averia_id,
                    "vehiculoAnteriorId": vehiculo_id,
                    "vehiculoNuevoId": sustituto.id,
                    "patenteNueva": sustituto.patente,
                    "fechaInicio": _iso(inicio),
                    "fechaFin": _iso(fin),
                }
                log.info(
                    "Avería %s: reserva %s reasignada a %s",
                    averia_id, reserva_id, sustituto.patente,
                )
            sesion.commit()

        # La confirmación se publica después del commit. Si el broker falla, la
        # reserva ya quedó reasignada y el error se registra para no revertirla.
        if confirmacion is not None:
            try:
                publicador(RESERVA_REASIGNADA, confirmacion, str(confirmacion["reservaId"]))
            except Exception:
                log.exception(
                    "Avería %s: la reserva %s quedó reasignada pero no se pudo publicar %s",
                    averia_id, reserva_id, RESERVA_REASIGNADA,
                )

    # El resultado del proceso refleja el de sus reservas: PROCESADA si todas se
    # reasignaron, FALLIDA si ninguna pudo y PARCIAL si hubo de las dos.
    if fallidas == 0:
        resultado = PROCESADA
    elif reasignadas == 0:
        resultado = FALLIDA
    else:
        resultado = PARCIAL

    with sesiones() as sesion:
        sesion.add(
            ProcesoAveria(
                averia_id=averia_id,
                vehiculo_id=vehiculo_id,
                resultado=resultado,
                detalle=f"{reasignadas} reasignada(s), {fallidas} fallida(s)",
            )
        )
        sesion.commit()

    log.info(
        "Avería %s %s: %s reasignada(s), %s fallida(s)",
        averia_id, resultado.lower(), reasignadas, fallidas,
    )
    return True
