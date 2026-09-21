# Rentar — Sistema de alquiler de vehículos

Trabajo práctico de **Desarrollo de Software en Sistemas Distribuidos** (UNLa) — Web Services.

Sistema web para la empresa ficticia **Rentar**, que administra su flota de vehículos, sus clientes y las reservas de alquiler. El desarrollo es incremental: este repositorio corresponde al **HITO 1**, resuelto con **REST** y **GraphQL**.

## Stack tecnológico

- **Backend:** NestJS + TypeScript, Prisma ORM, PostgreSQL, JWT para autenticación.
- **API:** REST (documentada con Swagger) y GraphQL (Apollo Server).
- **Frontend:** React + Vite + TypeScript, consumiendo ambas APIs con Axios.
- **Base de datos:** PostgreSQL 16, levantada con Docker Compose.

## Requisitos previos

- Node.js 20+ y npm.
- Docker Desktop (para la base de datos).

## Cómo iniciar el proyecto

1. **Levantar la base de datos** (PostgreSQL vía Docker):

   ```bash
   docker compose up -d
   ```

2. **Instalar dependencias** (si no están instaladas):

   ```bash
   npm install
   cd frontend && npm install
   ```

3. **Aplicar las migraciones de Prisma** (crea las tablas en la base):

   ```bash
   npx prisma migrate deploy
   ```

4. **Iniciar el backend** en modo watch (por defecto en `http://localhost:3000`):

   ```bash
   npm run start:dev
   ```

5. **Iniciar el frontend** en otra terminal (por defecto en `http://localhost:5173`):

   ```bash
   cd frontend
   npm run dev
   ```

La variable `DATABASE_URL` ya está configurada en `.env` para apuntar al contenedor de Docker. Opcionalmente se puede definir `JWT_SECRET`; si no se define, se usa un valor por defecto solo para desarrollo.

### Documentación de las APIs

- **Swagger (REST):** http://localhost:3000/api
- **GraphQL Playground:** http://localhost:3000/graphql

### Cómo probar el login

Al dar de alta un cliente se crea automáticamente su usuario, con el email del cliente y una contraseña temporal `Usuario{id}*` (por ejemplo, para el cliente con id 7: `Usuario7*`). Con esas credenciales se puede autenticar en `POST /auth/login` y usar el token JWT devuelto para las operaciones que lo requieren (reservas, historial, cambio de contraseña).

## Funcionalidades del Hito 1

| # | Funcionalidad | Rol | Tecnología |
|---|---|---|---|
| 1 | ABM de vehículos (alta, modificación, baja lógica, consulta) | Administrador | REST |
| 2 | Consulta de disponibilidad de vehículos por período y filtros | Cliente | GraphQL |
| 3 | ABM de clientes (alta, modificación, baja lógica, consulta) | Administrador | REST |
| 4 | Alta de reserva de un vehículo para un período | Cliente | REST |
| 5 | Consulta de reservas propias (cliente) o de todos los clientes (administrador) | Cliente / Administrador | GraphQL |
| 6 | Cancelación de una reserva propia antes del inicio del alquiler | Cliente | REST |
| 7 | Historial de alquileres finalizados y reservas canceladas | Cliente | GraphQL |

Reglas de negocio destacadas:
- Un vehículo se crea siempre en estado `DISPONIBLE`; su patente no puede modificarse; los vehículos y clientes inactivos no pueden usarse para nuevos alquileres.
- Al crear una reserva se valida cliente y vehículo activos, disponibilidad del vehículo en el período, fecha de inicio futura y fecha de fin posterior al inicio. El importe total se calcula según la duración y el precio diario.
- Cancelar una reserva no la elimina: cambia su estado a `CANCELADA` y libera el período para nuevas reservas.
