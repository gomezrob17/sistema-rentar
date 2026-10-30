import re
from datetime import datetime, timezone

import bcrypt
import grpc
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.db import Cliente, Usuario
from app.generated.rentar.clientes.v1 import customer_pb2 as pb
from app.generated.rentar.clientes.v1 import customer_pb2_grpc as pb_grpc

INVALIDO = grpc.StatusCode.INVALID_ARGUMENT
NO_ENCONTRADO = grpc.StatusCode.NOT_FOUND
YA_EXISTE = grpc.StatusCode.ALREADY_EXISTS

# El enum de proto lleva el prefijo ROL_USUARIO_; en la base y en la API se usa
# el nombre de dominio.
PREFIJO_ROL = "ROL_USUARIO_"


def _proto_rol(nombre: str) -> str:
    return f"{PREFIJO_ROL}{nombre}"

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


def _hash(password: str) -> str:
    # Costo 12, igual que Hito 1: los hashes de Node (bcrypt) y de Python son compatibles.
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def _coincide(password: str, hash_guardado: str) -> bool:
    return bcrypt.checkpw(password.encode(), hash_guardado.encode())


def asegurar_admin(sesiones, email: str, password: str) -> bool:
    """Crea el usuario administrador si todavía no existe. Devuelve True si lo creó."""
    with sesiones() as sesion:
        existente = sesion.scalar(
            select(Usuario).where(func.lower(Usuario.email) == email.strip().lower())
        )
        if existente:
            return False
        sesion.add(Usuario(email=email.strip(), password_hash=_hash(password), rol="ADMIN"))
        sesion.commit()
        return True


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
                # flush asigna el id, que forma parte de la contraseña temporal.
                sesion.flush()
                sesion.add(
                    Usuario(
                        email=cliente.email,
                        password_hash=_hash(f"Usuario{cliente.id}*"),
                        rol="CLIENTE",
                        cliente_id=cliente.id,
                    )
                )
                sesion.commit()
            except IntegrityError:
                context.abort(YA_EXISTE, "Ya existe un cliente con ese documento o email")
            return pb.CrearClienteResponse(cliente=_mensaje(cliente))

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
            return pb.ListarClientesResponse(
                clientes=[_mensaje(c) for c in sesion.scalars(consulta)]
            )

    def BuscarClientePorId(self, request, context):
        with self.sesiones() as sesion:
            return pb.BuscarClientePorIdResponse(
                cliente=_mensaje(self._buscar(sesion, request.id, context))
            )

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
            if "email" in datos:
                # El usuario del cliente inicia sesión con el mismo email.
                usuario = sesion.scalar(select(Usuario).where(Usuario.cliente_id == cliente.id))
                if usuario:
                    usuario.email = datos["email"]
            try:
                sesion.commit()
            except IntegrityError:
                context.abort(YA_EXISTE, "Ya existe otro usuario con ese email")
            return pb.ActualizarClienteResponse(cliente=_mensaje(cliente))

    def DarDeBajaCliente(self, request, context):
        # Baja lógica: no se borra el registro, solo se marca como inactivo.
        with self.sesiones() as sesion:
            cliente = self._buscar(sesion, request.id, context)
            cliente.activo = False
            sesion.commit()
            return pb.DarDeBajaClienteResponse(cliente=_mensaje(cliente))

    def ExisteCliente(self, request, context):
        with self.sesiones() as sesion:
            return pb.ExisteClienteResponse(
                existe=sesion.get(Cliente, request.id) is not None
            )

    def ValidarClienteParaReserva(self, request, context):
        with self.sesiones() as sesion:
            cliente = self._buscar(sesion, request.id, context)
            if not cliente.activo:
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    f"El cliente con id {request.id} no está activo",
                )
            return pb.ValidarClienteParaReservaResponse(cliente=_mensaje(cliente))

    def Autenticar(self, request, context):
        email = request.email.strip().lower()
        with self.sesiones() as sesion:
            usuario = sesion.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
            cliente = sesion.get(Cliente, usuario.cliente_id) if usuario and usuario.cliente_id else None
            # Un CLIENTE solo entra si su cliente sigue activo; el ADMIN no tiene cliente.
            habilitado = usuario is not None and usuario.activo and (
                usuario.rol == "ADMIN" or (cliente is not None and cliente.activo)
            )
            # Mismo mensaje para cualquier falla, para no revelar qué dato es incorrecto.
            if not habilitado or not _coincide(request.password, usuario.password_hash):
                context.abort(grpc.StatusCode.UNAUTHENTICATED, "Email o contraseña incorrectos")
            return pb.AutenticarResponse(
                usuario=pb.UsuarioAutenticado(
                    usuario_id=usuario.id,
                    rol=_proto_rol(usuario.rol),
                    cliente_id=cliente.id if cliente else None,
                    nombre=f"{cliente.nombre} {cliente.apellido}" if cliente else "Administrador",
                    email=usuario.email,
                )
            )

    def CambiarContrasena(self, request, context):
        if len(request.nueva) < 8:
            context.abort(INVALIDO, "La contraseña nueva debe tener al menos 8 caracteres")
        with self.sesiones() as sesion:
            usuario = sesion.get(Usuario, request.usuario_id)
            if usuario is None or not usuario.activo:
                context.abort(grpc.StatusCode.UNAUTHENTICATED, "Usuario no válido")
            if not _coincide(request.actual, usuario.password_hash):
                context.abort(grpc.StatusCode.UNAUTHENTICATED, "La contraseña actual es incorrecta")
            usuario.password_hash = _hash(request.nueva)
            sesion.commit()
            return pb.CambiarContrasenaResponse()
