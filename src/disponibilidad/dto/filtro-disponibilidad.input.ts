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
@InputType()
export class FiltroDisponibilidadInput {
  // --- El período que se quiere alquilar ---
  @Field()
  @IsDate()
  fechaInicio: Date;

  @Field()
  @IsDate()
  fechaFin: Date;

  // --- Filtros extra ---
  @Field(() => TipoVehiculo, { nullable: true })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipo?: TipoVehiculo;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  marca?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  modelo?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  precioMin?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  precioMax?: number;
}