import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomerClient } from '../grpc/customer.client';
import { AuthPayload } from './auth.types';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';

// Los usuarios y sus contraseñas viven en el Customer Service. El gateway solo
// firma y valida el JWT: credenciales inválidas -> 401, servicio caído -> 503/504.
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly clientes: CustomerClient,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.clientes.autenticar(dto.email, dto.password);

    const payload: AuthPayload = {
      sub: usuario.usuarioId,
      rol: usuario.rol,
      clienteId: usuario.clienteId,
      nombre: usuario.nombre,
      email: usuario.email,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: payload,
    };
  }

  async cambiarPassword(usuarioId: number, dto: CambiarPasswordDto) {
    await this.clientes.cambiarContrasena(
      usuarioId,
      dto.passwordActual,
      dto.passwordNueva,
    );
    return { mensaje: 'Contraseña actualizada correctamente' };
  }
}
