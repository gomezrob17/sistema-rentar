/* E2E local: usa PostgreSQL, RabbitMQ, gRPC, REST, GraphQL y la interfaz real.
 * Detiene temporalmente maintenance-service y rabbitmq; los restaura en finally.
 * Crea datos ficticios propios y conserva las reservas como evidencia.
 */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '../..');
const API = 'http://localhost:3000';
const WEB = 'http://127.0.0.1:5173';
const CAPTURAS = path.join(RAIZ, 'docs/capturas');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function docker(...args) {
  return execFileSync('docker', ['compose', ...args], { cwd: RAIZ, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
async function api(ruta, metodo = 'GET', cuerpo, token) {
  const r = await fetch(API + ruta, {
    method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: AbortSignal.timeout(15000),
  });
  const datos = await r.json();
  assert.ok(r.ok, `${metodo} ${ruta}: ${r.status} ${JSON.stringify(datos)}`);
  assert.ok(!datos.errors, JSON.stringify(datos.errors));
  return datos;
}
async function esperar(consulta, cumple, descripcion, ms = 90000) {
  const fin = Date.now() + ms;
  let ultimo;
  while (Date.now() < fin) {
    ultimo = await consulta();
    if (cumple(ultimo)) return ultimo;
    await sleep(1000);
  }
  throw new Error(`Timeout: ${descripcion}: ${JSON.stringify(ultimo)}`);
}

async function main() {
  const admin = await api('/auth/login', 'POST', {
    email: process.env.RENTAR_ADMIN_EMAIL || 'admin@unla.com.ar',
    password: process.env.RENTAR_ADMIN_PASSWORD || 'Admin123',
  });
  const email = 'mantenimiento.demo@example.test';
  let cliente = (await api('/clientes', 'GET', null, admin.accessToken)).find((c) => c.email === email);
  if (!cliente) cliente = await api('/clientes', 'POST', {
    email, documento: 'DEMO-MANTENIMIENTO', nombre: 'Demo', apellido: 'Mantenimiento',
  }, admin.accessToken);
  const password = `Usuario${cliente.id}*`;
  const sesion = await api('/auth/login', 'POST', { email, password });
  const vehiculos = [];
  for (const patente of ['MNT001', 'MNT002']) {
    let v = (await api('/vehiculos')).find((item) => item.patente === patente);
    if (!v) v = await api('/vehiculos', 'POST', {
      patente, marca: 'Toyota', modelo: 'Corolla', anio: 2024, color: 'Gris', tipo: 'SEDAN', precioDiario: 24000,
    }, admin.accessToken);
    vehiculos.push(v);
  }
  const reservas = async () => (await api('/graphql', 'POST', {
    query: '{ reservas { id vehiculoId estado mantenimiento fechaInicio fechaFin importeTotal } }',
  }, sesion.accessToken)).data.reservas;
  const anteriores = await reservas();
  const fechaInicio = new Date(Math.max(Date.now() + 7 * 86400000,
    ...anteriores.map((r) => new Date(r.fechaFin).getTime() + 86400000)));
  const fechaFin = new Date(fechaInicio.getTime() + 2 * 86400000);
  const crear = (vehiculoId) => api('/reservas', 'POST', {
    vehiculoId, fechaInicio: fechaInicio.toISOString(), fechaFin: fechaFin.toISOString(),
  }, sesion.accessToken);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  fs.mkdirSync(CAPTURAS, { recursive: true });
  let brokerDetenido = false;
  let tallerDetenido = false;
  let tallerConfigurado = false;
  const configuracionAnterior = process.env.MANTENIMIENTO_VEHICULOS_NO_REALIZADOS;
  try {
    await page.goto(WEB + '/ingreso');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === '/');

    docker('stop', 'maintenance-service');
    tallerDetenido = true;
    const t0 = Date.now();
    const primera = await crear(vehiculos[0].id);
    assert.equal(primera.estado, 'CONFIRMADA');
    assert.equal(primera.mantenimiento, 'PENDIENTE');
    console.log(`Reserva ${primera.id} CONFIRMADA en ${Date.now() - t0} ms con el taller detenido.`);
    await page.goto(WEB + '/reservas');
    await page.getByRole('cell', { name: 'Pendiente', exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(CAPTURAS, '11-h3-mantenimiento-pendiente.png'), fullPage: true });
    docker('start', 'maintenance-service');
    tallerDetenido = false;
    await esperar(reservas, (rs) => rs.find((r) => r.id === primera.id)?.mantenimiento === 'REALIZADO', 'resultado REALIZADO');

    // Simula falta de recursos solamente para el segundo vehículo de demostración.
    process.env.MANTENIMIENTO_VEHICULOS_NO_REALIZADOS = String(vehiculos[1].id);
    tallerConfigurado = true;
    docker('up', '-d', '--no-deps', '--force-recreate', 'maintenance-service');
    docker('stop', 'rabbitmq');
    brokerDetenido = true;
    const t1 = Date.now();
    const segunda = await crear(vehiculos[1].id);
    assert.equal(segunda.estado, 'CONFIRMADA');
    assert.equal(segunda.mantenimiento, 'PENDIENTE');
    console.log(`Reserva ${segunda.id} CONFIRMADA en ${Date.now() - t1} ms con RabbitMQ detenido.`);
    docker('start', 'rabbitmq');
    brokerDetenido = false;
    const finales = await esperar(reservas,
      (rs) => rs.find((r) => r.id === segunda.id)?.mantenimiento === 'NO_REALIZADO', 'recuperación y NO_REALIZADO');
    assert.equal(finales.find((r) => r.id === segunda.id).estado, 'CONFIRMADA');
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await page.getByRole('cell', { name: 'No realizado', exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(CAPTURAS, '12-h3-mantenimiento-resultados.png'), fullPage: true });

    // La entrega repetida no genera otra solicitud ni altera el resultado.
    const evento = { reservaId: primera.id, vehiculoId: vehiculos[0].id,
      fechaInicio: primera.fechaInicio, fechaFin: primera.fechaFin };
    const repetido = await fetch('http://localhost:55673/api/exchanges/%2F/rentar.eventos/publish', {
      method: 'POST', headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.RABBITMQ_USER || 'rentar'}:${process.env.RABBITMQ_PASSWORD || 'rentar'}`).toString('base64'),
        'Content-Type': 'application/json',
      }, body: JSON.stringify({ properties: { delivery_mode: 2, type: 'reserva.confirmada' },
        routing_key: 'reserva.confirmada', payload: JSON.stringify(evento), payload_encoding: 'string' }),
    });
    assert.ok(repetido.ok);
    assert.equal((await repetido.json()).routed, true);
    await sleep(3000);
    const total = docker('exec', '-T', 'db', 'psql', '-U', 'rentar', '-d', 'rentar_mantenimientos', '-tAc',
      `SELECT count(*) FROM solicitudes_mantenimiento WHERE reserva_id=${primera.id}`);
    assert.equal(total.trim(), '1');
    await api(`/reservas/${primera.id}/cancelar`, 'PATCH', null, sesion.accessToken);
    const historial = await api('/graphql', 'POST', { query: '{ historialAlquileres { id estado mantenimiento } }' }, sesion.accessToken);
    assert.deepEqual(historial.data.historialAlquileres.find((r) => r.id === primera.id), {
      id: primera.id, estado: 'CANCELADA', mantenimiento: 'REALIZADO',
    });
    await page.goto(WEB + '/historial');
    await page.getByRole('cell', { name: 'Realizado', exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(CAPTURAS, '13-h3-mantenimiento-historial.png'), fullPage: true });
    console.log('OK: resultados, recuperación del broker, duplicados, cancelación e historial.');
    console.log(`Demo: ${email} / ${password}`);
  } finally {
    if (brokerDetenido) docker('start', 'rabbitmq');
    if (configuracionAnterior === undefined) delete process.env.MANTENIMIENTO_VEHICULOS_NO_REALIZADOS;
    else process.env.MANTENIMIENTO_VEHICULOS_NO_REALIZADOS = configuracionAnterior;
    if (tallerConfigurado) docker('up', '-d', '--no-deps', '--force-recreate', 'maintenance-service');
    else if (tallerDetenido) docker('start', 'maintenance-service');
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
