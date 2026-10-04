import { registerEnumType } from '@nestjs/graphql';
import { EstadoReserva } from '@prisma/client';

registerEnumType(EstadoReserva, { name: 'EstadoReserva' });
