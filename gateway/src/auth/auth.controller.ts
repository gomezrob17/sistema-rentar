import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiErroresServicio } from '../grpc/api-errores-servicio';
import { AuthPayload } from './auth.types';
import { AuthService } from './auth.service';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & { user: AuthPayload };

@ApiTags('Autenticación')
@ApiErroresServicio('Customer Service')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión y obtener un token JWT',
    description:
      'Público. Sirve para clientes y para el administrador. El Customer Service verifica la contraseña y que el usuario (y, si es cliente, también su ficha) esté activo. El token incluye el id del usuario, el rol y el id del cliente, y se envía en el encabezado Authorization: Bearer <token>.',
  })
  @ApiCreatedResponse({
    description: 'Credenciales válidas: token y datos del usuario',
    schema: {
      type: 'object',
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        usuario: {
          sub: 2,
          rol: 'CLIENTE',
          clienteId: 4,
          nombre: 'Camila Torres',
          email: 'camila.torres@example.test',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Email con formato inválido o contraseña vacía',
  })
  @ApiUnauthorizedResponse({
    description:
      'Email o contraseña incorrectos, usuario inactivo o cliente dado de baja (el mensaje no revela cuál)',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Patch('password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cambiar la contraseña del usuario autenticado',
    description:
      'Requiere un token válido de cualquier rol. Verifica la contraseña actual antes de guardar la nueva, que debe tener al menos 8 caracteres.',
  })
  @ApiOkResponse({
    description: 'Contraseña actualizada',
    schema: {
      type: 'object',
      example: { mensaje: 'Contraseña actualizada correctamente' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos faltantes o contraseña nueva de menos de 8 caracteres',
  })
  @ApiUnauthorizedResponse({
    description:
      'Token ausente, inválido o vencido, o contraseña actual incorrecta',
  })
  cambiarPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(request.user.sub, dto);
  }
}
