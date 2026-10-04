from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import grpc
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.db import TIPOS, Vehiculo
from app.generated import vehicle_pb2 as pb
from app.generated import vehicle_pb2_grpc as pb_grpc

INVALIDO = grpc.StatusCode.INVALID_ARGUMENT

# Número del enum TipoVehiculo -> nombre que se guarda en la base ("SEDAN", ...).
NOMBRE_TIPO = {valor: nombre for nombre, valor in pb.TipoVehiculo.items()}

# Campos de vehículo que pueden venir en un alta o en una edición.
CAMPOS = ("patente", "marca", "modelo", "anio", "color", "tipo", "precio_diario")

# Validaciones propias del vehículo: campo -> (regla, mensaje si no se cumple).
REGLAS = {
    "patente": (lambda v: v.strip() != "", "La patente es obligatoria"),
    "marca": (lambda v: v.strip() != "", "La marca es obligatoria"),
    "modelo": (lambda v: v.strip() != "", "El modelo es obligatorio"),
    "anio": (lambda v: v >= 1900, "El año debe ser 1900 o posterior"),
    "tipo": (lambda v: v in TIPOS, "El tipo de vehículo no es válido"),
    "precio_diario": (
        lambda v: v is not None and v > 0,
        "El precio diario debe ser un número mayor a 0",
    ),
}


def _decimal(texto: str) -> Decimal | None:
    try:
        return Decimal(texto)
    except InvalidOperation:
        return None


def _precio_filtro(texto: str, context) -> Decimal:
    valor = _decimal(texto)
    if valor is None:
        context.abort(INVALIDO, "El rango de precio no es válido")
    return valor


def _fecha(texto: str, context) -> datetime:
    try:
        fecha = datetime.fromisoformat(texto)
    except ValueError:
        context.abort(INVALIDO, f"La fecha {texto!r} no es válida")
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def _iso(fecha: datetime) -> str:
    # Mismo formato que devolvía Hito 1: UTC con milisegundos y "Z".
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    texto = fecha.astimezone(timezone.utc).isoformat(timespec="milliseconds")
    return texto.replace("+00:00", "Z")


def _precio(valor: Decimal) -> str:
    # Mismo formato que devolvía Hito 1: sin ceros de más ("15000.5", "45000").
    return format(valor.normalize(), "f")


def _mensaje(v: Vehiculo) -> pb.Vehiculo:
    return pb.Vehiculo(
        id=v.id,
        patente=v.patente,
        marca=v.marca,
        modelo=v.modelo,
        anio=v.anio,
        color=v.color,
        tipo=v.tipo,
        precio_diario=_precio(v.precio_diario),
        estado=v.estado,
        activo=v.activo,
        created_at=_iso(v.created_at),
        updated_at=_iso(v.updated_at),
    )


def _leer_campos(request, context) -> dict:
    """Toma los campos enviados (en una edición, solo los presentes) y los valida."""
    datos = {}
    for campo in CAMPOS:
        descriptor = request.DESCRIPTOR.fields_by_name.get(campo)
        if descriptor is None or (descriptor.has_presence and not request.HasField(campo)):
            continue
        datos[campo] = getattr(request, campo)
    if "tipo" in datos:
        datos["tipo"] = NOMBRE_TIPO.get(datos["tipo"], "")
    if "precio_diario" in datos:
        datos["precio_diario"] = _decimal(datos["precio_diario"])
    for campo, valor in datos.items():
        regla = REGLAS.get(campo)
        if regla and not regla[0](valor):
            context.abort(INVALIDO, regla[1])
    return datos


class VehicleServicer(pb_grpc.VehicleServiceServicer):
    def __init__(self, sesiones):
        self.sesiones = sesiones

    def _buscar(self, sesion, id: int, context) -> Vehiculo:
        vehiculo = sesion.get(Vehiculo, id)
        if vehiculo is None:
            context.abort(grpc.StatusCode.NOT_FOUND, f"No se encontró el vehículo con id {id}")
        return vehiculo

    def CrearVehiculo(self, request, context):
        datos = _leer_campos(request, context)
        with self.sesiones() as sesion:
            vehiculo = Vehiculo(**datos)
            sesion.add(vehiculo)
            try:
                sesion.commit()
            except IntegrityError:
                # La única restricción única es la patente.
                context.abort(
                    grpc.StatusCode.ALREADY_EXISTS,
                    f"Ya existe un vehículo con la patente {datos['patente']}",
                )
            return _mensaje(vehiculo)

    def ListarVehiculos(self, request, context):
        consulta = select(Vehiculo).order_by(Vehiculo.id)
        if request.ids:
            consulta = consulta.where(Vehiculo.id.in_(request.ids))
        texto = request.texto.strip()
        if texto:
            patron = f"%{texto}%"
            consulta = consulta.where(
                or_(
                    Vehiculo.marca.ilike(patron),
                    Vehiculo.modelo.ilike(patron),
                    Vehiculo.patente.ilike(patron),
                )
            )
        if request.tipo:
            consulta = consulta.where(Vehiculo.tipo == pb.TipoVehiculo.Name(request.tipo))
        with self.sesiones() as sesion:
            return pb.ListaVehiculos(vehiculos=[_mensaje(v) for v in sesion.scalars(consulta)])

    def BuscarVehiculoPorId(self, request, context):
        with self.sesiones() as sesion:
            return _mensaje(self._buscar(sesion, request.id, context))

    def ActualizarVehiculo(self, request, context):
        datos = _leer_campos(request, context)
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            for campo, valor in datos.items():
                setattr(vehiculo, campo, valor)
            sesion.commit()
            return _mensaje(vehiculo)

    def DarDeBajaVehiculo(self, request, context):
        # Baja lógica: no se borra el registro, solo se marca como inactivo.
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            vehiculo.activo = False
            sesion.commit()
            return _mensaje(vehiculo)

    def ActualizarEstadoVehiculo(self, request, context):
        if request.estado == pb.ESTADO_VEHICULO_SIN_ESPECIFICAR:
            context.abort(INVALIDO, "El estado del vehículo no es válido")
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            if not vehiculo.activo:
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    "No se puede cambiar el estado de un vehículo dado de baja",
                )
            vehiculo.estado = pb.EstadoVehiculo.Name(request.estado)
            sesion.commit()
            return _mensaje(vehiculo)

    def BuscarVehiculosDisponibles(self, request, context):
        inicio = _fecha(request.fecha_inicio, context)
        fin = _fecha(request.fecha_fin, context)
        if inicio >= fin:
            context.abort(INVALIDO, "La fecha de fin debe ser posterior a la de inicio")
        if inicio < datetime.now(timezone.utc):
            context.abort(INVALIDO, "La fecha de inicio debe ser futura")

        # Para aparecer, un vehículo tiene que estar activo y DISPONIBLE.
        consulta = select(Vehiculo).where(
            Vehiculo.activo.is_(True), Vehiculo.estado == "DISPONIBLE"
        )
        if request.excluidos:
            consulta = consulta.where(Vehiculo.id.not_in(request.excluidos))
        if request.tipo:
            consulta = consulta.where(Vehiculo.tipo == pb.TipoVehiculo.Name(request.tipo))
        if request.marca:
            consulta = consulta.where(Vehiculo.marca.ilike(f"%{request.marca}%"))
        if request.modelo:
            consulta = consulta.where(Vehiculo.modelo.ilike(f"%{request.modelo}%"))
        if request.HasField("precio_min"):
            minimo = _precio_filtro(request.precio_min, context)
            consulta = consulta.where(Vehiculo.precio_diario >= minimo)
        if request.HasField("precio_max"):
            maximo = _precio_filtro(request.precio_max, context)
            consulta = consulta.where(Vehiculo.precio_diario <= maximo)

        consulta = consulta.order_by(Vehiculo.precio_diario, Vehiculo.id)
        with self.sesiones() as sesion:
            return pb.ListaVehiculos(vehiculos=[_mensaje(v) for v in sesion.scalars(consulta)])

    def ValidarVehiculoParaReserva(self, request, context):
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            if not vehiculo.activo:
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    f"El vehículo con id {request.id} no está activo",
                )
            return _mensaje(vehiculo)
