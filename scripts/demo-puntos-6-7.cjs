// Datos ficticios para recorrer los puntos 6 y 7 en la base local.
// Ejecutar desde la raíz: node --env-file=.env scripts/demo-puntos-6-7.cjs
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/rentar') {
  throw new Error('La demo solo se ejecuta sobre la base local rentar.');
}

const prisma = new PrismaClient();
const email = 'demo67@example.test';
const password = 'DemoRentar67!';

async function main() {
  let cliente = await prisma.cliente.findUnique({ where: { email } });
  if (!cliente) {
    const passwordHash = await bcrypt.hash(password, 12);
    cliente = await prisma.cliente.create({ data: {
      documento: 'DEMO-PUNTOS-67', nombre: 'Cliente', apellido: 'Demo 6 y 7', email,
      usuario: { create: { email, passwordHash, rol: 'CLIENTE' } },
    } });
  } else if (cliente.documento !== 'DEMO-PUNTOS-67') {
    throw new Error('El correo de la demo ya pertenece a otro cliente. No se modificó.');
  }
  const vehiculo = await prisma.vehiculo.upsert({
    where: { patente: 'DEMO67A' }, update: {},
    create: { patente: 'DEMO67A', marca: 'Toyota', modelo: 'Corolla', anio: 2025,
      color: 'Gris', tipo: 'SEDAN', precioDiario: '25000.50' },
  });
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
