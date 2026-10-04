-- Hito 2, punto 2: los vehículos pasan al Vehicle Service (base rentar_vehiculos).
-- Reserva.vehiculoId queda como referencia lógica, sin FK.

-- DropForeignKey
ALTER TABLE "Reserva" DROP CONSTRAINT "Reserva_vehiculoId_fkey";

-- DropTable
DROP TABLE "Vehiculo";

-- DropEnum
DROP TYPE "TipoVehiculo";

-- DropEnum
DROP TYPE "EstadoVehiculo";

