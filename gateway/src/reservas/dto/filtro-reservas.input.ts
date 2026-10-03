import { Field, InputType, Int } from '@nestjs/graphql';
import { EstadoReserva, TipoVehiculo } from '@prisma/client';
import { IsDate, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

@InputType({ description: 'Filtros opcionales para la consulta de reservas.' })
export class FiltroReservasInput {
  @Field(() => Int, {
    nullable: true,
    description: 'Filtra por identificador de cliente.',
  })
  @IsOptional()
  @IsInt()
  clienteId?: number;

  @Field({
    nullable: true,
    description: 'Filtra por nombre o apellido del cliente.',
  })
  @IsOptional()
  @IsString()
  cliente?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Filtra por identificador de vehículo.',
  })
  @IsOptional()
  @IsInt()
  vehiculoId?: number;

  @Field({
    nullable: true,
    description: 'Filtra por marca o modelo del vehículo.',
  })
  @IsOptional()
  @IsString()
  vehiculo?: string;

  @Field(() => TipoVehiculo, {
    nullable: true,
    description: 'Filtra por tipo de vehículo.',
  })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipo?: TipoVehiculo;

  @Field(() => EstadoReserva, {
    nullable: true,
    description: 'Filtra por estado de la reserva.',
  })
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;

  @Field({
    nullable: true,
    description: 'Incluye solo reservas cuyo inicio sea igual o posterior a esta fecha.',
  })
  @IsOptional()
  @IsDate()
  fechaDesde?: Date;

  @Field({
    nullable: true,
    description: 'Incluye solo reservas cuyo fin sea igual o anterior a esta fecha.',
  })
  @IsOptional()
  @IsDate()
  fechaHasta?: Date;
}