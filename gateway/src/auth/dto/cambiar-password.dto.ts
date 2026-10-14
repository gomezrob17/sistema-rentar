import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambiarPasswordDto {
  @ApiProperty({
    example: 'Usuario7*',
    description: 'Contraseña vigente del usuario',
  })
  @IsString()
  @IsNotEmpty()
  passwordActual: string;

  @ApiProperty({
    example: 'NuevaClave123',
    description: 'Nueva contraseña, con un mínimo de 8 caracteres',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  passwordNueva: string;
}