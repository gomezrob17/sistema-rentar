import re
from datetime import datetime, timezone

import grpc
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.db import Cliente
from app.generated import customer_pb2 as pb
from app.generated import customer_pb2_grpc as pb_grpc

INVALIDO = grpc.StatusCode.INVALID_ARGUMENT
NO_ENCONTRADO = grpc.StatusCode.NOT_FOUND
YA_EXISTE = grpc.StatusCode.ALREADY_EXISTS

# Mismo criterio laxo que el validador IsEmail de class-validator en el gateway.
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Campos de cliente que pueden venir en un alta o en una edición.
CAMPOS = ("documento", "nombre", "apellido", "email", "telefono", "fecha_nacimiento")

# Validaciones propias del cliente: campo -> (regla, mensaje si no se cumple).
REGLAS = {
    "documento": (lambda v: v.strip() != "", "El documento es obligatorio"),
    "nombre": (lambda v: v.strip() != "", "El nombre es obligatorio"),
    "apellido": (lambda v: v.strip() != "", "El apellido es obligatorio"),
    "email": (lambda v: bool(EMAIL.match(v.strip())), "El email no es válido"),
}


def _fecha(texto: str, context) -> datetime:
    try:
        fecha = datetime.fromisoformat(texto)
    except ValueError:
        context.abort(INVALIDO, f"La fecha de nacimiento {texto!r} no es válida")
    # Prisma guardaba la fecha sin zona horaria.
    return fecha.replace(tzinfo=None) if fecha.tzinfo else fecha


def _iso(fecha: datetime) -> str:
    # Mismo formato que devolvía Hito 1: UTC con milisegundos y "Z".
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    texto = fecha.astimezone(timezone.utc).isoformat(timespec="milliseconds")
    return texto.replace("+00:00", "Z")


def _mensaje(c: Cliente) -> pb.Cliente:
    return pb.Cliente(
        id=c.id,
        documento=c.documento,
        nombre=c.nombre,
        apellido=c.apellido,
        email=c.email,
        telefono=c.telefono,
        fecha_nacimiento=_iso(c.fecha_nacimiento) if c.fecha_nacimiento else None,
        activo=c.activo,
        created_at=_iso(c.created_at),
        updated_at=_iso(c.updated_at),
    )


def _leer_campos(request, context) -> dict:
    """Toma los campos enviados (en una edición, solo los presentes) y los valida."""
    datos = {}
    for campo in CAMPOS:
        descriptor = request.DESCRIPTOR.fields_by_name.get(campo)
        if descriptor is None or (descriptor.has_presence and not request.HasField(campo)):
            continue
        datos[campo] = getattr(request, campo)
    for campo, valor in datos.items():
        regla = REGLAS.get(campo)
        if regla and not regla[0](valor):
            context.abort(INVALIDO, regla[1])
    if "fecha_nacimiento" in datos:
        datos["fecha_nacimiento"] = _fecha(datos["fecha_nacimiento"], context)
    return datos


class CustomerServicer(pb_grpc.CustomerServiceServicer):
    def __init__(self, sesiones):
        self.sesiones = sesiones

    def _buscar(self, sesion, id: int, context) -> Cliente:
        cliente = sesion.get(Cliente, id)
        if cliente is None:
            context.abort(NO_ENCONTRADO, f"No se encontró el cliente con id {id}")
        return cliente

    def CrearCliente(self, request, context):
        datos = _leer_campos(request, context)
        with self.sesiones() as sesion:
            existente = sesion.scalar(
                select(Cliente).where(
                    or_(
                        Cliente.documento == datos["documento"],
                        Cliente.email == datos["email"],
                    )
                )
            )
            if existente:
                context.abort(YA_EXISTE, "Ya existe un cliente con ese documento o email")
            cliente = Cliente(**datos)
            sesion.add(cliente)
            try:
                sesion.commit()
            except IntegrityError:
                context.abort(YA_EXISTE, "Ya existe un cliente con ese documento o email")
            return _mensaje(cliente)

    def ListarClientes(self, request, context):
        consulta = select(Cliente).order_by(Cliente.id)
        if request.ids:
            consulta = consulta.where(Cliente.id.in_(request.ids))
        texto = request.texto.strip()
        if texto:
            patron = f"%{texto}%"
            consulta = consulta.where(
                or_(
                    Cliente.nombre.ilike(patron),
                    Cliente.apellido.ilike(patron),
                    Cliente.documento.ilike(patron),
                    Cliente.email.ilike(patron),
                )
            )
        with self.sesiones() as sesion:
            return pb.ListaClientes(
                clientes=[_mensaje(c) for c in sesion.scalars(consulta)]
            )

    def BuscarClientePorId(self, request, context):
        with self.sesiones() as sesion:
            return _mensaje(self._buscar(sesion, request.id, context))

    def ActualizarCliente(self, request, context):
        datos = _leer_campos(request, context)
        with self.sesiones() as sesion:
            cliente = self._buscar(sesion, request.id, context)
            if "documento" in datos:
                otro = sesion.scalar(
                    select(Cliente).where(
                        Cliente.documento == datos["documento"],
                        Cliente.id != request.id,
                    )
                )
                if otro:
                    context.abort(YA_EXISTE, "Ya existe otro cliente con ese documento")
            if "email" in datos:
                otro = sesion.scalar(
                    select(Cliente).where(
                        Cliente.email == datos["email"],
                        Cliente.id != request.id,
                    )
                )
                if otro:
                    context.abort(YA_EXISTE, "Ya existe otro cliente con ese email")
            for campo, valor in datos.items():
                setattr(cliente, campo, valor)
            sesion.commit()
            return _mensaje(cliente)

    def DarDeBajaCliente(self, request, context):
        # Baja lógica: no se borra el registro, solo se marca como inactivo.
        with self.sesiones() as sesion:
            cliente = self._buscar(sesion, request.id, context)
            cliente.activo = False
            sesion.commit()
            return _mensaje(cliente)

    def ExisteCliente(self, request, context):
        with self.sesiones() as sesion:
            return pb.Existencia(existe=sesion.get(Cliente, request.id) is not None)

    def ValidarClienteParaReserva(self, request, context):
        with self.sesiones() as sesion:
            cliente = self._buscar(sesion, request.id, context)
            if not cliente.activo:
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    f"El cliente con id {request.id} no está activo",
                )
            return _mensaje(cliente)
