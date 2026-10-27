# Rentar — Sistema de alquiler de vehículos

Trabajo práctico de **Desarrollo de Software en Sistemas Distribuidos** (UNLa).

Sistema web para la empresa ficticia **Rentar**, que administra su flota de vehículos, sus clientes y las reservas de alquiler. El desarrollo es incremental:

- **Hito 1** (tag `hito-1`): backend monolítico con **REST** y **GraphQL**.
- **Hito 2**: la misma interfaz web y las mismas funcionalidades, ahora con un **API Gateway** y **servicios internos comunicados por gRPC**.
- **Hito 3** (en curso): **comunicación asíncrona por eventos** con **RabbitMQ**. Implementadas la verificación policial de vehículos y la incorporación de vehículos de propietarios externos. Queda el mantenimiento preventivo.

## Arquitectura

```text
Frontend React (:5173)
   │  REST + GraphQL
   ▼
API Gateway NestJS (:3000)  ── JWT, permisos por rol, orquestación. No accede a ninguna base.
   │  gRPC
   ├──► Vehicle Service  (Python) ──► rentar_vehiculos
   │        ▲ │
   │        │ │ eventos (RabbitMQ, exchange topic rentar.eventos)
   │        │ ▼
   │    Verification Service (Python, worker) ──► rentar_verificaciones (registros policial y de titularidad simulados)
   ├──► Customer Service (Python) ──► rentar_clientes   (clientes y usuarios)
   └──► Rental Service   (Python) ──► rentar_alquileres (reservas y alquileres)
```

Los contratos gRPC están documentados en [`proto/`](proto/).

**Verificación de vehículos (Hito 3):** al dar de alta un vehículo, el Vehicle Service publica `vehiculos.verificacion.solicitada`; el Verification Service consulta su registro de patentes robadas y publica `vehiculos.verificacion.resultado`; el Vehicle Service guarda el resultado en el campo `verificacion` (`PENDIENTE`, `VALIDADO` o `ROBADO`). Un vehículo `ROBADO` sigue con su estado, pero queda inhabilitado: no aparece en la disponibilidad ni se puede reservar ni cambiar de estado. La patente `ROB123` figura como robada para las pruebas.

**Vehículos de propietarios externos (Hito 3, punto 2):** un cliente registra su vehículo desde la web. La solicitud queda `PENDIENTE` y el Vehicle Service publica `vehiculos.externos.registrados`. Dos consumidores independientes del Verification Service validan, cada uno por su cuenta, que la patente no esté denunciada como robada y que el cliente sea el titular en el registro externo simulado (`titularidades`). Para la titularidad, el documento del cliente se obtiene por gRPC del Customer Service. El Vehicle Service correlaciona los dos resultados por `vehiculoExternoId`: si alguno es `RECHAZADO`, la solicitud no se incorpora; si ambos son `VALIDADO`, publica `vehiculos.externos.validacion.completada` y crea el vehículo en la flota como `DISPONIBLE` y `VALIDADO`. Las patentes `DEF456`, `ABC123`, `AE321KL`, `GHI789` y `JKL012` están asociadas al documento `30123456`; `XYZ999` a otro documento, para probar el rechazo por titularidad.

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `gateway/` | API Gateway en NestJS (REST, GraphQL, JWT y clientes gRPC) |
| `frontend/` | Interfaz web en React + Vite |
| `services/vehicle_service/`, `customer_service/`, `rental_service/` | Servicios gRPC en Python, cada uno con su base |
| `services/verification_service/` | Worker de eventos en Python: verificación policial de patentes, con su base |
| `messaging/` | Módulo Python compartido de mensajería con RabbitMQ (se copia a cada imagen, igual que `proto/`) |
| `proto/` | Contratos `.proto` de los tres servicios |
| `infra/` | Script de creación de bases y migración de datos de Hito 1 |
| `scripts/playwright/` | Prueba E2E y capturas del Hito 3 con Playwright |
| `docs/` | Documentación del trabajo práctico |

## Stack tecnológico

- **API Gateway:** NestJS + TypeScript, `@nestjs/microservices` con `@grpc/grpc-js`, JWT.
- **Servicios:** Python 3.12, `grpcio`, SQLAlchemy 2, bcrypt.
- **Mensajería:** RabbitMQ 3.13 con `pika`.
- **Frontend:** React + Vite + TypeScript, con Axios.
- **Base de datos:** PostgreSQL 16, una base por servicio.
- **Pruebas E2E:** Playwright.
- **Despliegue local:** Docker Compose.

## Cómo iniciar el proyecto

Requisitos: Docker Desktop y Node.js 20+ (para el frontend).

1. **Levantar la base, el broker, los servicios y el gateway:**

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
| RabbitMQ (AMQP, desde el host) | `localhost:55672` |
| UI de management de RabbitMQ | http://localhost:55673 (usuario y contraseña `rentar`) |

Los puertos del host 55432, 55051-55053, 55672 y 55673 evitan choques con servicios locales y con rangos que Windows reserva. Dentro de Docker los servicios usan 5432, 50051-50053, 5672 y 15672. El usuario de RabbitMQ se puede cambiar con `RABBITMQ_USER` y `RABBITMQ_PASSWORD`.

Con un volumen de Hito 2 ya existente no hace falta borrar nada: el Verification Service crea su base si no existe y agrega `titularidades`, y el Vehicle Service agrega la columna `verificacion` y la tabla `vehiculos_externos` al arrancar.

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
| Alta de vehículo propio para incorporar a la flota | CLIENTE |
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
| H3 | Verificación policial asíncrona de la patente al dar de alta un vehículo | — | Eventos | Vehicle + Verification |
| H3-2 | Incorporación asíncrona de vehículos de propietarios externos | Cliente | REST + Eventos | Vehicle + Verification + Customer |

Reglas de negocio destacadas:
- Un vehículo se crea siempre en estado `DISPONIBLE`; su patente no puede modificarse; los vehículos y clientes inactivos no pueden usarse para nuevos alquileres.
- Al crear una reserva se valida cliente y vehículo activos, disponibilidad del vehículo en el período, fecha de inicio futura y fecha de fin posterior al inicio. El importe total se calcula según la duración y el precio diario del momento.
- Cancelar una reserva no la elimina: cambia su estado a `CANCELADA` y libera el período para nuevas reservas.
- Un vehículo externo empieza como solicitud `PENDIENTE` y solo se incorpora a la flota si las dos validaciones dan `VALIDADO`. `PENDIENTE` y `RECHAZADO` son estados de la solicitud, no estados operativos del vehículo; una vez incorporado queda `DISPONIBLE`.

## Pruebas

- **Servicios** (desde la carpeta de cada uno, con Python 3.12):

  ```bash
  python -m venv .venv
  .venv/Scripts/python -m pip install -r requirements.txt
  .venv/Scripts/python -m grpc_tools.protoc -Iapp/generated=../../proto --python_out=. --grpc_python_out=. --pyi_out=. ../../proto/vehicle.proto
  .venv/Scripts/python -m pytest
  ```

  Reemplazar `vehicle.proto` por `customer.proto` o `rental.proto` según el servicio. En Linux o macOS, `.venv/bin/python`. El Verification Service usa `customer.proto` solo para su cliente gRPC hacia el Customer Service; sus tests no necesitan `protoc` porque inyectan un cliente falso. Los tests no necesitan el broker (usan un publicador falso).

- **API Gateway:** desde `gateway/`, `npm ci` y `npm test`. La imagen Docker usa Node 24; con Node 22.14 el `npm run build` local puede fallar por un ciclo ESM de Nest CLI. En ese caso, ejecutar los tests dentro del contenedor:

  ```bash
  docker compose run --rm --no-deps gateway npm test
  ```

- **End-to-end**, con el stack levantado:

  ```bash
  docker compose exec -T -e TEST_RENTAL_DATABASE_URL=postgresql://rentar:rentar@db:5432/rentar_alquileres gateway npm run test:e2e
  ```

- **Prueba E2E y capturas del Hito 3 con Playwright**, con el stack y el frontend levantados:

  ```bash
  cd scripts/playwright
  npm install
  npx playwright install chromium
  node hito3-screenshots.cjs
  ```

  El script usa por defecto `camila.externo@example.test` / `Usuario13*` y registra `ABC123`. Si ese cliente no existe, lo crea con el administrador y el documento `30123456`. También se pueden pasar `RENTAR_CLIENTE_EMAIL` y `RENTAR_CLIENTE_PASSWORD` de otro cliente con ese documento, y `RENTAR_PATENTE=AE321KL` (o `GHI789`/`JKL012`) si `ABC123` ya fue registrada (o agregar otra patente a `TITULARIDADES`). Detiene el Verification Service para capturar el estado `PENDIENTE`, lo vuelve a arrancar y espera la incorporación asíncrona. Las capturas quedan en `docs/capturas/`.

Más detalle del flujo y las pruebas en [`docs/hito3-vehiculos-externos.md`](docs/hito3-vehiculos-externos.md) y de los puntos 6 y 7 en [`docs/puntos-6-7.md`](docs/puntos-6-7.md).
