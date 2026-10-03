import { Field, InputType, Float } from '@nestjs/graphql';
import { TipoVehiculo } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// Datos que el cliente manda para buscar para la disponibilidad
@InputType({
  description: 'Filtros para buscar vehículos disponibles en un período.',
})
export class FiltroDisponibilidadInput {
  // --- El período que se quiere alquilar ---
  @Field({ description: 'Fecha y hora de inicio del período a consultar.' })
  @IsDate()
  fechaInicio: Date;

  @Field({ description: 'Fecha y hora de fin del período a consultar.' })
  @IsDate()
  fechaFin: Date;

  // --- Filtros extra ---
  @Field(() => TipoVehiculo, {
    nullable: true,
    description: 'Filtra por tipo de vehículo.',
  })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipo?: TipoVehiculo;

  @Field({ nullable: true, description: 'Filtra por marca del vehículo.' })
  @IsOptional()
  @IsString()
  marca?: string;

  @Field({ nullable: true, description: 'Filtra por modelo del vehículo.' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Precio diario mínimo a considerar.',
  })
  @IsOptional()
  @IsNumber()
  precioMin?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Precio diario máximo a considerar.',
  })
  @IsOptional()
  @IsNumber()
  precioMax?: number;
}