import { ApiProperty } from '@nestjs/swagger';
import { TipoVehiculo } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CrearVehiculoDto {
  @ApiProperty({ example: 'AB123CD' })
  @IsString()
  @IsNotEmpty()
  patente: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  marca: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  @IsNotEmpty()
  modelo: string;

  @ApiProperty({ example: 2022 })
  @IsInt()
  @Min(1900)
  anio: number;

  @ApiProperty({ example: 'Gris', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ enum: TipoVehiculo, example: TipoVehiculo.SEDAN })
  @IsEnum(TipoVehiculo)
  tipo: TipoVehiculo;

  @ApiProperty({ example: 15000.5 })
  @IsNumber()
  @IsPositive()
  precioDiario: number;
}