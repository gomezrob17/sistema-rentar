import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';

@Injectable()
export class VehiculosService {
  // Acceso a la base con NestJS
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearVehiculoDto) {
    // La patente es única: si ya hay un vehículo con esa patente, no se permite la creación de otro con la misma
    const existente = await this.prisma.vehiculo.findUnique({
      where: { patente: dto.patente },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe un vehículo con la patente ${dto.patente}`,
      );
    }

    // Aclaración: No se setea estado ni activo. La base los pone en DISPONIBLE y true
    // por defecto, es lo que pide el TP al dar de alta
    return this.prisma.vehiculo.create({ data: dto });
  }

  listar() {
    return this.prisma.vehiculo.findMany({ orderBy: { id: 'asc' } });
  }

  async buscarPorId(id: number) {
    const vehiculo = await this.prisma.vehiculo.findUnique({ where: { id } });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontró el vehículo con id ${id}`);
    }
    return vehiculo;
  }

  async actualizar(id: number, dto: ActualizarVehiculoDto) {
    // Nos aseguramos de que exista, si no, buscarPorId tira un 404
    await this.buscarPorId(id);
    // La patente no viene en el DTO de actualización, así que no se puede modificar
    return this.prisma.vehiculo.update({ where: { id }, data: dto });
  }

  async eliminar(id: number) {
    await this.buscarPorId(id);
    // Baja: no borramos el registro, solo lo marcamos como inactivo
    return this.prisma.vehiculo.update({
      where: { id },
      data: { activo: false },
    });
  }
}