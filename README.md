# Rentar — Sistema de alquiler de vehículos

Trabajo práctico de **Desarrollo de Software en Sistemas Distribuidos** (UNLa).

Sistema web para la empresa ficticia **Rentar**, que administra su flota de vehículos, sus clientes y las reservas de alquiler. El desarrollo es incremental:

- **Hito 1** (tag `hito-1`): backend monolítico con **REST** y **GraphQL**.
- **Hito 2** (este estado del repositorio): la misma interfaz web y las mismas funcionalidades, ahora con un **API Gateway** y **servicios internos comunicados por gRPC**.

## Arquitectura

```text
Frontend React (:5173)
   │  REST + GraphQL
   ▼
API Gateway NestJS (:3000)  ── JWT, permisos por rol, orquestación. No accede a ninguna base.
   │  gRPC
   ├──► Vehicle Service  (Python) ──► rentar_vehiculos
   ├──► Customer Service (Python) ──► rentar_clientes   (clientes y usuarios)
   └──► Rental Service   (Python) ──► rentar_alquileres (reservas y alquileres)
```

Los contratos gRPC están documentados en [`proto/`](proto/).

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `gateway/` | API Gateway en NestJS (REST, GraphQL, JWT y clientes gRPC) |
| `frontend/` | Interfaz web en React + Vite |
| `services/vehicle_service/`, `customer_service/`, `rental_service/` | Servicios gRPC en Python, cada uno con su base |
| `proto/` | Contratos `.proto` de los tres servicios |
| `infra/` | Script de creación de bases y migración de datos de Hito 1 |
| `docs/` | Documentación del trabajo práctico |

## Stack tecnológico

- **API Gateway:** NestJS + TypeScript, `@nestjs/microservices` con `@grpc/grpc-js`, JWT.
- **Servicios:** Python 3.12, `grpcio`, SQLAlchemy 2, bcrypt.
- **Frontend:** React + Vite + TypeScript, con Axios.
- **Base de datos:** PostgreSQL 16, una base por servicio.
- **Despliegue local:** Docker Compose.

## Cómo iniciar el proyecto

Requisitos: Docker Desktop y Node.js 20+ (para el frontend).

1. **Levantar la base, los tres servicios y el gateway:**

   ```bash
   docker compose up -d --build
   ```

2. **Iniciar el frontend** en otra terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

| Recurso | Dirección |
|---|---|
| Interfaz web | http://localhost:5173 |
| Swagger (REST) | http://localhost:3000/api |
| GraphQL Playground | http://localhost:3000/graphql |
| PostgreSQL (desde el host) | `localhost:55432` (usuario y contraseña `rentar`) |
| Servicios gRPC (desde el host) | `localhost:55051` (vehículos), `55052` (clientes), `55053` (alquileres) |

Los puertos del host 55432 y 55051-55053 evitan choques con un PostgreSQL local y con rangos que Windows reserva. Dentro de Docker los servicios usan 5432 y 50051-50053.

**Datos de Hito 1 (opcional):** si la base todavía tiene las tablas del backend monolítico, este script las copia a las bases de los servicios conservando los ids:

```bash
sh infra/migrar-hito1.sh
```

## Usuarios y permisos

Los usuarios viven en la base del Customer Service y los permisos se verifican en el gateway, tanto en REST como en GraphQL.

- **Administrador:** el Customer Service lo crea al arrancar con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. En desarrollo, `admin@unla.com.ar` / `Admin123` (se pueden cambiar con esas variables de entorno).
- **Clientes:** al dar de alta un cliente se crea su usuario, con el email del cliente y la contraseña temporal `Usuario{id}*` (por ejemplo, `Usuario7*` para el cliente 7). Después puede cambiarla desde la web.

| Operación | Quién puede |
|---|---|
| Iniciar sesión, consultar vehículos y disponibilidad | Cualquiera |
| Alta, edición, cambio de estado y baja de vehículos | ADMIN |
| Gestión de clientes | ADMIN |
| Alta de reserva, cancelación e historial | CLIENTE (a su nombre, según el token) |
| Consulta de reservas | CLIENTE (las propias) o ADMIN (todas) |

Sin token, la respuesta es 401; con un rol no permitido, 403.

## Funcionalidades

| # | Funcionalidad | Rol | API | Servicios |
|---|---|---|---|---|
| 1 | ABM de vehículos y cambio de estado | Administrador | REST | Vehicle |
| 2 | Consulta de disponibilidad por período y filtros | Cliente | GraphQL | Rental + Vehicle |
| 3 | ABM de clientes | Administrador | REST | Customer |
| 4 | Alta de reserva de un vehículo para un período | Cliente | REST | Customer + Vehicle + Rental |
| 5 | Consulta de reservas propias o de todos los clientes | Cliente / Administrador | GraphQL | Rental + Customer + Vehicle |
| 6 | Cancelación de una reserva propia antes del inicio | Cliente | REST | Rental |
| 7 | Historial de alquileres finalizados y reservas canceladas | Cliente | GraphQL | Rental + Vehicle |

Reglas de negocio destacadas:
- Un vehículo se crea siempre en estado `DISPONIBLE`; su patente no puede modificarse; los vehículos y clientes inactivos no pueden usarse para nuevos alquileres.
- Al crear una reserva se valida cliente y vehículo activos, disponibilidad del vehículo en el período, fecha de inicio futura y fecha de fin posterior al inicio. El importe total se calcula según la duración y el precio diario del momento.
- Cancelar una reserva no la elimina: cambia su estado a `CANCELADA` y libera el período para nuevas reservas.

## Pruebas

- **Servicios** (desde la carpeta de cada uno, con Python 3.12):

  ```bash
  python -m venv .venv
  .venv/Scripts/python -m pip install -r requirements.txt
  .venv/Scripts/python -m grpc_tools.protoc -Iapp/generated=../../proto --python_out=. --grpc_python_out=. --pyi_out=. ../../proto/vehicle.proto
  .venv/Scripts/python -m pytest
  ```

  Reemplazar `vehicle.proto` por `customer.proto` o `rental.proto` según el servicio. En Linux o macOS, `.venv/bin/python`.

- **API Gateway:** desde `gateway/`, `npm ci` y `npm test`.

- **End-to-end**, con el stack levantado:

  ```bash
  docker compose exec -T -e TEST_RENTAL_DATABASE_URL=postgresql://rentar:rentar@db:5432/rentar_alquileres gateway npm run test:e2e
  ```

Más detalle de las pruebas de los puntos 6 y 7 en [`docs/puntos-6-7.md`](docs/puntos-6-7.md).
