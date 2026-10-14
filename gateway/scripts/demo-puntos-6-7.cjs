// Datos ficticios para recorrer los puntos 6 y 7 en el entorno local.
// Ejecutar desde gateway/, con el stack levantado (docker compose up -d):
//   node scripts/demo-puntos-6-7.cjs
// Cliente, usuario y vehículo se crean por la API del gateway. Las reservas se
// siembran con SQL crudo en la base del Rental Service (las vencidas o canceladas
// no se pueden crear por la API).
const { Pool } = require('pg');

const rentalUrl =
  process.env.RENTAL_DATABASE_URL || 'postgresql://rentar:rentar@localhost:55432/rentar_alquileres';
const url = new URL(rentalUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/rentar_alquileres') {
  throw new Error('La demo solo se ejecuta sobre la base local rentar_alquileres.');
}

const rental = new Pool({ connectionString: rentalUrl });
const email = 'demo67@example.test';
const password = 'DemoRentar67!';
const gateway = process.env.GATEWAY_URL || 'http://localhost:3000';
const json = { 'Content-Type': 'application/json' };

// Desde el Hito 2 el vehículo vive en el Vehicle Service: se busca o se crea por la API del gateway.
async function vehiculoDemo() {
  const vehiculos = await (await fetch(`${gateway}/vehiculos`)).json();
  const existente = vehiculos.find((v) => v.patente === 'DEMO67A');
  if (existente) return existente;
  const respuesta = await fetch(`${gateway}/vehiculos`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ patente: 'DEMO67A', marca: 'Toyota', modelo: 'Corolla', anio: 2025,
      color: 'Gris', tipo: 'SEDAN', precioDiario: 25000.5 }),
  });
  if (!respuesta.ok) throw new Error(`No se pudo crear el vehículo de la demo (HTTP ${respuesta.status}).`);
  return respuesta.json();
}

// El cliente y su usuario viven en el Customer Service: se busca o se crea por la API del gateway.
async function clienteDemo() {
  const clientes = await (await fetch(`${gateway}/clientes`)).json();
  const existente = clientes.find((c) => c.email === email);
  if (existente) {
    if (existente.documento !== 'DEMO-PUNTOS-67') {
      throw new Error('El correo de la demo ya pertenece a otro cliente. No se modificó.');
    }
    return existente;
  }
  const respuesta = await fetch(`${gateway}/clientes`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ documento: 'DEMO-PUNTOS-67', nombre: 'Cliente', apellido: 'Demo 6 y 7', email }),
  });
  if (!respuesta.ok) throw new Error(`No se pudo crear el cliente de la demo (HTTP ${respuesta.status}).`);
  return respuesta.json();
}

const login = (pass) =>
  fetch(`${gateway}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: pass }) });

// El usuario se crea con la contraseña temporal "Usuario{id}*": la demo la cambia por una fija.
async function asegurarPassword(cliente) {
  if ((await login(password)).ok) return;
  const temporal = `Usuario${cliente.id}*`;
  const sesion = await login(temporal);
  if (!sesion.ok) {
    throw new Error('No se pudo iniciar sesión con la contraseña de la demo ni con la temporal.');
  }
  const { accessToken } = await sesion.json();
  const cambio = await fetch(`${gateway}/auth/password`, {
    method: 'PATCH',
    headers: { ...json, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ passwordActual: temporal, passwordNueva: password }),
  });
  if (!cambio.ok) throw new Error(`No se pudo fijar la contraseña de la demo (HTTP ${cambio.status}).`);
}

async function main() {
  const cliente = await clienteDemo();
  await asegurarPassword(cliente);
  const vehiculo = await vehiculoDemo();
  const { rows: [{ total }] } = await rental.query(
    'SELECT count(*)::int AS total FROM reservas WHERE cliente_id = $1 AND vehiculo_id = $2',
    [cliente.id, vehiculo.id],
  );
  if (total === 0) {
    const hora = 3600000;
    const ahora = Date.now();
    // Las fechas se guardan en UTC sin zona horaria.
    const utc = (ms) => new Date(ms).toISOString();
    const filas = [
      { inicio: 48, fin: 73, estado: 'CONFIRMADA' },
      { inicio: -96, fin: -71, estado: 'CONFIRMADA' },
      { inicio: 168, fin: 193, estado: 'CANCELADA' },
      { inicio: -1, fin: 23, estado: 'CONFIRMADA' },
    ];
    for (const { inicio, fin, estado } of filas) {
      const importeTotal = fin - inicio > 24 ? '50001.00' : '25000.50';
      await rental.query(
        `INSERT INTO reservas
           (cliente_id, vehiculo_id, fecha_inicio, fecha_fin, precio_diario, importe_total, estado, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::estado_reserva, $8, $8)`,
        [cliente.id, vehiculo.id, utc(ahora + inicio * hora), utc(ahora + fin * hora), '25000.50',
          importeTotal, estado, utc(ahora)],
      );
    }
  }
  console.log(`Demo lista: ${email} / ${password}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => rental.end());
