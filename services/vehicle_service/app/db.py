import os
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Numeric, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.generated import vehicle_pb2 as pb

# Los valores válidos salen del contrato, sin el *_SIN_ESPECIFICAR (valor 0).
TIPOS = pb.TipoVehiculo.keys()[1:]
ESTADOS = pb.EstadoVehiculo.keys()[1:]
VERIFICACIONES = pb.VerificacionVehiculo.keys()[1:]

engine = create_engine(
    os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://rentar:rentar@localhost:5432/rentar_vehiculos",
    )
)
Session = sessionmaker(engine, expire_on_commit=False)


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# Mismas columnas que el modelo Vehiculo de Hito 1 (Prisma), en snake_case.
class Vehiculo(Base):
    __tablename__ = "vehiculos"

    id: Mapped[int] = mapped_column(primary_key=True)
    patente: Mapped[str] = mapped_column(unique=True)
    marca: Mapped[str]
    modelo: Mapped[str]
    anio: Mapped[int]
    color: Mapped[str | None]
    tipo: Mapped[str] = mapped_column(Enum(*TIPOS, name="tipo_vehiculo"))
    precio_diario: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    estado: Mapped[str] = mapped_column(
        Enum(*ESTADOS, name="estado_vehiculo"), default="DISPONIBLE"
    )
    activo: Mapped[bool] = mapped_column(default=True)
    # Hito 3: resultado de la verificación policial, independiente del estado.
    verificacion: Mapped[str] = mapped_column(
        Enum(*VERIFICACIONES, name="verificacion_vehiculo"), default="PENDIENTE"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=ahora, onupdate=ahora
    )


def migrar():
    """Agrega la columna de Hito 3 a una tabla vehiculos creada antes (create_all no agrega columnas).

    Idempotente: no hace nada si el tipo y la columna ya existen. Los vehículos anteriores
    quedan con verificación PENDIENTE.
    """
    valores = ", ".join(f"'{v}'" for v in VERIFICACIONES)
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "DO $$ BEGIN "
                f"CREATE TYPE verificacion_vehiculo AS ENUM ({valores}); "
                "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
            )
        )
        conexion.execute(
            text(
                "ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS verificacion "
                "verificacion_vehiculo NOT NULL DEFAULT 'PENDIENTE'"
            )
        )
