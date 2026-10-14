import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'cliente@email.com',
    description: 'Email asociado al usuario cliente',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Usuario7*',
    description: 'Contraseña actual del usuario',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}