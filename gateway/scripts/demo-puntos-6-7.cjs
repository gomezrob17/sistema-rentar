// Datos ficticios para recorrer los puntos 6 y 7 en la base local.
// Ejecutar desde gateway/, con el gateway y el Vehicle Service levantados:
//   node --env-file=.env scripts/demo-puntos-6-7.cjs
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/rentar') {
  throw new Error('La demo solo se ejecuta sobre la base local rentar.');
}

const prisma = new PrismaClient();
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
  const existentes = await prisma.reserva.count({ where: { clienteId: cliente.id, vehiculoId: vehiculo.id } });
  if (existentes === 0) {
    const hora = 3600000;
    const ahora = Date.now();
    await prisma.reserva.createMany({ data: [
      { inicio: 48, fin: 73, estado: 'CONFIRMADA' },
      { inicio: -96, fin: -71, estado: 'CONFIRMADA' },
      { inicio: 168, fin: 193, estado: 'CANCELADA' },
      { inicio: -1, fin: 23, estado: 'CONFIRMADA' },
    ].map(({ inicio, fin, estado }) => ({
      clienteId: cliente.id, vehiculoId: vehiculo.id,
      fechaInicio: new Date(ahora + inicio * hora), fechaFin: new Date(ahora + fin * hora),
      precioDiario: '25000.50', importeTotal: fin - inicio > 24 ? '50001.00' : '25000.50', estado,
    })) });
  }
  console.log(`Demo lista: ${email} / ${password}`);
  console.log('No se modificaron registros existentes. Si ya cambiaste la contraseña de este cliente, usá la nueva.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
