import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

    return this.prisma.cliente.create({
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : undefined,
      },
    });
  }

  listar() {
    return this.prisma.cliente.findMany({
      orderBy: { id: 'asc' },
    });
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

    return this.prisma.cliente.update({
      where: { id },
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : undefined,
      },
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