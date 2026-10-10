#!/usr/bin/env sh
# Migra los clientes del Hito 1 desde la base del gateway (rentar.Cliente) a la
# base del Customer Service (rentar_clientes.clientes), preservando los ids para
# que las reservas y los usuarios del gateway sigan apuntando al cliente correcto.
#
# Orden de ejecución:
#   1. docker compose up -d db customer-service
#   2. sh infra/migrar-clientes.sh
#   3. docker compose up -d --build      (el gateway aplica su migración y borra la tabla vieja)
#
# Es idempotente a nivel de datos: si la tabla vieja ya no existe, no hace nada.
set -e

if ! docker compose exec -T db psql -U rentar -d rentar -tAc \
  "SELECT to_regclass('public.\"Cliente\"') IS NOT NULL" | grep -q t; then
  echo "La tabla Cliente del gateway no existe: nada para migrar."
  exit 0
fi

echo "Copiando clientes de rentar.Cliente a rentar_clientes.clientes..."
docker compose exec -T db psql -U rentar -d rentar -c \
  "\copy (SELECT id, documento, nombre, apellido, email, telefono, \"fechaNacimiento\", activo, \"createdAt\", \"updatedAt\" FROM \"Cliente\") TO STDOUT WITH CSV" \
  | docker compose exec -T db psql -U rentar -d rentar_clientes -c \
    "\copy clientes (id, documento, nombre, apellido, email, telefono, fecha_nacimiento, activo, created_at, updated_at) FROM STDIN WITH CSV"

# Ajusta la secuencia para que los próximos altas no repitan ids.
docker compose exec -T db psql -U rentar -d rentar_clientes -c \
  "SELECT setval(pg_get_serial_sequence('clientes', 'id'), GREATEST((SELECT MAX(id) FROM clientes), 1))"

echo "Migración de clientes completa."
