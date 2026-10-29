import os
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

# Los valores de la base y de la API son los nombres de dominio, sin el prefijo
# del enum de proto y sin el valor cero (*_UNSPECIFIED).
ROLES = ("CLIENTE", "ADMIN")

engine = create_engine(
    os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://rentar:rentar@localhost:5432/rentar_clientes",
    )
)
Session = sessionmaker(engine, expire_on_commit=False)


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# Mismas columnas que el modelo Cliente de Hito 1 (Prisma), en snake_case.
class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True)
    documento: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]
    apellido: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    telefono: Mapped[str | None]
    # Prisma guardaba la fecha de nacimiento sin zona horaria.
    fecha_nacimiento: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    activo: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=ahora, onupdate=ahora
    )


# Mismas columnas que el modelo Usuario de Hito 1 (Prisma), en snake_case.
# Vive en la misma base que los clientes, así que la clave foránea se conserva.
class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    rol: Mapped[str] = mapped_column(Enum(*ROLES, name="rol_usuario"), default="CLIENTE")
    # Nulo para el administrador.
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id"), unique=True)
    activo: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=ahora, onupdate=ahora
    )
