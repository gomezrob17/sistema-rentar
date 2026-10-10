import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import { CustomerClient } from '../grpc/customer.client';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: CustomerClient,
  ) {}

  async crear(dto: CrearClienteDto) {
    // El Customer Service valida los datos y la unicidad de documento y email.
    const cliente = await this.clientes.crear({
      documento: dto.documento,
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      telefono: dto.telefono,
      fechaNacimiento: dto.fechaNacimiento,
    });

    // El usuario sigue viviendo en el gateway: el clienteId es una referencia lógica.
    const contrasenaTemporal = `Usuario${cliente.id}*`;
    try {
      const passwordHash = await bcrypt.hash(contrasenaTemporal, 12);
      await this.prisma.usuario.create({
        data: {
          email: cliente.email,
          passwordHash,
          rol: RolUsuario.CLIENTE,
          clienteId: cliente.id,
        },
      });
    } catch (error) {
      // Compensación: si no se puede crear el usuario, no dejamos un cliente huérfano.
      await this.clientes.darDeBaja(cliente.id).catch(() => undefined);
      throw error;
    }

    return { ...cliente, contrasenaTemporal };
  }

  async listar() {
    const clientes = await this.clientes.listar();
    return clientes.map((cliente) => ({
      ...cliente,
      contrasenaTemporal: `Usuario${cliente.id}*`,
    }));
  }

  async buscarPorId(id: number) {
    return this.clientes.buscarPorId(id);
  }

  async actualizar(id: number, dto: ActualizarClienteDto) {
    const cliente = await this.clientes.actualizar(id, {
      documento: dto.documento,
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      telefono: dto.telefono,
      fechaNacimiento: dto.fechaNacimiento,
    });

    if (dto.email) {
      await this.prisma.usuario.updateMany({
        where: { clienteId: id },
        data: { email: cliente.email },
      });
    }

    return cliente;
  }

  async eliminar(id: number) {
    return this.clientes.darDeBaja(id);
  }
}
