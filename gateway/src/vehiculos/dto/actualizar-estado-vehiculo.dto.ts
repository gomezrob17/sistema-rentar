import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoVehiculo } from '../vehiculo.enums';

export class ActualizarEstadoVehiculoDto {
  @ApiProperty({ enum: EstadoVehiculo, example: EstadoVehiculo.RESERVADO })
  @IsEnum(EstadoVehiculo)
  estado: EstadoVehiculo;
}
