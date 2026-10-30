import os
from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

engine = create_engine(
    os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://rentar:rentar@localhost:5432/rentar_verificaciones",
    )
)
Session = sessionmaker(engine, expire_on_commit=False)

# Registro inicial que simula la información policial. ROB123 es la patente fija
# para las pruebas.
DENUNCIAS = {
    "ROB123": date(2026, 1, 15),
    "AC452KL": date(2025, 11, 3),
    "AD903RT": date(2026, 6, 21),
    "KZT481": date(2024, 8, 9),
}

# Registro externo de titularidad simulado. El documento se compara con el del
# cliente que pide la incorporación (se obtiene del Customer Service por gRPC).
TITULARIDADES = {
    "DEF456": "30123456",
    "ABC123": "30123456",
    "AE321KL": "30123456",
    "GHI789": "30123456",
    "JKL012": "30123456",
    # Patente con un titular distinto para probar el rechazo.
    "XYZ999": "99999999",
}


class Base(DeclarativeBase):
    pass


# Registro propio de patentes con denuncia de robo.
class PatenteRobada(Base):
    __tablename__ = "patentes_robadas"

    # Normalizada: mayúsculas, sin espacios ni guiones.
    patente: Mapped[str] = mapped_column(primary_key=True)
    fecha_denuncia: Mapped[date]


# Registro externo de titularidad simulado: patente -> documento del titular.
class Titularidad(Base):
    __tablename__ = "titularidades"

    patente: Mapped[str] = mapped_column(primary_key=True)
    documento: Mapped[str]


def crear_base_si_no_existe():
    """El init de Postgres solo corre con el volumen vacío; con el volumen de Hito 2 la base no existe."""
    nombre = engine.url.database
    admin = create_engine(engine.url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conexion:
        existe = conexion.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :nombre"), {"nombre": nombre}
        )
        if not existe:
            conexion.execute(text(f'CREATE DATABASE "{nombre}"'))
            print(f"Base {nombre} creada", flush=True)
    admin.dispose()


def cargar_denuncias(sesiones):
    """Carga las denuncias iniciales que falten. Se puede correr en cada arranque."""
    with sesiones() as sesion:
        for patente, fecha in DENUNCIAS.items():
            if sesion.get(PatenteRobada, patente) is None:
                sesion.add(PatenteRobada(patente=patente, fecha_denuncia=fecha))
        sesion.commit()


def cargar_titularidades(sesiones):
    """Carga los titulares simulados que falten. Se puede correr en cada arranque."""
    with sesiones() as sesion:
        for patente, documento in TITULARIDADES.items():
            if sesion.get(Titularidad, patente) is None:
                sesion.add(Titularidad(patente=patente, documento=documento))
        sesion.commit()
