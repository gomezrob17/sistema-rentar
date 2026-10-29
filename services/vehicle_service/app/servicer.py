import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import grpc
from messaging import EXTERNOS_REGISTRADOS, VERIFICACION_SOLICITADA
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.db import (
    ESTADO_EXTERNO_PROTO,
    RESULTADO_VALIDACION_PROTO,
    TIPOS,
    Vehiculo,
    VehiculoExterno,
)
from app.generated.rentar.vehiculos.v1 import vehicle_pb2 as pb
from app.generated.rentar.vehiculos.v1 import vehicle_pb2_grpc as pb_grpc

log = logging.getLogger(__name__)

INVALIDO = grpc.StatusCode.INVALID_ARGUMENT

# Los enums de proto llevan el prefijo del enum; en la base y en la API se usan
# los nombres de dominio.
PREFIJO_TIPO = "TIPO_VEHICULO_"
PREFIJO_ESTADO = "ESTADO_VEHICULO_"
PREFIJO_VERIFICACION = "VERIFICACION_VEHICULO_"

# Número del enum TipoVehiculo -> nombre que se guarda en la base ("SEDAN", ...).
NOMBRE_TIPO = {
    valor: nombre.removeprefix(PREFIJO_TIPO)
    for nombre, valor in pb.TipoVehiculo.items()
}


def _proto_tipo(nombre: str) -> str:
    return f"{PREFIJO_TIPO}{nombre}"


def _proto_estado(nombre: str) -> str:
    return f"{PREFIJO_ESTADO}{nombre}"


def _proto_verificacion(nombre: str) -> str:
    return f"{PREFIJO_VERIFICACION}{nombre}"

# Campos de vehículo que pueden venir en un alta o en una edición.
CAMPOS = ("patente", "marca", "modelo", "anio", "color", "tipo", "precio_diario")
# El alta externa agrega el cliente, que sale del token en el Gateway.
CAMPOS_EXTERNOS = ("cliente_id",) + CAMPOS

# Validaciones propias del vehículo: campo -> (regla, mensaje si no se cumple).
REGLAS = {
    "cliente_id": (lambda v: v > 0, "El cliente es obligatorio"),
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

# La patente se guarda y compara normalizada para que "ab-123-cd" y "AB123CD"
# no puedan convivir como vehículos distintos.
def _normalizar_patente(patente: str) -> str:
    return patente.upper().replace(" ", "").replace("-", "")


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
        tipo=_proto_tipo(v.tipo),
        precio_diario=_precio(v.precio_diario),
        estado=_proto_estado(v.estado),
        activo=v.activo,
        created_at=_iso(v.created_at),
        updated_at=_iso(v.updated_at),
        verificacion=_proto_verificacion(v.verificacion),
    )


def _mensaje_externo(e: VehiculoExterno) -> pb.VehiculoExterno:
    resultado = {
        "id": e.id,
        "cliente_id": e.cliente_id,
        "patente": e.patente,
        "marca": e.marca,
        "modelo": e.modelo,
        "anio": e.anio,
        "tipo": _proto_tipo(e.tipo),
        "precio_diario": _precio(e.precio_diario),
        "estado": ESTADO_EXTERNO_PROTO[e.estado],
        "created_at": _iso(e.created_at),
        "updated_at": _iso(e.updated_at),
    }
    if e.color is not None:
        resultado["color"] = e.color
    if e.validacion_patente is not None:
        resultado["validacion_patente"] = RESULTADO_VALIDACION_PROTO[e.validacion_patente]
    if e.validacion_titularidad is not None:
        resultado["validacion_titularidad"] = RESULTADO_VALIDACION_PROTO[
            e.validacion_titularidad
        ]
    if e.vehiculo_id is not None:
        resultado["vehiculo_id"] = e.vehiculo_id
    if e.motivo_rechazo:
        resultado["motivo_rechazo"] = e.motivo_rechazo
    return pb.VehiculoExterno(**resultado)


def _leer_campos(request, context, campos=CAMPOS) -> dict:
    """Toma los campos enviados (en una edición, solo los presentes) y los valida."""
    datos = {}
    for campo in campos:
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
    def __init__(self, sesiones, publicar):
        self.sesiones = sesiones
        # publicar(routing_key, payload): en producción messaging.publicar; en los tests, uno falso.
        self.publicar = publicar

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
        # Recién después del commit se pide la verificación. Si el broker falla, el alta no se
        # revierte: el vehículo queda PENDIENTE y operativo. Límite conocido: un outbox
        # transaccional evitaría perder el pedido.
        try:
            self.publicar(VERIFICACION_SOLICITADA, {"vehiculoId": vehiculo.id, "patente": vehiculo.patente})
        except Exception:
            log.exception("No se pudo pedir la verificación del vehículo %s; queda PENDIENTE", vehiculo.id)
        return pb.CrearVehiculoResponse(vehiculo=_mensaje(vehiculo))

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
            consulta = consulta.where(Vehiculo.tipo == pb.TipoVehiculo.Name(request.tipo).removeprefix(PREFIJO_TIPO))
        with self.sesiones() as sesion:
            return pb.ListarVehiculosResponse(
                vehiculos=[_mensaje(v) for v in sesion.scalars(consulta)]
            )

    def BuscarVehiculoPorId(self, request, context):
        with self.sesiones() as sesion:
            return pb.BuscarVehiculoPorIdResponse(
                vehiculo=_mensaje(self._buscar(sesion, request.id, context))
            )

    def ActualizarVehiculo(self, request, context):
        datos = _leer_campos(request, context)
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            for campo, valor in datos.items():
                setattr(vehiculo, campo, valor)
            sesion.commit()
            return pb.ActualizarVehiculoResponse(vehiculo=_mensaje(vehiculo))

    def DarDeBajaVehiculo(self, request, context):
        # Baja lógica: no se borra el registro, solo se marca como inactivo.
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            vehiculo.activo = False
            sesion.commit()
            return pb.DarDeBajaVehiculoResponse(vehiculo=_mensaje(vehiculo))

    def ActualizarEstadoVehiculo(self, request, context):
        if request.estado == pb.ESTADO_VEHICULO_UNSPECIFIED:
            context.abort(INVALIDO, "El estado del vehículo no es válido")
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            if not vehiculo.activo:
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    "No se puede cambiar el estado de un vehículo dado de baja",
                )
            if vehiculo.verificacion == "ROBADO":
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    "No se puede cambiar el estado de un vehículo inhabilitado por denuncia de robo",
                )
            vehiculo.estado = pb.EstadoVehiculo.Name(request.estado).removeprefix(PREFIJO_ESTADO)
            sesion.commit()
            return pb.ActualizarEstadoVehiculoResponse(vehiculo=_mensaje(vehiculo))

    def BuscarVehiculosDisponibles(self, request, context):
        inicio = _fecha(request.fecha_inicio, context)
        fin = _fecha(request.fecha_fin, context)
        if inicio >= fin:
            context.abort(INVALIDO, "La fecha de fin debe ser posterior a la de inicio")
        if inicio < datetime.now(timezone.utc):
            context.abort(INVALIDO, "La fecha de inicio debe ser futura")

        # Para aparecer, un vehículo tiene que estar activo, DISPONIBLE y no inhabilitado por robo.
        consulta = select(Vehiculo).where(
            Vehiculo.activo.is_(True),
            Vehiculo.estado == "DISPONIBLE",
            Vehiculo.verificacion != "ROBADO",
        )
        if request.excluidos:
            consulta = consulta.where(Vehiculo.id.not_in(request.excluidos))
        if request.tipo:
            consulta = consulta.where(Vehiculo.tipo == pb.TipoVehiculo.Name(request.tipo).removeprefix(PREFIJO_TIPO))
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
            return pb.BuscarVehiculosDisponiblesResponse(
                vehiculos=[_mensaje(v) for v in sesion.scalars(consulta)]
            )

    def ValidarVehiculoParaReserva(self, request, context):
        with self.sesiones() as sesion:
            vehiculo = self._buscar(sesion, request.id, context)
            if not vehiculo.activo:
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    f"El vehículo con id {request.id} no está activo",
                )
            if vehiculo.verificacion == "ROBADO":
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    f"El vehículo con id {request.id} está inhabilitado por denuncia de robo",
                )
            return pb.ValidarVehiculoParaReservaResponse(vehiculo=_mensaje(vehiculo))

    def _buscar_externo(self, sesion, id: int, context) -> VehiculoExterno:
        externo = sesion.get(VehiculoExterno, id)
        if externo is None:
            context.abort(
                grpc.StatusCode.NOT_FOUND,
                f"No se encontró el vehículo externo con id {id}",
            )
        return externo

    def RegistrarVehiculoExterno(self, request, context):
        datos = _leer_campos(request, context, CAMPOS_EXTERNOS)
        datos["patente"] = _normalizar_patente(datos["patente"])
        if not datos["patente"]:
            context.abort(INVALIDO, "La patente es obligatoria")

        with self.sesiones() as sesion:
            # La patente no puede pertenecer ya a la flota ni a otra solicitud.
            patente_flota = sesion.scalar(
                select(Vehiculo).where(
                    func.upper(func.replace(func.replace(Vehiculo.patente, " ", ""), "-", ""))
                    == datos["patente"]
                )
            )
            if patente_flota is not None:
                context.abort(
                    grpc.StatusCode.ALREADY_EXISTS,
                    f"Ya existe un vehículo con la patente {datos['patente']}",
                )
            externo_existente = sesion.scalar(
                select(VehiculoExterno).where(VehiculoExterno.patente == datos["patente"])
            )
            if externo_existente is not None:
                context.abort(
                    grpc.StatusCode.ALREADY_EXISTS,
                    f"Ya existe una solicitud de incorporación para la patente {datos['patente']}",
                )

            externo = VehiculoExterno(**datos, estado="PENDIENTE")
            sesion.add(externo)
            try:
                sesion.commit()
            except IntegrityError:
                context.abort(
                    grpc.StatusCode.ALREADY_EXISTS,
                    f"Ya existe una solicitud de incorporación para la patente {datos['patente']}",
                )

        # Se pide la validación después del commit. Si el broker falla, la solicitud
        # queda PENDIENTE y puede reintentarse; no se revierte el alta.
        try:
            self.publicar(
                EXTERNOS_REGISTRADOS,
                {
                    "vehiculoExternoId": externo.id,
                    "clienteId": externo.cliente_id,
                    "patente": externo.patente,
                },
                str(externo.id),
            )
        except Exception:
            log.exception(
                "No se pudo solicitar la incorporación del vehículo externo %s; queda PENDIENTE",
                externo.id,
            )
        return pb.RegistrarVehiculoExternoResponse(vehiculo_externo=_mensaje_externo(externo))

    def BuscarVehiculoExternoPorId(self, request, context):
        with self.sesiones() as sesion:
            return pb.BuscarVehiculoExternoPorIdResponse(
                vehiculo_externo=_mensaje_externo(
                    self._buscar_externo(sesion, request.id, context)
                )
            )

    def ListarVehiculosExternos(self, request, context):
        consulta = select(VehiculoExterno)
        if request.HasField("cliente_id"):
            consulta = consulta.where(VehiculoExterno.cliente_id == request.cliente_id)
        consulta = consulta.order_by(VehiculoExterno.id)
        with self.sesiones() as sesion:
            return pb.ListarVehiculosExternosResponse(
                vehiculos_externos=[
                    _mensaje_externo(externo) for externo in sesion.scalars(consulta)
                ]
            )
