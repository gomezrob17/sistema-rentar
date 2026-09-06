import { Field, Int, ObjectType, Float } from '@nestjs/graphql';
import { TipoVehiculo } from '@prisma/client';

// Esto es lo que la consulta de disponibilidad le devuelve al cliente
@ObjectType()
export class VehiculoDisponible {
  @Field(() => Int)
  id: number;

  @Field()
  patente: string;

  @Field()
  marca: string;

  @Field()
  modelo: string;

  @Field(() => Int)
  anio: number;

  @Field({ nullable: true })
  color?: string;

  @Field(() => TipoVehiculo)
  tipo: TipoVehiculo;

  @Field(() => Float)
  precioDiario: number;
}