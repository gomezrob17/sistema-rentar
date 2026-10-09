-- Las reservas y alquileres pasan al Rental Service (Hito 2, punto 4).
-- El gateway deja de ser dueño de la tabla Reserva y del enum EstadoReserva.

-- DropTable
DROP TABLE "Reserva";

-- DropEnum
DROP TYPE "EstadoReserva";
