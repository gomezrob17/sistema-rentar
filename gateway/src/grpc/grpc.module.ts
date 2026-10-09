import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { VEHICLE_SERVICE, VehicleClient } from './vehicle.client';
import { CUSTOMER_SERVICE, CustomerClient } from './customer.client';

// Clientes gRPC hacia los servicios internos. Es global para no importarlo en cada módulo.
@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: VEHICLE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'rentar.vehiculos.v1',
            // Los .proto viven en la raíz del repo (en Docker se copian a /proto).
            protoPath: join(
              config.get('PROTO_DIR', join(process.cwd(), '..', 'proto')),
              'vehicle.proto',
            ),
            url: config.get('VEHICLE_SERVICE_URL', 'localhost:50051'),
            // camelCase, enums como texto y valores por defecto (activo: false, listas vacías)
            loader: { keepCase: false, enums: String, defaults: true },
          },
        }),
      },
      {
        name: CUSTOMER_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'rentar.clientes.v1',
            protoPath: join(
              config.get('PROTO_DIR', join(process.cwd(), '..', 'proto')),
              'customer.proto',
            ),
            url: config.get('CUSTOMER_SERVICE_URL', 'localhost:50052'),
            loader: { keepCase: false, enums: String, defaults: true },
          },
        }),
      },
    ]),
  ],
  providers: [VehicleClient, CustomerClient],
  exports: [VehicleClient, CustomerClient],
})
export class GrpcModule {}
