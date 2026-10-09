import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerClient } from '../grpc/customer.client';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly clientes: CustomerClient,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    // El cliente vive en el Customer Service: se consulta por su id lógico.
    // Cualquier falla (no existe, servicio caído) se trata como credencial inválida.
    const cliente =
      usuario?.rol === RolUsuario.CLIENTE && usuario.clienteId != null
        ? await this.clientes
            .buscarPorId(usuario.clienteId)
            .catch(() => null)
        : null;

    if (!usuario || !usuario.activo || !cliente?.activo) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const coincide = await bcrypt.compare(dto.password, usuario.passwordHash);

    if (!coincide) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const payload = {
      sub: usuario.id,
      rol: usuario.rol,
      clienteId: cliente.id,
      nombre: `${cliente.nombre} ${cliente.apellido}`,
      email: usuario.email,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: payload,
    };
  }

  async cambiarPassword(usuarioId: number, dto: CambiarPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const coincide = await bcrypt.compare(
      dto.passwordActual,
      usuario.passwordHash,
    );

    if (!coincide) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const passwordHash = await bcrypt.hash(dto.passwordNueva, 12);

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash },
    });

    return { mensaje: 'Contraseña actualizada correctamente' };
  }
}