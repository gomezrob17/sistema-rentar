# Puntos 6 y 7 de Rentar

Esta implementación agrega la cancelación de una reserva propia mediante REST y el historial privado del cliente mediante GraphQL. Incluye sus pantallas, documentación de API y pruebas con PostgreSQL.

## Integración con el grupo

La rama `feature/puntos-6-7` parte de `feature/ConsultaReservas-5`, commit `846084f`, que ya contiene la consulta de reservas, sus filtros y la autenticación de GraphQL. Ese trabajo corresponde al punto 5. Los cambios de los puntos 6 y 7 se guardan encima de esa base.

Antes de integrar en `develop` o `main`, coordinar que el punto 5 también esté integrado. Si todavía no lo está, GitHub mostrará sus dos commits como parte de la diferencia. No se cambió `prisma/schema.prisma` ni se agregaron migraciones.

## Punto 6 Cancelación REST

```http
PATCH /reservas/123/cancelar
Authorization: Bearer <token-del-cliente>
```

No recibe cuerpo. El identificador del cliente se obtiene del token firmado; no se acepta elegir un propietario desde el navegador.

La reserva debe pertenecer a ese cliente, estar `CONFIRMADA` y tener `fechaInicio > ahora`. Si el inicio coincide con el momento actual, ya no puede cancelarse. La escritura vuelve a comprobar esas condiciones: dos solicitudes simultáneas no pueden cancelar con éxito dos veces la misma reserva.

Se conserva el registro completo, las fechas y los importes originales. Solo cambia el estado a `CANCELADA` y se actualiza la fecha técnica de modificación. La disponibilidad y el alta existentes comprueban solapamientos contra reservas confirmadas; por eso la cancelada deja libre el período sin borrar datos ni cambiar globalmente el estado del vehículo.

Respuesta exitosa:

```json
{ "id": 123, "estado": "CANCELADA" }
```

| Código | Significado |
| --- | --- |
| 200 | Cancelación realizada |
| 400 | Identificador no numérico o período ya iniciado |
| 401 | Token ausente, inválido o vencido |
| 403 | La sesión no es de cliente o no tiene cliente asociado |
| 404 | Reserva inexistente o de otro cliente |
| 409 | Reserva cancelada/finalizada, o cambio concurrente |

En **Mis reservas**, el cliente ve el botón solo para las reservas confirmadas futuras. Debe confirmar con **Sí, cancelar**; **Volver** no modifica nada. Después se consulta nuevamente la lista con los filtros aplicados y se muestra el mensaje de éxito. El administrador no tiene esta acción.

Swagger está en [http://localhost:3000/api](http://localhost:3000/api). Usar `POST /auth/login`, copiar `accessToken`, pulsar **Authorize** y pegar el token para probar la cancelación.

## Punto 7 Historial GraphQL

Enviar la consulta a `POST /graphql` con el encabezado `Authorization: Bearer <token-del-cliente>`:

```graphql
query HistorialAlquileres {
  historialAlquileres {
    id
    vehiculo
    patente
    fechaInicio
    fechaFin
    cantidadDias
    importeTotal
    estado
  }
}
```

No recibe un `clienteId`. El cliente solo ve sus registros; una sesión de administrador no puede ejecutar esta consulta privada.

Incluye las reservas `CANCELADA`, las `FINALIZADA` y las `CONFIRMADA` cuya fecha de fin ya pasó. Estas últimas se muestran como `FINALIZADA`, siguiendo el criterio elegido para este trabajo. La consulta no modifica la base ni necesita un proceso programado. **Mis reservas** y sus filtros de estado aplican el mismo criterio para mantener la coherencia.

Las confirmadas futuras y en curso quedan fuera del historial. Una cancelada sí aparece aunque su período original fuera futuro. El orden es por fecha de inicio descendente, con id descendente para desempatar.

La cantidad de días utiliza la misma regla del alta: `max(1, ceil(duración / 24 horas))`. Un período de 25 horas cuenta como dos días. Para las canceladas representa la duración originalmente reservada. El importe es el guardado en la reserva; no se recalcula con el precio actual del vehículo ni representa una penalización o un reembolso.

La pantalla **Historial**, en `/historial`, muestra vehículo, patente, fecha y hora de inicio y fin, días, importe y estado. Tiene estados de carga, error con reintento y lista vacía. Las fechas se muestran en la zona horaria del navegador. La operación y cada campo tienen descripciones en el esquema GraphQL generado.

## Cómo está organizado el código

```text
Pantallas React
  -> api/reservas.ts y cliente HTTP compartido
  -> controlador REST / resolver GraphQL
  -> guard de JWT
  -> ReservasService
  -> Prisma
  -> PostgreSQL
```

| Archivo | Responsabilidad |
| --- | --- |
| `src/reservas/reservas.controller.ts` | Ruta REST, autenticación y documentación Swagger |
| `src/reservas/reservas.service.ts` | Propiedad de la reserva, reglas de cancelación, historial y estado por fecha |
| `src/reservas/reservas.resolver.ts` | Operación GraphQL del historial |
| `src/reservas/models/alquiler-historial.model.ts` | Campos y descripciones del historial |
| `frontend/src/components/CancelarReserva.tsx` | Confirmación, petición REST y errores de cancelación |
| `frontend/src/pages/ConsultaReservas.tsx` | Integra el botón en la pantalla del punto 5 |
| `frontend/src/pages/HistorialAlquileres.tsx` | Pantalla del historial |
| `frontend/src/api/reservas.ts` | Llamadas REST y GraphQL desde la web |
| `frontend/src/App.tsx` y `components/Navbar.tsx` | Ruta protegida y navegación |
| `test/reservas-puntos-6-7.e2e-spec.ts` | Pruebas de integración con base real |

## Pruebas automáticas

Se usa una base separada, `rentar_test`. Los tests crean datos identificados para cada ejecución y eliminan solamente esos registros al terminar. La suite exige explícitamente `TEST_DATABASE_URL`; no vacía ni utiliza la base de desarrollo para sus fixtures.

Con Docker abierto y el proyecto iniciado, desde la raíz del repositorio en PowerShell, crear la base de pruebas **una sola vez**:

```powershell
docker exec rentar-db createdb -U rentar rentar_test
```

Si ya existe, omitir ese comando. Después, en una terminal destinada a pruebas:

```powershell
$env:DATABASE_URL = 'postgresql://rentar:rentar@localhost:5432/rentar_test?schema=public'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npx.cmd prisma migrate deploy
npm.cmd run test:e2e -- --runInBand
```

Cerrar esa terminal al terminar para no arrancar luego el servidor con la conexión de pruebas. Para ejecutar solo la suite nueva, usar `npm.cmd run test:puntos-6-7` con esas mismas variables.

Resultado de la verificación local: **2 suites y 12 pruebas aprobadas**. También se comprobaron las compilaciones y el lint del backend y del frontend. El lint del frontend conserva cuatro advertencias previas en SesionContext, AdminVehiculos, AdminClientes y ConsultaReservas; los componentes nuevos no agregan advertencias.

Casos cubiertos:

- Autenticación REST y GraphQL, rol de cliente e identificadores inválidos.
- Rechazo de una cancelación ajena, aunque se envíe otro clienteId en el cuerpo.
- Cancelación sin borrado y conservación de fechas e importe.
- Disponibilidad del vehículo y creación de una nueva reserva en el mismo período.
- Rechazo cuando el alquiler ya comenzó o comienza en el momento de la solicitud.
- Rechazo de canceladas/finalizadas y de una segunda cancelación simultánea.
- Historial con finalizadas por fecha, canceladas y finalizadas explícitas.
- Exclusión de reservas futuras, en curso y de otros clientes.
- Días redondeados e importe histórico sin usar el precio actual del vehículo.
- Historial vacío y consulta sin modificaciones en la base.
- Coherencia de los filtros del punto 5 con el estado calculado por fecha.
- Respuesta `ping: pong` de GraphQL, en reemplazo del test de ejemplo del proyecto inicial.

Se ajustó el `rootDir` de TypeScript para las pruebas y se habilitaron los módulos VM de Node al ejecutar Jest, necesarios para la combinación instalada de NestJS 12 y Jest. La ejecución se verificó con Node 24.18. [Referencia de Jest](https://jestjs.io/docs/ecmascript-modules).

## Prueba manual y capturas

Para crear datos ficticios en la base **local** `rentar`, ejecutar desde la raíz:

```powershell
node --env-file=.env scripts/demo-puntos-6-7.cjs
```

El script crea `demo67@example.test` con contraseña inicial `DemoRentar67!`, un Toyota Corolla de patente `DEMO67A` y cuatro reservas de ejemplo. No modifica ni elimina registros existentes. Las fechas son relativas al momento de creación; si se repite, conserva la demo existente y no restablece una reserva cancelada.

1. Cerrar la sesión anterior e ingresar con ese cliente real de prueba.
2. Abrir **Mis reservas** y comprobar que la confirmada futura ofrece **Cancelar**.
3. Pulsar **Cancelar**, luego **Volver**, y comprobar que sigue confirmada.
4. Confirmar la cancelación y comprobar el mensaje de éxito y el estado `CANCELADA`.
5. Abrir **Historial**: aparecen la reserva recién cancelada, la cancelada de ejemplo y el alquiler finalizado por fecha; el alquiler en curso no aparece.

Capturas tomadas durante esa prueba con datos ficticios:

![Mis reservas antes de cancelar](capturas/01-mis-reservas.png)

![Reserva cancelada desde la web](capturas/02-reserva-cancelada.png)

![Historial con canceladas y finalizada](capturas/03-historial.png)

La autenticación y el administrador de demostración provienen del trabajo previo del grupo. Para probar estos puntos se debe ingresar con un cliente real de la base, como el creado por este script; el antiguo cliente simulado del formulario de ingreso no tiene token ni cliente asociado.

## Commits y publicación

Un commit guarda una versión de los archivos seleccionados en el historial local. No publica nada por sí solo. Un push envía los commits de una rama a GitHub; el Pull Request permite revisar e integrar esa rama con el trabajo del grupo.

Los archivos `.env`, `node_modules`, las bases y los archivos compilados no forman parte de esta entrega. La documentación, el código, las pruebas y las capturas sí se versionan. El archivo `tsconfig.build.tsbuildinfo` ya estaba versionado por el grupo; no se incluye su regeneración automática entre los cambios de estos puntos.
