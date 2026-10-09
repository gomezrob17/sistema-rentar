import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
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

// Las reservas viven en el Rental Service. El test las siembra con SQL crudo en
// esa base (usa Prisma solo para las consultas crudas) y las limpia al final.
const rentalUrl = process.env.TEST_RENTAL_DATABASE_URL;
if (!rentalUrl || new URL(rentalUrl).pathname !== '/rentar_alquileres') {
  throw new Error(
    'Definí TEST_RENTAL_DATABASE_URL apuntando a la base rentar_alquileres del Rental Service.',
  );
}

const HORA = 60 * 60 * 1000;
const HISTORIAL =
  '{ historialAlquileres { id vehiculo patente fechaInicio fechaFin cantidadDias importeTotal estado } }';

describe('Puntos 6 y 7 con PostgreSQL real', () => {
  const prisma = new PrismaClient({ datasourceUrl: testUrl });
  const rental = new PrismaClient({ datasourceUrl: rentalUrl });
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

  type FilaReserva = {
    id: number;
    clienteId: number;
    vehiculoId: number;
    fechaInicio: Date;
    fechaFin: Date;
    estado: string;
    importeTotal: { toString(): string };
  };

  async function leerReserva(id: number): Promise<FilaReserva> {
    const [fila] = await rental.$queryRawUnsafe<FilaReserva[]>(
      `SELECT id,
              cliente_id AS "clienteId",
              vehiculo_id AS "vehiculoId",
              fecha_inicio AS "fechaInicio",
              fecha_fin AS "fechaFin",
              estado::text AS estado,
              importe_total AS "importeTotal"
       FROM reservas WHERE id = $1`,
      id,
    );
    if (!fila) throw new Error(`No existe la reserva ${id}`);
    return fila;
  }

  async function reserva(
    inicioHoras: number,
    finHoras: number,
    estado = 'CONFIRMADA',
    propietario = clienteId,
  ): Promise<FilaReserva> {
    const ahora = Date.now();
    const [creada] = await rental.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO reservas
         (cliente_id, vehiculo_id, fecha_inicio, fecha_fin, precio_diario, importe_total, estado, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::estado_reserva, $8, $8)
       RETURNING id`,
      propietario,
      vehiculoId,
      new Date(ahora + inicioHoras * HORA),
      new Date(ahora + finHoras * HORA),
      '1500.25',
      '3000.50',
      estado,
      new Date(),
    );
    return leerReserva(creada.id);
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
    await rental.$connect();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const clientes: { id: number }[] = [];
    for (const n of [1, 2, 3]) {
      const respuesta = await request(app.getHttpServer())
        .post('/clientes')
        .send({
          documento: `${marcaPrueba}-${n}`,
          email: `${marcaPrueba}-${n}@example.test`,
          nombre: 'Prueba',
          apellido: String(n),
        })
        .expect(201);
      clientes.push(respuesta.body);
    }
    [clienteId, otroClienteId, vacioClienteId] = clientes.map(
      (cliente) => cliente.id,
    );
    // Desde el Hito 2 el vehículo vive en el Vehicle Service: se crea por la API del gateway.
    vehiculoId = (
      await request(app.getHttpServer())
        .post('/vehiculos')
        .send({
          patente: marcaPrueba,
          marca: 'Toyota',
          modelo: 'Corolla',
          anio: 2025,
          tipo: 'SEDAN',
          precioDiario: 9999.99,
        })
        .expect(201)
    ).body.id;
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
      await rental.$executeRawUnsafe(
        'DELETE FROM reservas WHERE cliente_id = ANY($1::int[])',
        ids,
      );
      await prisma.usuario.deleteMany({ where: { clienteId: { in: ids } } });
      // Los clientes viven en el Customer Service: se dan de baja por su API.
      for (const id of ids) {
        await request(app.getHttpServer()).delete(`/clientes/${id}`);
      }
    }
    // El Vehicle Service no borra vehículos: queda dado de baja.
    if (vehiculoId) {
      await request(app.getHttpServer()).delete(`/vehiculos/${vehiculoId}`);
    }
    if (app) await app.close();
    await prisma.$disconnect();
    await rental.$disconnect();
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
    expect((await leerReserva(ajena.id)).estado).toBe('CONFIRMADA');
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
    const conservada = await leerReserva(original.id);
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
      expect((await leerReserva(iniciada.id)).estado).toBe('CONFIRMADA');
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
    expect((await leerReserva(vencida.id)).estado).toBe('CONFIRMADA');
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
