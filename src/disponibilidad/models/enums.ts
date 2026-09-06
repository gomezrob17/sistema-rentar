import { registerEnumType } from '@nestjs/graphql';
import { TipoVehiculo } from '@prisma/client';

// Enum de Prisma a GraphQL para poder usarlo en tipos e inputs
registerEnumType(TipoVehiculo, { name: 'TipoVehiculo' });