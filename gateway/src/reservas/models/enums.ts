import { registerEnumType } from '@nestjs/graphql';

// Mismos valores que los enums de proto/rental.proto (y que Hito 1).
export enum EstadoReserva {
  CONFIRMADA = 'CONFIRMADA',
  CANCELADA = 'CANCELADA',
  FINALIZADA = 'FINALIZADA',
}

// Se registra para poder usarlo en los tipos e inputs de GraphQL
registerEnumType(EstadoReserva, { name: 'EstadoReserva' });
