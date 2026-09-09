import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

@Injectable()
export class ClientesService {
  // Acceso a la base con NestJS
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearClienteDto) {
    const existente = await this.prisma.cliente.findFirst({
      where: {
        OR: [{ documento: dto.documento }, { email: dto.email }],
      },
    });

    if (existente) {
      throw new ConflictException(
        'Ya existe un cliente con ese documento o email',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          ...dto,
          fechaNacimiento: dto.fechaNacimiento
            ? new Date(dto.fechaNacimiento)
            : undefined,
        },
      });

      const contrasenaTemporal = `Usuario${cliente.id}*`;
      const passwordHash = await bcrypt.hash(contrasenaTemporal, 12);

      await tx.usuario.create({
        data: {
          email: cliente.email,
          passwordHash,
          rol: RolUsuario.CLIENTE,
          clienteId: cliente.id,
        },
      });

      return { ...cliente, contrasenaTemporal };
    });
  }

  async listar() {
    const clientes = await this.prisma.cliente.findMany({
      orderBy: { id: 'asc' },
    });

    return clientes.map((cliente) => ({
      ...cliente,
      contrasenaTemporal: `Usuario${cliente.id}*`,
    }));
  }

  async buscarPorId(id: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException(`No se encontró el cliente con id ${id}`);
    }

    return cliente;
  }

  async actualizar(id: number, dto: ActualizarClienteDto) {
    await this.buscarPorId(id);

    if (dto.documento) {
      const documentoExistente = await this.prisma.cliente.findFirst({
        where: {
          documento: dto.documento,
          NOT: { id },
        },
      });

      if (documentoExistente) {
        throw new ConflictException(
          'Ya existe otro cliente con ese documento',
        );
      }
    }

    if (dto.email) {
      const emailExistente = await this.prisma.cliente.findFirst({
        where: {
          email: dto.email,
          NOT: { id },
        },
      });

      if (emailExistente) {
        throw new ConflictException('Ya existe otro cliente con ese email');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.update({
        where: { id },
        data: {
          ...dto,
          fechaNacimiento: dto.fechaNacimiento
            ? new Date(dto.fechaNacimiento)
            : undefined,
        },
      });

      if (dto.email) {
        await tx.usuario.updateMany({
          where: { clienteId: id },
          data: { email: dto.email },
        });
      }

      return cliente;
    });
  }

  async eliminar(id: number) {
    await this.buscarPorId(id);

    return this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
  }
}