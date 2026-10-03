import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { EstadoReserva, TipoVehiculo } from '@prisma/client';

@ObjectType({ description: 'Reserva de un vehículo, con sus datos asociados.' })
export class ReservaConsulta {
  @Field(() => Int, { description: 'Identificador de la reserva.' })
  id: number;

  @Field(() => Int, { description: 'Identificador del cliente.' })
  clienteId: number;

  @Field({ description: 'Apellido y nombre del cliente' })
  cliente: string;

  @Field(() => Int, { description: 'Identificador del vehículo.' })
  vehiculoId: number;

  @Field({ description: 'Marca y modelo del vehículo' })
  vehiculo: string;

  @Field({ description: 'Patente del vehículo.' })
  patente: string;

  @Field(() => TipoVehiculo, { description: 'Tipo de vehículo.' })
  tipo: TipoVehiculo;

  @Field({ description: 'Fecha y hora de inicio del período reservado.' })
  fechaInicio: Date;

  @Field({ description: 'Fecha y hora de finalización del período reservado.' })
  fechaFin: Date;

  @Field(() => Float, { description: 'Precio de alquiler por día.' })
  precioDiario: number;

  @Field(() => Float, { description: 'Importe total de la reserva.' })
  importeTotal: number;

  @Field(() => EstadoReserva, { description: 'Estado actual de la reserva.' })
  estado: EstadoReserva;
}