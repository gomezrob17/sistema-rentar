// Datos ficticios para recorrer los puntos 6 y 7 en la base local.
// Ejecutar desde gateway/, con el gateway y los servicios (vehicle, customer, rental) levantados:
//   node --env-file=.env scripts/demo-puntos-6-7.cjs
// Las reservas se siembran con SQL crudo contra la base del Rental Service.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/rentar') {
  throw new Error('La demo solo se ejecuta sobre la base local rentar.');
}

const prisma = new PrismaClient();
const rental = new PrismaClient({
  datasourceUrl:
    process.env.RENTAL_DATABASE_URL ||
    'postgresql://rentar:rentar@localhost:5432/rentar_alquileres',
});
const email = 'demo67@example.test';
const password = 'DemoRentar67!';
const gateway = process.env.GATEWAY_URL || 'http://localhost:3000';

// Desde el Hito 2 el vehículo vive en el Vehicle Service: se busca o se crea por la API del gateway.
async function vehiculoDemo() {
  const vehiculos = await (await fetch(`${gateway}/vehiculos`)).json();
  const existente = vehiculos.find((v) => v.patente === 'DEMO67A');
  if (existente) return existente;
  const respuesta = await fetch(`${gateway}/vehiculos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patente: 'DEMO67A', marca: 'Toyota', modelo: 'Corolla', anio: 2025,
      color: 'Gris', tipo: 'SEDAN', precioDiario: 25000.5 }),
  });
  if (!respuesta.ok) throw new Error(`No se pudo crear el vehículo de la demo (HTTP ${respuesta.status}).`);
  return respuesta.json();
}

// El cliente vive en el Customer Service: se busca o se crea por la API del gateway.
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento: 'DEMO-PUNTOS-67', nombre: 'Cliente', apellido: 'Demo 6 y 7', email }),
  });
  if (!respuesta.ok) throw new Error(`No se pudo crear el cliente de la demo (HTTP ${respuesta.status}).`);
  return respuesta.json();
}

async function main() {
  const cliente = await clienteDemo();
  // La API crea el usuario con la contraseña temporal "Usuario{id}*": la demo usa una fija.
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.usuario.updateMany({
    where: { clienteId: cliente.id },
    data: { email, passwordHash, rol: 'CLIENTE', activo: true },
  });
  const vehiculo = await vehiculoDemo();
  const [{ total }] = await rental.$queryRawUnsafe(
    'SELECT count(*)::int AS total FROM reservas WHERE cliente_id = $1 AND vehiculo_id = $2',
    cliente.id,
    vehiculo.id,
  );
  if (total === 0) {
    const hora = 3600000;
    const ahora = Date.now();
    const filas = [
      { inicio: 48, fin: 73, estado: 'CONFIRMADA' },
      { inicio: -96, fin: -71, estado: 'CONFIRMADA' },
      { inicio: 168, fin: 193, estado: 'CANCELADA' },
      { inicio: -1, fin: 23, estado: 'CONFIRMADA' },
    ];
    for (const { inicio, fin, estado } of filas) {
      const importeTotal = fin - inicio > 24 ? '50001.00' : '25000.50';
      await rental.$executeRawUnsafe(
        `INSERT INTO reservas
           (cliente_id, vehiculo_id, fecha_inicio, fecha_fin, precio_diario, importe_total, estado, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::estado_reserva, $8, $8)`,
        cliente.id,
        vehiculo.id,
        new Date(ahora + inicio * hora),
        new Date(ahora + fin * hora),
        '25000.50',
        importeTotal,
        estado,
        new Date(),
      );
    }
  }
  console.log(`Demo lista: ${email} / ${password}`);
  console.log('No se modificaron registros existentes. Si ya cambiaste la contraseña de este cliente, usá la nueva.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => Promise.all([prisma.$disconnect(), rental.$disconnect()]));
