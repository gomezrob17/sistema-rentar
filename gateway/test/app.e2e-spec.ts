import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HealthResolver (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GraphQL ping responde pong', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ ping }' })
      .expect(200)
      .expect({ data: { ping: 'pong' } });
  });

  afterEach(async () => {
    await app.get(PrismaService).$disconnect();
    await app.close();
  });
});
