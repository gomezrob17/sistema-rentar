import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleClient } from '../grpc/vehicle.client';
import { FiltroDisponibilidadInput } from './dto/filtro-disponibilidad.input';

@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiculos: VehicleClient,
  ) {}

  async buscar(filtro: FiltroDisponibilidadInput) {
    const { fechaInicio, fechaFin } = filtro;

    // 1) Vehículos con una reserva CONFIRMADA que se pisa con el período pedido.
    // (Dos períodos se solapan si uno empieza antes de que el otro termine, y viceversa.)
    // ponytail: las reservas siguen en el gateway hasta el punto 4 (Rental Service).
    const ocupados = await this.prisma.reserva.findMany({
      where: {
        estado: 'CONFIRMADA',
        fechaInicio: { lt: fechaFin },
        fechaFin: { gt: fechaInicio },
      },
      select: { vehiculoId: true },
      distinct: ['vehiculoId'],
    });

    // 2) El Vehicle Service valida el período, aplica los filtros y excluye los ocupados.
    const vehiculos = await this.vehiculos.buscarDisponibles({
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      tipo: filtro.tipo,
      marca: filtro.marca,
      modelo: filtro.modelo,
      precioMin: filtro.precioMin?.toString(),
      precioMax: filtro.precioMax?.toString(),
      excluidos: ocupados.map((reserva) => reserva.vehiculoId),
    });

    // GraphQL expone el precio como número
    return vehiculos.map((v) => ({
      ...v,
      precioDiario: parseFloat(v.precioDiario),
    }));
  }
}
