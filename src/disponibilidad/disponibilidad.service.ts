import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FiltroDisponibilidadInput } from './dto/filtro-disponibilidad.input';

@Injectable()
export class DisponibilidadService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(filtro: FiltroDisponibilidadInput) {
    const { fechaInicio, fechaFin } = filtro;

    // --- Validaciones de fechas ---
    if (fechaInicio >= fechaFin) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }
    if (fechaInicio < new Date()) {
      throw new BadRequestException('La fecha de inicio debe ser futura');
    }

    // --- Filtros opcionales ---
    // Un vehículo, para aparecer en las busquedas tiene que estar activo y disponible
    const where: Prisma.VehiculoWhereInput = {
      activo: true,
      estado: 'DISPONIBLE',
    };

    if (filtro.tipo) where.tipo = filtro.tipo;
    if (filtro.marca) {
      where.marca = { contains: filtro.marca, mode: 'insensitive' };
    }
    if (filtro.modelo) {
      where.modelo = { contains: filtro.modelo, mode: 'insensitive' };
    }

    // Para el Rango de precio solo agregamos lo que el cliente haya mandado
    if (filtro.precioMin != null || filtro.precioMax != null) {
      where.precioDiario = {};
      if (filtro.precioMin != null) where.precioDiario.gte = filtro.precioMin;
      if (filtro.precioMax != null) where.precioDiario.lte = filtro.precioMax;
    }

    // Excluimos los vehículos que ya tengan una reserva CONFIRMADA que se
    // pise con el período pedido. (Dos períodos se solapan si uno empieza
    // antes de que el otro termine, y viceversa)
    where.reservas = {
      none: {
        estado: 'CONFIRMADA',
        fechaInicio: { lt: fechaFin },
        fechaFin: { gt: fechaInicio },
      },
    };

    return this.prisma.vehiculo.findMany({
      where,
      orderBy: { precioDiario: 'asc' },
    });
  }
}