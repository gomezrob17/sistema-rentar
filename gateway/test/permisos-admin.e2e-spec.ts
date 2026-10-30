import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Corrección de Hito 1: el administrador está en la base y sus permisos se
// verifican en el backend, tanto en REST como en GraphQL. Requiere el stack
// levantado (el admin lo crea el Customer Service con ADMIN_EMAIL/ADMIN_PASSWORD).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@unla.com.ar';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123';

describe('Autenticación y autorización del administrador', () => {
  let app: INestApplication;
  let adminToken: string;
  let clienteToken: string;
  const vehiculosCreados: number[] = [];

  const http = () => request(app.getHttpServer());
  const conToken = (token?: string) =>
    token ? { Authorization: `Bearer ${token}` } : {};

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    // Un token de cliente válido (firmado con el mismo secreto) alcanza para probar el 403.
    clienteToken = app
      .get(JwtService)
      .sign({ sub: 999, rol: 'CLIENTE', clienteId: 999 });
  });

  afterAll(async () => {
    for (const id of vehiculosCreados) {
      await http().delete(`/vehiculos/${id}`).set(conToken(adminToken));
    }
    if (app) await app.close();
  });

  it('el admin inicia sesión con su usuario de la base y recibe el rol ADMIN', async () => {
    const respuesta = await http()
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(201);
    expect(respuesta.body.usuario).toMatchObject({
      rol: 'ADMIN',
      email: ADMIN_EMAIL,
    });
    expect(respuesta.body.usuario.clienteId).toBeUndefined();
    adminToken = respuesta.body.accessToken;

    await http()
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'incorrecta' })
      .expect(401);
  });

  it('REST: la gestión de clientes es solo del admin', async () => {
    await http().get('/clientes').expect(401);
    await http().get('/clientes').set(conToken(clienteToken)).expect(403);
    await http().get('/clientes').set(conToken(adminToken)).expect(200);
  });

  it('REST: modificar vehículos es del admin y consultarlos es público', async () => {
    const vehiculo = {
      patente: `adm-${Date.now()}`,
      marca: 'Renault',
      modelo: 'Kwid',
      anio: 2024,
      tipo: 'HATCHBACK',
      precioDiario: 20000,
    };
    await http().post('/vehiculos').send(vehiculo).expect(401);
    await http()
      .post('/vehiculos')
      .set(conToken(clienteToken))
      .send(vehiculo)
      .expect(403);
    const creado = await http()
      .post('/vehiculos')
      .set(conToken(adminToken))
      .send(vehiculo)
      .expect(201);
    vehiculosCreados.push(creado.body.id);

    await http()
      .patch(`/vehiculos/${creado.body.id}/estado`)
      .set(conToken(clienteToken))
      .send({ estado: 'RESERVADO' })
      .expect(403);
    await http().get(`/vehiculos/${creado.body.id}`).expect(200);
  });

  it('REST: reservar requiere una sesión de cliente', async () => {
    await http().post('/reservas').send({}).expect(401);
    await http()
      .post('/reservas')
      .set(conToken(adminToken))
      .send({})
      .expect(403);
  });

  it('REST: registrar un vehículo externo requiere una sesión de cliente', async () => {
    await http().post('/vehiculos/externos').send({}).expect(401);
    await http()
      .post('/vehiculos/externos')
      .set(conToken(adminToken))
      .send({})
      .expect(403);
    await http().get('/vehiculos/externos/mios').expect(401);
    await http()
      .get('/vehiculos/externos/mios')
      .set(conToken(adminToken))
      .expect(403);
  });

  it('GraphQL: la consulta de reservas exige sesión y acepta al admin', async () => {
    const query = { query: '{ reservas { id } }' };
    const sinToken = await http().post('/graphql').send(query).expect(200);
    expect(sinToken.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');

    const admin = await http()
      .post('/graphql')
      .set(conToken(adminToken))
      .send(query)
      .expect(200);
    expect(admin.body.errors).toBeUndefined();
    expect(Array.isArray(admin.body.data.reservas)).toBe(true);
  });
});
