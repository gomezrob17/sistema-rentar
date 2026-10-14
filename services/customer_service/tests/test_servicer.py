import grpc
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.generated import customer_pb2 as pb
from app.servicer import CustomerServicer, asegurar_admin


class Abortado(Exception):
    pass


class Contexto:
    """Imita el context de gRPC: abort corta la ejecución con el código y el mensaje."""

    def abort(self, codigo, mensaje):
        raise Abortado(codigo, mensaje)


ctx = Contexto()


@pytest.fixture
def svc():
    # ponytail: SQLite en memoria para probar las reglas sin levantar Postgres.
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return CustomerServicer(sessionmaker(engine, expire_on_commit=False))


def crear(svc, documento="30123456", **cambios):
    datos = dict(
        documento=documento,
        nombre="Juan",
        apellido="Perez",
        email=f"{documento}@example.test",
    )
    return svc.CrearCliente(pb.CrearClienteRequest(**(datos | cambios)), ctx)


def error(llamada):
    with pytest.raises(Abortado) as e:
        llamada()
    return e.value.args


def test_alta_queda_activa_y_devuelve_los_datos(svc):
    c = crear(svc, telefono="1123456789", fecha_nacimiento="1990-05-20")
    assert (c.documento, c.nombre, c.apellido) == ("30123456", "Juan", "Perez")
    assert (c.activo, c.telefono, c.fecha_nacimiento) == (True, "1123456789", "1990-05-20T00:00:00.000Z")


def test_sin_telefono_ni_fecha_quedan_ausentes(svc):
    c = crear(svc)
    assert not c.HasField("telefono")
    assert not c.HasField("fecha_nacimiento")


@pytest.mark.parametrize(
    "cambios, mensaje",
    [
        ({"documento": " "}, "El documento es obligatorio"),
        ({"nombre": " "}, "El nombre es obligatorio"),
        ({"apellido": " "}, "El apellido es obligatorio"),
        ({"email": "sin-arroba"}, "El email no es válido"),
        ({"fecha_nacimiento": "ayer"}, "La fecha de nacimiento 'ayer' no es válida"),
    ],
)
def test_validaciones_del_alta(svc, cambios, mensaje):
    assert error(lambda: crear(svc, **cambios)) == (grpc.StatusCode.INVALID_ARGUMENT, mensaje)


def test_documento_repetido(svc):
    crear(svc, documento="30123456")
    respuesta = error(lambda: crear(svc, documento="30123456", email="otro@example.test"))
    assert respuesta == (
        grpc.StatusCode.ALREADY_EXISTS,
        "Ya existe un cliente con ese documento o email",
    )


def test_email_repetido(svc):
    crear(svc, documento="30123456", email="juan@example.test")
    respuesta = error(lambda: crear(svc, documento="99887766", email="juan@example.test"))
    assert respuesta == (
        grpc.StatusCode.ALREADY_EXISTS,
        "Ya existe un cliente con ese documento o email",
    )


def test_edicion_parcial(svc):
    c = crear(svc, telefono="1123456789")
    editado = svc.ActualizarCliente(
        pb.ActualizarClienteRequest(id=c.id, nombre="Pedro"), ctx
    )
    assert (editado.nombre, editado.apellido, editado.telefono) == ("Pedro", "Perez", "1123456789")


def test_edicion_con_documento_o_email_de_otro(svc):
    crear(svc, documento="30123456")
    otro = crear(svc, documento="99887766")
    assert error(
        lambda: svc.ActualizarCliente(
            pb.ActualizarClienteRequest(id=otro.id, documento="30123456"), ctx
        )
    ) == (grpc.StatusCode.ALREADY_EXISTS, "Ya existe otro cliente con ese documento")
    assert error(
        lambda: svc.ActualizarCliente(
            pb.ActualizarClienteRequest(id=otro.id, email="30123456@example.test"), ctx
        )
    ) == (grpc.StatusCode.ALREADY_EXISTS, "Ya existe otro cliente con ese email")


def test_inexistente(svc):
    assert error(lambda: svc.BuscarClientePorId(pb.ClienteId(id=99), ctx)) == (
        grpc.StatusCode.NOT_FOUND,
        "No se encontró el cliente con id 99",
    )


def test_baja_logica_y_validacion_para_reserva(svc):
    c = crear(svc)
    assert svc.ValidarClienteParaReserva(pb.ClienteId(id=c.id), ctx).activo is True
    baja = svc.DarDeBajaCliente(pb.ClienteId(id=c.id), ctx)
    assert baja.activo is False
    assert error(lambda: svc.ValidarClienteParaReserva(pb.ClienteId(id=c.id), ctx)) == (
        grpc.StatusCode.FAILED_PRECONDITION,
        f"El cliente con id {c.id} no está activo",
    )


def test_existe_cliente(svc):
    c = crear(svc)
    assert svc.ExisteCliente(pb.ClienteId(id=c.id), ctx).existe is True
    assert svc.ExisteCliente(pb.ClienteId(id=999), ctx).existe is False


def test_listar_combina_filtros(svc):
    juan = crear(svc, documento="30123456", nombre="Juan", apellido="Perez")
    ana = crear(svc, documento="99887766", nombre="Ana", apellido="Gomez")
    svc.DarDeBajaCliente(pb.ClienteId(id=ana.id), ctx)

    assert [c.id for c in svc.ListarClientes(pb.FiltroClientes(), ctx).clientes] == [
        juan.id,
        ana.id,
    ]
    # La baja lógica no lo excluye de listar (igual que el listado de Hito 1).
    porTexto = pb.FiltroClientes(texto="gomez")
    assert [c.id for c in svc.ListarClientes(porTexto, ctx).clientes] == [ana.id]
    porId = pb.FiltroClientes(ids=[juan.id])
    assert [c.id for c in svc.ListarClientes(porId, ctx).clientes] == [juan.id]


def autenticar(svc, email, password):
    return svc.Autenticar(pb.Credenciales(email=email, password=password), ctx)


def test_alta_crea_el_usuario_con_contrasena_temporal(svc):
    c = crear(svc, email="Juan@Example.test")
    # El email no distingue mayúsculas ni espacios al iniciar sesión.
    u = autenticar(svc, " juan@example.TEST ", f"Usuario{c.id}*")
    assert (u.rol, u.cliente_id, u.nombre, u.email) == (pb.CLIENTE, c.id, "Juan Perez", "Juan@Example.test")


def test_login_rechaza_credenciales_invalidas_y_cliente_dado_de_baja(svc):
    c = crear(svc)
    incorrecto = (grpc.StatusCode.UNAUTHENTICATED, "Email o contraseña incorrectos")
    assert error(lambda: autenticar(svc, c.email, "mala")) == incorrecto
    assert error(lambda: autenticar(svc, "nadie@example.test", "Usuario1*")) == incorrecto
    svc.DarDeBajaCliente(pb.ClienteId(id=c.id), ctx)
    assert error(lambda: autenticar(svc, c.email, f"Usuario{c.id}*")) == incorrecto


def test_cambio_de_contrasena(svc):
    c = crear(svc)
    temporal = f"Usuario{c.id}*"
    u = autenticar(svc, c.email, temporal)

    def cambiar(actual, nueva):
        pedido = pb.CambiarContrasenaRequest(usuario_id=u.usuario_id, actual=actual, nueva=nueva)
        return svc.CambiarContrasena(pedido, ctx)

    assert error(lambda: cambiar("mala", "NuevaClave123")) == (
        grpc.StatusCode.UNAUTHENTICATED,
        "La contraseña actual es incorrecta",
    )
    assert error(lambda: cambiar(temporal, "corta"))[0] == grpc.StatusCode.INVALID_ARGUMENT
    cambiar(temporal, "NuevaClave123")
    assert autenticar(svc, c.email, "NuevaClave123").usuario_id == u.usuario_id
    assert error(lambda: autenticar(svc, c.email, temporal))[0] == grpc.StatusCode.UNAUTHENTICATED


def test_editar_el_email_actualiza_el_del_usuario(svc):
    c = crear(svc)
    svc.ActualizarCliente(pb.ActualizarClienteRequest(id=c.id, email="nuevo@example.test"), ctx)
    assert autenticar(svc, "nuevo@example.test", f"Usuario{c.id}*").cliente_id == c.id


def test_admin_sembrado_inicia_sesion_sin_cliente(svc):
    assert asegurar_admin(svc.sesiones, "admin@example.test", "Admin123") is True
    # Si ya existe, no se duplica ni se pisa su contraseña.
    assert asegurar_admin(svc.sesiones, "ADMIN@example.test", "otra") is False
    u = autenticar(svc, "admin@example.test", "Admin123")
    assert (u.rol, u.HasField("cliente_id"), u.nombre) == (pb.ADMIN, False, "Administrador")
