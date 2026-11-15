import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegistrarAveriaDto {
  @ApiProperty({
    example: 'Falla en el sistema de frenos',
    description: 'Motivo por el que el vehículo queda fuera de servicio.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}
