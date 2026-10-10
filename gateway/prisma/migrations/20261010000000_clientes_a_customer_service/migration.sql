-- Los clientes pasan al Customer Service (Hito 2, punto 3).
-- El gateway deja de ser dueño de la tabla Cliente: se quitan las claves foráneas
-- y la tabla local. `clienteId` queda como referencia lógica (otra base, sin FK).

-- DropForeignKey
ALTER TABLE "Reserva" DROP CONSTRAINT "Reserva_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_clienteId_fkey";

-- DropTable
DROP TABLE "Cliente";
