import { Field, InputType, Int } from '@nestjs/graphql';
import { EstadoReserva, TipoVehiculo } from '@prisma/client';
import { IsDate, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

@InputType()
export class FiltroReservasInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  clienteId?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  cliente?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  vehiculoId?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  vehiculo?: string;

  @Field(() => TipoVehiculo, { nullable: true })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipo?: TipoVehiculo;

  @Field(() => EstadoReserva, { nullable: true })
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  fechaDesde?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  fechaHasta?: Date;
}