import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { HealthResolver } from './health/health.resolver';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { DisponibilidadModule } from './disponibilidad/disponibilidad.module';
import { ClientesModule } from './clientes/clientes.module';
import { AuthModule } from './auth/auth.module';
import { ReservasModule } from './reservas/reservas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
    }),
    PrismaModule,
    VehiculosModule,
    DisponibilidadModule,
    ClientesModule,
    AuthModule,
    ReservasModule,
  ],
  providers: [HealthResolver],
})
export class AppModule {}