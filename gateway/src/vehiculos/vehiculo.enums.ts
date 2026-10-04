import { registerEnumType } from '@nestjs/graphql';

// Mismos valores que los enums de proto/vehicle.proto (y que Hito 1).
export enum TipoVehiculo {
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  PICKUP = 'PICKUP',
  COUPE = 'COUPE',
  HATCHBACK = 'HATCHBACK',
}

export enum EstadoVehiculo {
  DISPONIBLE = 'DISPONIBLE',
  RESERVADO = 'RESERVADO',
  EN_ALQUILER = 'EN_ALQUILER',
}

// Se registra para poder usarlo en los tipos e inputs de GraphQL
registerEnumType(TipoVehiculo, { name: 'TipoVehiculo' });
