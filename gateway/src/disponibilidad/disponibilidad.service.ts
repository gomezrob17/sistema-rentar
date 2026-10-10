import { Injectable } from '@nestjs/common';
import { VehicleClient } from '../grpc/vehicle.client';
import { RentalClient } from '../grpc/rental.client';
import { FiltroDisponibilidadInput } from './dto/filtro-disponibilidad.input';

@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly vehiculos: VehicleClient,
    private readonly reservas: RentalClient,
  ) {}

  async buscar(filtro: FiltroDisponibilidadInput) {
    const { fechaInicio, fechaFin } = filtro;

    // 1) El Rental Service informa qué vehículos tienen una reserva confirmada
    // que se pisa con el período pedido. (Dos períodos se solapan si uno empieza
    // antes de que el otro termine, y viceversa.)
    const ocupados = await this.reservas.vehiculosOcupados(
      fechaInicio.toISOString(),
      fechaFin.toISOString(),
    );

    // 2) El Vehicle Service valida el período, aplica los filtros y excluye los ocupados.
    const vehiculos = await this.vehiculos.buscarDisponibles({
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      tipo: filtro.tipo,
      marca: filtro.marca,
      modelo: filtro.modelo,
      precioMin: filtro.precioMin?.toString(),
      precioMax: filtro.precioMax?.toString(),
      excluidos: ocupados,
    });

    // GraphQL expone el precio como número
    return vehiculos.map((v) => ({
      ...v,
      precioDiario: parseFloat(v.precioDiario),
    }));
  }
}
