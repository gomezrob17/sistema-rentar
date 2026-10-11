#!/usr/bin/env sh
# Migra los datos de Hito 1 desde la base `rentar` (las tablas de Prisma del backend
# monolítico) a la base de cada servicio, conservando los ids para que las
# referencias entre servicios sigan valiendo (reserva -> cliente y vehículo,
# usuario -> cliente).
#
# Uso, con el stack levantado (cada servicio crea sus tablas al arrancar) y antes
# de cargar datos nuevos:
#   docker compose up -d --build
#   sh infra/migrar-hito1.sh
#
# Se puede correr más de una vez: las tablas de origen que no existen se saltean
# y los registros que ya están en destino se omiten (ON CONFLICT DO NOTHING).
set -e

psql_en() { docker compose exec -T db psql -U rentar -v ON_ERROR_STOP=1 -d "$@"; }

# copiar <tabla origen> <columnas origen> <base destino> <tabla destino> <columnas destino>
copiar() {
  if [ "$(psql_en rentar -tAc "SELECT to_regclass('public.\"$1\"') IS NOT NULL")" != "t" ]; then
    echo "$1: no existe en la base rentar, se omite."
    return
  fi
  psql_en rentar -c "\copy (SELECT $2 FROM \"$1\") TO STDOUT WITH CSV" \
    | psql_en "$3" -q \
      -c "CREATE TEMP TABLE origen AS SELECT $5 FROM $4 LIMIT 0" \
      -c "\copy origen FROM STDIN WITH CSV" \
      -c "INSERT INTO $4 ($5) SELECT * FROM origen ON CONFLICT DO NOTHING" \
      -c "SELECT setval(pg_get_serial_sequence('$4', 'id'), GREATEST((SELECT MAX(id) FROM $4), 1))" \
      > /dev/null
  echo "$1 -> $3.$4: $(psql_en "$3" -tAc "SELECT count(*) FROM $4") registros en destino."
}

copiar Vehiculo \
  'id, patente, marca, modelo, anio, color, tipo, "precioDiario", estado, activo, "createdAt", "updatedAt"' \
  rentar_vehiculos vehiculos \
  'id, patente, marca, modelo, anio, color, tipo, precio_diario, estado, activo, created_at, updated_at'

# Clientes antes que usuarios: usuarios.cliente_id es clave foránea a clientes.
copiar Cliente \
  'id, documento, nombre, apellido, email, telefono, "fechaNacimiento", activo, "createdAt", "updatedAt"' \
  rentar_clientes clientes \
  'id, documento, nombre, apellido, email, telefono, fecha_nacimiento, activo, created_at, updated_at'

# Los hashes de bcrypt de Node son compatibles con los de Python: las contraseñas siguen valiendo.
copiar Usuario \
  'id, email, "passwordHash", rol, "clienteId", activo, "createdAt", "updatedAt"' \
  rentar_clientes usuarios \
  'id, email, password_hash, rol, cliente_id, activo, created_at, updated_at'

copiar Reserva \
  'id, "clienteId", "vehiculoId", "fechaInicio", "fechaFin", "precioDiario", "importeTotal", estado, "createdAt", "updatedAt"' \
  rentar_alquileres reservas \
  'id, cliente_id, vehiculo_id, fecha_inicio, fecha_fin, precio_diario, importe_total, estado, created_at, updated_at'

echo "Migración de Hito 1 completa."
