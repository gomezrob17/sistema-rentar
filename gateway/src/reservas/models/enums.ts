import { registerEnumType } from '@nestjs/graphql';
import { EstadoReserva } from '@prisma/client';


import '../../disponibilidad/models/enums';

registerEnumType(EstadoReserva, { name: 'EstadoReserva' });