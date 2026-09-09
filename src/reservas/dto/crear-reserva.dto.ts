import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsPositive } from 'class-validator';

export class CrearReservaDto {
  @ApiProperty({ example: 1, description: 'Id del cliente que reserva' })
  @IsInt()
  @IsPositive()
  clienteId: number;

  @ApiProperty({ example: 1, description: 'Id del vehículo a reservar' })
  @IsInt()
  @IsPositive()
  vehiculoId: number;

  @ApiProperty({
    example: '2026-09-20T10:00:00.000Z',
    description: 'Fecha y hora de inicio del alquiler',
  })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({
    example: '2026-09-25T10:00:00.000Z',
    description: 'Fecha y hora de finalización del alquiler',
  })
  @IsDateString()
  fechaFin: string;
}
