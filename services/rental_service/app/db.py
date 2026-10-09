import os
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Numeric, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.generated import rental_pb2 as pb

# Los valores válidos salen del contrato, sin el *_SIN_ESPECIFICAR (valor 0).
ESTADOS = pb.EstadoReserva.keys()[1:]

engine = create_engine(
    os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://rentar:rentar@localhost:5432/rentar_alquileres",
    )
)
Session = sessionmaker(engine, expire_on_commit=False)


def ahora() -> datetime:
    # UTC sin zona horaria, igual que los TIMESTAMP de Prisma en Hito 1.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


# Mismas columnas que el modelo Reserva de Hito 1 (Prisma), en snake_case.
# cliente_id y vehiculo_id son referencias lógicas a otros servicios (sin FK).
class Reserva(Base):
    __tablename__ = "reservas"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int]
    vehiculo_id: Mapped[int]
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    fecha_fin: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    precio_diario: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    importe_total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    estado: Mapped[str] = mapped_column(
        Enum(*ESTADOS, name="estado_reserva"), default="CONFIRMADA"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=ahora)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), default=ahora, onupdate=ahora
    )
