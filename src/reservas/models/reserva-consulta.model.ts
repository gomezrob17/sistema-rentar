import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { EstadoReserva, TipoVehiculo } from '@prisma/client';

@ObjectType()
export class ReservaConsulta {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  clienteId: number;

  @Field({ description: 'Apellido y nombre del cliente' })
  cliente: string;

  @Field(() => Int)
  vehiculoId: number;

  @Field({ description: 'Marca y modelo del vehículo' })
  vehiculo: string;

  @Field()
  patente: string;

  @Field(() => TipoVehiculo)
  tipo: TipoVehiculo;

  @Field()
  fechaInicio: Date;

  @Field()
  fechaFin: Date;

  @Field(() => Float)
  precioDiario: number;

  @Field(() => Float)
  importeTotal: number;

  @Field(() => EstadoReserva)
  estado: EstadoReserva;
}