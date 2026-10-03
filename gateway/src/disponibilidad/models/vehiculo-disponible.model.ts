import { Field, Int, ObjectType, Float } from '@nestjs/graphql';
import { TipoVehiculo } from '@prisma/client';

// Esto es lo que la consulta de disponibilidad le devuelve al cliente
@ObjectType({
  description: 'Vehículo sin reservas confirmadas en el período consultado.',
})
export class VehiculoDisponible {
  @Field(() => Int, { description: 'Identificador del vehículo.' })
  id: number;

  @Field({ description: 'Patente del vehículo.' })
  patente: string;

  @Field({ description: 'Marca del vehículo.' })
  marca: string;

  @Field({ description: 'Modelo del vehículo.' })
  modelo: string;

  @Field(() => Int, { description: 'Año de fabricación del vehículo.' })
  anio: number;

  @Field({ nullable: true, description: 'Color del vehículo, si está cargado.' })
  color?: string;

  @Field(() => TipoVehiculo, { description: 'Tipo de vehículo.' })
  tipo: TipoVehiculo;

  @Field(() => Float, { description: 'Precio de alquiler por día.' })
  precioDiario: number;
}