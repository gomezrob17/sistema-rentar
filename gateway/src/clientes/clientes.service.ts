import { Injectable } from '@nestjs/common';
import { CustomerClient } from '../grpc/customer.client';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

// Contraseña temporal con la que el Customer Service crea el usuario de cada cliente.
const contrasenaTemporal = (id: number) => `Usuario${id}*`;

@Injectable()
export class ClientesService {
  constructor(private readonly clientes: CustomerClient) {}

  async crear(dto: CrearClienteDto) {
    // El Customer Service valida los datos, la unicidad de documento y email,
    // y crea el cliente con su usuario en una sola transacción.
    const cliente = await this.clientes.crear({
      documento: dto.documento,
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      telefono: dto.telefono,
      fechaNacimiento: dto.fechaNacimiento,
    });
    return { ...cliente, contrasenaTemporal: contrasenaTemporal(cliente.id) };
  }

  async listar() {
    const clientes = await this.clientes.listar();
    return clientes.map((cliente) => ({
      ...cliente,
      contrasenaTemporal: contrasenaTemporal(cliente.id),
    }));
  }

  async buscarPorId(id: number) {
    return this.clientes.buscarPorId(id);
  }

  async actualizar(id: number, dto: ActualizarClienteDto) {
    // Si cambia el email, el Customer Service también actualiza el del usuario.
    return this.clientes.actualizar(id, {
      documento: dto.documento,
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      telefono: dto.telefono,
      fechaNacimiento: dto.fechaNacimiento,
    });
  }

  async eliminar(id: number) {
    return this.clientes.darDeBaja(id);
  }
}
