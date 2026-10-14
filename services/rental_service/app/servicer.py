from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from math import ceil

import grpc
from sqlalchemy import and_, or_, select, update

from app.db import Reserva, ahora
from app.generated import rental_pb2 as pb
from app.generated import rental_pb2_grpc as pb_grpc

INVALIDO = grpc.StatusCode.INVALID_ARGUMENT
NO_ENCONTRADO = grpc.StatusCode.NOT_FOUND
CONFLICTO = grpc.StatusCode.ABORTED
NO_PERMITIDO = grpc.StatusCode.FAILED_PRECONDITION

UN_DIA = timedelta(days=1)


def _fecha(texto: str, context) -> datetime:
    # Acepta ISO-8601 con "Z" o con offset; siempre se normaliza a UTC.
    normalizado = texto[:-1] + "+00:00" if texto.endswith("Z") else texto
    try:
        fecha = datetime.fromisoformat(normalizado)
    except ValueError:
        context.abort(INVALIDO, f"La fecha {texto!r} no es válida")
    # Se guarda en UTC sin zona horaria, igual que los TIMESTAMP de Prisma.
    if fecha.tzinfo is None:
        return fecha
    return fecha.astimezone(timezone.utc).replace(tzinfo=None)


def _iso(fecha: datetime) -> str:
    # Mismo formato que devolvía Hito 1: UTC con milisegundos y "Z".
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    texto = fecha.astimezone(timezone.utc).isoformat(timespec="milliseconds")
    return texto.replace("+00:00", "Z")


def _decimal(texto: str, context) -> Decimal:
    try:
        return Decimal(texto)
    except (InvalidOperation, TypeError):
        context.abort(INVALIDO, f"El precio diario {texto!r} no es válido")


def _precio(valor: Decimal) -> str:
    # Mismo formato que devolvía Hito 1: sin ceros de más ("15000.5", "45001.5").
    return format(valor.normalize(), "f")


def _estado_efectivo(estado: str, fecha_fin: datetime, momento: datetime) -> str:
    # Una confirmada vencida se informa FINALIZADA sin modificar el registro.
    return "FINALIZADA" if estado == "CONFIRMADA" and fecha_fin <= momento else estado


def _mensaje(r: Reserva) -> pb.Reserva:
    return pb.Reserva(
        id=r.id,
        cliente_id=r.cliente_id,
        vehiculo_id=r.vehiculo_id,
        fecha_inicio=_iso(r.fecha_inicio),
        fecha_fin=_iso(r.fecha_fin),
        precio_diario=_precio(r.precio_diario),
        importe_total=_precio(r.importe_total),
        estado=_estado_efectivo(r.estado, r.fecha_fin, ahora()),
        created_at=_iso(r.created_at),
        updated_at=_iso(r.updated_at),
    )


class RentalServicer(pb_grpc.RentalServiceServicer):
    def __init__(self, sesiones):
        self.sesiones = sesiones

    def _buscar(self, sesion, id: int, context) -> Reserva:
        reserva = sesion.get(Reserva, id)
        if reserva is None:
            context.abort(NO_ENCONTRADO, f"No se encontró la reserva con id {id}")
        return reserva

    def CrearReserva(self, request, context):
        inicio = _fecha(request.fecha_inicio, context)
        fin = _fecha(request.fecha_fin, context)
        if inicio >= fin:
            context.abort(INVALIDO, "La fecha de fin debe ser posterior a la de inicio")
        if inicio < ahora():
            context.abort(INVALIDO, "La fecha de inicio debe ser futura")

        precio = _decimal(request.precio_diario, context)
        if precio <= 0:
            context.abort(INVALIDO, "El precio diario debe ser mayor a 0")

        with self.sesiones() as sesion:
            solapada = sesion.scalar(
                select(Reserva).where(
                    Reserva.vehiculo_id == request.vehiculo_id,
                    Reserva.estado == "CONFIRMADA",
                    Reserva.fecha_inicio < fin,
                    Reserva.fecha_fin > inicio,
                )
            )
            if solapada:
                context.abort(
                    NO_PERMITIDO,
                    f"El vehículo con id {request.vehiculo_id} no está disponible en el período solicitado",
                )

            dias = max(1, ceil((fin - inicio) / UN_DIA))
            reserva = Reserva(
                cliente_id=request.cliente_id,
                vehiculo_id=request.vehiculo_id,
                fecha_inicio=inicio,
                fecha_fin=fin,
                precio_diario=precio,
                importe_total=precio * dias,
                estado="CONFIRMADA",
            )
            sesion.add(reserva)
            sesion.commit()
            return _mensaje(reserva)

    def BuscarReservaPorId(self, request, context):
        with self.sesiones() as sesion:
            return _mensaje(self._buscar(sesion, request.id, context))

    def ListarReservas(self, request, context):
        momento = ahora()
        consulta = select(Reserva)
        if request.HasField("cliente_id"):
            consulta = consulta.where(Reserva.cliente_id == request.cliente_id)
        if request.cliente_ids:
            consulta = consulta.where(Reserva.cliente_id.in_(request.cliente_ids))
        if request.HasField("vehiculo_id"):
            consulta = consulta.where(Reserva.vehiculo_id == request.vehiculo_id)
        if request.vehiculo_ids:
            consulta = consulta.where(Reserva.vehiculo_id.in_(request.vehiculo_ids))

        if request.HasField("estado"):
            # Mismo criterio que el historial: la confirmada vencida cuenta como FINALIZADA.
            if request.estado == pb.FINALIZADA:
                consulta = consulta.where(
                    or_(
                        Reserva.estado == "FINALIZADA",
                        and_(Reserva.estado == "CONFIRMADA", Reserva.fecha_fin <= momento),
                    )
                )
            elif request.estado == pb.CONFIRMADA:
                consulta = consulta.where(
                    Reserva.estado == "CONFIRMADA", Reserva.fecha_fin > momento
                )
            elif request.estado == pb.CANCELADA:
                consulta = consulta.where(Reserva.estado == "CANCELADA")
            else:
                context.abort(INVALIDO, "El estado de la reserva no es válido")

        if request.HasField("fecha_desde"):
            consulta = consulta.where(Reserva.fecha_fin >= _fecha(request.fecha_desde, context))
        if request.HasField("fecha_hasta"):
            consulta = consulta.where(
                Reserva.fecha_inicio <= _fecha(request.fecha_hasta, context)
            )

        consulta = consulta.order_by(Reserva.fecha_inicio.desc(), Reserva.id.desc())
        with self.sesiones() as sesion:
            return pb.ListaReservas(
                reservas=[_mensaje(r) for r in sesion.scalars(consulta)]
            )

    def CancelarReserva(self, request, context):
        momento = ahora()
        with self.sesiones() as sesion:
            reserva = sesion.scalar(
                select(Reserva).where(
                    Reserva.id == request.id,
                    Reserva.cliente_id == request.cliente_id,
                )
            )
            if reserva is None:
                context.abort(NO_ENCONTRADO, "No se encontró la reserva")
            if reserva.estado != "CONFIRMADA":
                context.abort(CONFLICTO, "Solo se pueden cancelar reservas confirmadas")
            if reserva.fecha_inicio <= momento:
                context.abort(NO_PERMITIDO, "El período de alquiler ya comenzó")

            # La condición se repite en la escritura para que dos cancelaciones
            # simultáneas no modifiquen la misma reserva.
            resultado = sesion.execute(
                update(Reserva)
                .where(
                    Reserva.id == request.id,
                    Reserva.cliente_id == request.cliente_id,
                    Reserva.estado == "CONFIRMADA",
                    Reserva.fecha_inicio > momento,
                )
                .values(estado="CANCELADA", updated_at=momento)
            )
            if resultado.rowcount != 1:
                context.abort(
                    CONFLICTO,
                    "La reserva cambió o el alquiler ya comenzó. Actualizá la consulta.",
                )
            sesion.commit()
            sesion.refresh(reserva)
            return _mensaje(reserva)

    def HistorialCliente(self, request, context):
        momento = ahora()
        consulta = (
            select(Reserva)
            .where(
                Reserva.cliente_id == request.cliente_id,
                or_(
                    Reserva.estado == "CANCELADA",
                    Reserva.estado == "FINALIZADA",
                    and_(Reserva.estado == "CONFIRMADA", Reserva.fecha_fin <= momento),
                ),
            )
            .order_by(Reserva.fecha_inicio.desc(), Reserva.id.desc())
        )
        with self.sesiones() as sesion:
            return pb.ListaReservas(
                reservas=[_mensaje(r) for r in sesion.scalars(consulta)]
            )

    def VehiculosOcupados(self, request, context):
        inicio = _fecha(request.fecha_inicio, context)
        fin = _fecha(request.fecha_fin, context)
        consulta = (
            select(Reserva.vehiculo_id)
            .where(
                Reserva.estado == "CONFIRMADA",
                Reserva.fecha_inicio < fin,
                Reserva.fecha_fin > inicio,
            )
            .distinct()
        )
        with self.sesiones() as sesion:
            return pb.IdsVehiculos(ids=list(sesion.scalars(consulta)))
