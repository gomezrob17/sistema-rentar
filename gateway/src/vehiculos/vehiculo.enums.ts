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

// Hito 3: resultado de la verificación policial, independiente del estado.
// ROBADO inhabilita el vehículo para nuevas operaciones.
export enum VerificacionVehiculo {
  PENDIENTE = 'PENDIENTE',
  VALIDADO = 'VALIDADO',
  ROBADO = 'ROBADO',
}

// Se registra para poder usarlo en los tipos e inputs de GraphQL
registerEnumType(TipoVehiculo, { name: 'TipoVehiculo' });
registerEnumType(VerificacionVehiculo, {
  name: 'VerificacionVehiculo',
  description:
    'Resultado de la verificación policial de la patente. PENDIENTE mientras se procesa; ROBADO inhabilita el vehículo.',
});
