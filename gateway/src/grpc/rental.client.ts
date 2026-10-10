import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { EstadoReserva } from '../reservas/models/enums';
import { rpc } from './rpc';

export const RENTAL_SERVICE = 'RENTAL_SERVICE';
const NOMBRE = 'Rental Service';

// Mensajes de proto/rental.proto como los entrega @grpc/proto-loader:
// campos en camelCase, enums como texto y decimales como string.
export interface Reserva {
  id: number;
  clienteId: number;
  vehiculoId: number;
  fechaInicio: string;
  fechaFin: string;
  precioDiario: string;
  importeTotal: string;
  estado: EstadoReserva;
  createdAt: string;
  updatedAt: string;
}

export interface DatosReserva {
  clienteId: number;
  vehiculoId: number;
  fechaInicio: string;
  fechaFin: string;
  precioDiario: string;
}

export interface FiltroReservas {
  clienteId?: number;
  clienteIds?: number[];
  vehiculoId?: number;
  vehiculoIds?: number[];
  estado?: EstadoReserva;
  fechaDesde?: string;
  fechaHasta?: string;
}

interface RentalService {
  crearReserva(datos: DatosReserva): Observable<Reserva>;
  buscarReservaPorId(datos: { id: number }): Observable<Reserva>;
  listarReservas(
    filtro: FiltroReservas,
  ): Observable<{ reservas: Reserva[] }>;
  cancelarReserva(datos: {
    id: number;
    clienteId: number;
  }): Observable<Reserva>;
  historialCliente(datos: {
    clienteId: number;
  }): Observable<{ reservas: Reserva[] }>;
  vehiculosOcupados(datos: {
    fechaInicio: string;
    fechaFin: string;
  }): Observable<{ ids: number[] }>;
}

// Cliente del Rental Service. Cada llamada pasa por rpc(): deadline y errores gRPC -> HTTP.
@Injectable()
export class RentalClient implements OnModuleInit {
  private servicio: RentalService;

  constructor(@Inject(RENTAL_SERVICE) private readonly cliente: ClientGrpc) {}

  onModuleInit() {
    this.servicio = this.cliente.getService<RentalService>('RentalService');
  }

  async crear(datos: DatosReserva) {
    return rpc(this.servicio.crearReserva(datos), NOMBRE);
  }

  async buscarPorId(id: number) {
    return rpc(this.servicio.buscarReservaPorId({ id }), NOMBRE);
  }

  async listar(filtro: FiltroReservas = {}) {
    const { reservas } = await rpc(
      this.servicio.listarReservas(filtro),
      NOMBRE,
    );
    return reservas;
  }

  async cancelar(id: number, clienteId: number) {
    return rpc(this.servicio.cancelarReserva({ id, clienteId }), NOMBRE);
  }

  async historial(clienteId: number) {
    const { reservas } = await rpc(
      this.servicio.historialCliente({ clienteId }),
      NOMBRE,
    );
    return reservas;
  }

  async vehiculosOcupados(fechaInicio: string, fechaFin: string) {
    const { ids } = await rpc(
      this.servicio.vehiculosOcupados({ fechaInicio, fechaFin }),
      NOMBRE,
    );
    return ids;
  }
}
