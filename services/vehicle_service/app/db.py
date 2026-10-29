import os
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Numeric, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

# Los valores de la base y de la API son los nombres de dominio, sin el prefijo
# del enum de proto y sin el valor cero (*_UNSPECIFIED).
TIPOS = ("SEDAN", "SUV", "PICKUP", "COUPE", "HATCHBACK")
ESTADOS = ("DISPONIBLE", "RESERVADO", "EN_ALQUILER")
VERIFICACIONES = ("PENDIENTE", "VALIDADO", "ROBADO")

# El contrato usa nombres de enum con prefijo para no chocar entre sí; en la base
# y en la API se guardan los nombres de dominio.
ESTADOS_EXTERNOS = ("PENDIENTE", "APROBADO", "RECHAZADO")
NOMBRE_ESTADO_EXTERNO = {
    "ESTADO_VEHICULO_EXTERNO_PENDIENTE": "PENDIENTE",
    "ESTADO_VEHICULO_EXTERNO_APROBADO": "APROBADO",
    "ESTADO_VEHICULO_EXTERNO_RECHAZADO": "RECHAZADO",
}
RESULTADOS_VALIDACION = ("VALIDADO", "RECHAZADO")
NOMBRE_RESULTADO_VALIDACION = {
    "RESULTADO_VALIDACION_VALIDADO": "VALIDADO",
    "RESULTADO_VALIDACION_RECHAZADO": "RECHAZADO",
}
# Un solo tipo de enum para las dos columnas de resultado.
RESULTADO_VALIDACION_DB = Enum(*RESULTADOS_VALIDACION, name="resultado_validacion")

# Nombres de dominio -> nombres del enum de proto.
ESTADO_EXTERNO_PROTO = {valor: nombre for nombre, valor in NOMBRE_ESTADO_EXTERNO.items()}
RESULTADO_VALIDACION_PROTO = {
    valor: nombre for nombre, valor in NOMBRE_RESULTADO_VALIDACION.items()
}

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


# Solicitud de incorporación de un vehículo de un propietario externo.
# El vehículo recién se crea en `vehiculos` cuando ambas validaciones dan VALIDADO.
class VehiculoExterno(Base):
    __tablename__ = "vehiculos_externos"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int]
    patente: Mapped[str] = mapped_column(unique=True)
    marca: Mapped[str]
    modelo: Mapped[str]
    anio: Mapped[int]
    color: Mapped[str | None]
    tipo: Mapped[str] = mapped_column(Enum(*TIPOS, name="tipo_vehiculo_externo"))
    precio_diario: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    estado: Mapped[str] = mapped_column(
        Enum(*ESTADOS_EXTERNOS, name="estado_vehiculo_externo"), default="PENDIENTE"
    )
    validacion_patente: Mapped[str | None] = mapped_column(RESULTADO_VALIDACION_DB)
    validacion_titularidad: Mapped[str | None] = mapped_column(RESULTADO_VALIDACION_DB)
    vehiculo_id: Mapped[int | None]
    motivo_rechazo: Mapped[str | None]
    # Evita publicar dos veces vehiculos.externos.validacion.completada.
    completada_publicada: Mapped[bool] = mapped_column(default=False)
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
