import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EstadoReserva, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Se exige una base separada. Nunca se vacía la base del usuario.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || new URL(testUrl).pathname !== '/rentar_test') {
  throw new Error(
    'Definí TEST_DATABASE_URL apuntando a la base rentar_test y aplicá sus migraciones. Ver docs/puntos-6-7.md.',
  );
}

const HORA = 60 * 60 * 1000;
const HISTORIAL =
  '{ historialAlquileres { id vehiculo patente fechaInicio fechaFin cantidadDias importeTotal estado } }';

describe('Puntos 6 y 7 con PostgreSQL real', () => {
  const prisma = new PrismaClient({ datasourceUrl: testUrl });
  const marcaPrueba = `e2e-${Date.now()}`;
  let app: INestApplication;
  let clienteId: number;
  let otroClienteId: number;
  let vacioClienteId: number;
  let vehiculoId: number;
  let token: string;
  let otroToken: string;
  let vacioToken: string;
  let adminToken: string;
  let sinClienteToken: string;

  async function reserva(
    inicioHoras: number,
    finHoras: number,
    estado: EstadoReserva = 'CONFIRMADA',
    propietario = clienteId,
  ) {
    const ahora = Date.now();
    return prisma.reserva.create({
      data: {
        clienteId: propietario,
        vehiculoId,
        fechaInicio: new Date(ahora + inicioHoras * HORA),
        fechaFin: new Date(ahora + finHoras * HORA),
        precioDiario: '1500.25',
        importeTotal: '3000.50',
        estado,
      },
    });
  }

  function cancelar(id: number | string, credencial = token) {
    return request(app.getHttpServer())
      .patch(`/reservas/${id}/cancelar`)
      .set('Authorization', `Bearer ${credencial}`);
  }

  function graphql(
    query: string,
    credencial = token,
    variables?: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${credencial}`)
      .send({ query, variables });
  }

  beforeAll(async () => {
    await prisma.$connect();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const clientes = await Promise.all(
      [1, 2, 3].map((n) =>
        prisma.cliente.create({
          data: {
            documento: `${marcaPrueba}-${n}`,
            email: `${marcaPrueba}-${n}@example.test`,
            nombre: 'Prueba',
            apellido: String(n),
          },
        }),
      ),
    );
    [clienteId, otroClienteId, vacioClienteId] = clientes.map(
      (cliente) => cliente.id,
    );
    vehiculoId = (
      await prisma.vehiculo.create({
        data: {
          patente: marcaPrueba,
          marca: 'Toyota',
          modelo: 'Corolla',
          anio: 2025,
          tipo: 'SEDAN',
          precioDiario: '9999.99',
        },
      })
    ).id;
    const jwt = app.get(JwtService);
    token = jwt.sign({ sub: 1, rol: 'CLIENTE', clienteId });
    otroToken = jwt.sign({ sub: 2, rol: 'CLIENTE', clienteId: otroClienteId });
    vacioToken = jwt.sign({
      sub: 3,
      rol: 'CLIENTE',
      clienteId: vacioClienteId,
    });
    adminToken = jwt.sign({ sub: 4, rol: 'ADMIN' });
    sinClienteToken = jwt.sign({ sub: 5, rol: 'CLIENTE' });
  }, 30000);

  afterAll(async () => {
    const ids = [clienteId, otroClienteId, vacioClienteId].filter(
      Number.isInteger,
    );
    if (ids.length) {
      await prisma.reserva.deleteMany({ where: { clienteId: { in: ids } } });
      await prisma.cliente.deleteMany({ where: { id: { in: ids } } });
    }
    if (vehiculoId) await prisma.vehiculo.delete({ where: { id: vehiculoId } });
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('rechaza solicitudes sin token, tokens inválidos e identificadores inválidos', async () => {
    await request(app.getHttpServer())
      .patch('/reservas/1/cancelar')
      .expect(401);
    await cancelar(1, 'invalido').expect(401);
    await cancelar('texto').expect(400);
  });

  it('un cliente no puede cancelar la reserva de otro ni modificar su propietario con el cuerpo', async () => {
    const ajena = await reserva(24, 49, 'CONFIRMADA', otroClienteId);
    await cancelar(ajena.id).send({ clienteId: otroClienteId }).expect(404);
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: ajena.id } }))
        .estado,
    ).toBe('CONFIRMADA');
  });

  it('solo admite sesiones de cliente con cliente asociado', async () => {
    const propia = await reserva(72, 97);
    await cancelar(propia.id, adminToken).expect(403);
    await cancelar(propia.id, sinClienteToken).expect(403);
    await cancelar(-1).expect(404);
  });

  it('cancela sin borrar y libera disponibilidad y alta de otra reserva en el mismo período', async () => {
    const original = await reserva(1000, 1025);
    const query =
      'query($filtro: FiltroDisponibilidadInput!) { vehiculosDisponibles(filtro: $filtro) { id } }';
    const filtro = {
      fechaInicio: original.fechaInicio.toISOString(),
      fechaFin: original.fechaFin.toISOString(),
    };
    const antes = await graphql(query, token, { filtro });
    expect(antes.body.errors).toBeUndefined();
    expect(
      antes.body.data.vehiculosDisponibles.map((v: { id: number }) => v.id),
    ).not.toContain(vehiculoId);
    await cancelar(original.id).expect(200, {
      id: original.id,
      estado: 'CANCELADA',
    });
    const conservada = await prisma.reserva.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(conservada).toMatchObject({
      clienteId,
      vehiculoId,
      estado: 'CANCELADA',
      fechaInicio: original.fechaInicio,
      fechaFin: original.fechaFin,
    });
    expect(conservada.importeTotal.toString()).toBe('3000.5');
    const despues = await graphql(query, token, { filtro });
    expect(
      despues.body.data.vehiculosDisponibles.map((v: { id: number }) => v.id),
    ).toContain(vehiculoId);
    await request(app.getHttpServer())
      .post('/reservas')
      .send({ clienteId, vehiculoId, ...filtro })
      .expect(201);
  });

  it('rechaza cancelar un alquiler iniciado o que comienza en el instante actual', async () => {
    for (const inicio of [-1, 0]) {
      const iniciada = await reserva(inicio, 2);
      await cancelar(iniciada.id).expect(400);
      expect(
        (await prisma.reserva.findUniqueOrThrow({ where: { id: iniciada.id } }))
          .estado,
      ).toBe('CONFIRMADA');
    }
  });

  it('rechaza cancelar reservas ya canceladas o finalizadas', async () => {
    for (const estado of ['CANCELADA', 'FINALIZADA'] as const) {
      const cerrada = await reserva(24, 49, estado);
      await cancelar(cerrada.id).expect(409);
    }
  });

  it('dos cancelaciones simultáneas producen un único cambio exitoso', async () => {
    const original = await reserva(2000, 2025);
    const respuestas = await Promise.all([
      cancelar(original.id),
      cancelar(original.id),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('el historial incluye finalizadas por fecha y canceladas; excluye futuras, vigentes y ajenas', async () => {
    const vencida = await reserva(-50, -25);
    const cancelada = await reserva(3000, 3025, 'CANCELADA');
    const finalizada = await reserva(-100, -76, 'FINALIZADA');
    const futura = await reserva(4000, 4025);
    const vigente = await reserva(-2, 3);
    const ajena = await reserva(-200, -175, 'FINALIZADA', otroClienteId);
    const respuesta = await graphql(HISTORIAL);
    expect(respuesta.body.errors).toBeUndefined();
    const historial = respuesta.body.data.historialAlquileres;
    const ids = historial.map((r: { id: number }) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([vencida.id, cancelada.id, finalizada.id]),
    );
    for (const id of [futura.id, vigente.id, ajena.id])
      expect(ids).not.toContain(id);
    expect(
      historial.find((r: { id: number }) => r.id === vencida.id),
    ).toMatchObject({
      vehiculo: 'Toyota Corolla',
      patente: marcaPrueba,
      cantidadDias: 2,
      importeTotal: 3000.5,
      estado: 'FINALIZADA',
    });
    expect(
      historial.find((r: { id: number }) => r.id === finalizada.id)
        .cantidadDias,
    ).toBe(1);
    expect(
      historial.find((r: { id: number }) => r.id === cancelada.id).estado,
    ).toBe('CANCELADA');
    // Consultar no cambia el estado persistido ni usa el precio actual del auto.
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: vencida.id } }))
        .estado,
    ).toBe('CONFIRMADA');
    const otraConsulta = await graphql(HISTORIAL, otroToken);
    expect(
      otraConsulta.body.data.historialAlquileres.map(
        (r: { id: number }) => r.id,
      ),
    ).not.toContain(vencida.id);
  });

  it('devuelve un historial vacío cuando el cliente no tiene registros', async () => {
    const respuesta = await graphql(HISTORIAL, vacioToken);
    expect(respuesta.body).toEqual({ data: { historialAlquileres: [] } });
  });

  it('protege el historial frente a tokens inválidos, admin y clientes sin asociación', async () => {
    for (const credencial of ['invalido', adminToken, sinClienteToken]) {
      const respuesta = await graphql(HISTORIAL, credencial);
      expect(respuesta.body.errors).toHaveLength(1);
      expect(respuesta.body.data).toBeNull();
    }
    const sinToken = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: HISTORIAL });
    expect(sinToken.body.errors).toHaveLength(1);
  });

  it('Mis reservas y sus filtros muestran el mismo estado por fecha que el historial', async () => {
    const vencida = await reserva(-500, -475);
    const query =
      'query($filtro: FiltroReservasInput) { reservas(filtro: $filtro) { id estado } }';
    const terminadas = await graphql(query, token, {
      filtro: { estado: 'FINALIZADA', clienteId: otroClienteId },
    });
    expect(terminadas.body.errors).toBeUndefined();
    expect(terminadas.body.data.reservas).toContainEqual({
      id: vencida.id,
      estado: 'FINALIZADA',
    });
    const confirmadas = await graphql(query, token, {
      filtro: {
        estado: 'CONFIRMADA',
        fechaDesde: new Date(Date.now() - 1000 * HORA).toISOString(),
      },
    });
    expect(confirmadas.body.errors).toBeUndefined();
    expect(
      confirmadas.body.data.reservas.map((r: { id: number }) => r.id),
    ).not.toContain(vencida.id);
  });
});
