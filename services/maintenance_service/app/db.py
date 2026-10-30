import os
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

engine = create_engine(os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://rentar:rentar@localhost:55432/rentar_mantenimientos"
))
Session = sessionmaker(engine, expire_on_commit=False)


def ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Solicitud(Base):
    """Una solicitud por reserva. Referencias lógicas, sin acceso a bases ajenas."""

    __tablename__ = "solicitudes_mantenimiento"
    reserva_id: Mapped[int] = mapped_column(primary_key=True)
    vehiculo_id: Mapped[int]
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime())
    fecha_fin: Mapped[datetime] = mapped_column(DateTime())
    recibida_at: Mapped[datetime] = mapped_column(default=ahora)
    procesar_desde: Mapped[datetime]
    resultado: Mapped[str | None] = mapped_column(String(20), nullable=True)
    procesada_at: Mapped[datetime | None]
    publicado: Mapped[bool] = mapped_column(default=False, index=True)


def crear_base_si_no_existe():
    admin = create_engine(engine.url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conexion:
            nombre = engine.url.database
            if not conexion.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": nombre}):
                identificador = admin.dialect.identifier_preparer.quote(nombre)
                conexion.execute(text(f"CREATE DATABASE {identificador}"))
    finally:
        admin.dispose()
