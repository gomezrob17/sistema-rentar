import { ApiProperty } from '@nestjs/swagger';
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
import { TipoVehiculo } from '../vehiculo.enums';

export class CrearVehiculoExternoDto {
  @ApiProperty({ example: 'DEF456' })
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

  @ApiProperty({ example: 2023 })
  @IsInt()
  @Min(1900)
  anio: number;

  @ApiProperty({ example: 'Blanco', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ enum: TipoVehiculo, example: TipoVehiculo.SEDAN })
  @IsEnum(TipoVehiculo)
  tipo: TipoVehiculo;

  @ApiProperty({ example: 32000 })
  @IsNumber()
  @IsPositive()
  precioDiario: number;
}
