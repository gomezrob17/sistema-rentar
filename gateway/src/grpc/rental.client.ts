import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { EstadoReserva } from '../reservas/models/enums';
import { rpc } from './rpc';

export const RENTAL_SERVICE = 'RENTAL_SERVICE';
const NOMBRE = 'Rental Service';

// Mensajes de proto/rentar/alquileres/v1/rental.proto como los entrega
// @grpc/proto-loader: campos en camelCase, enums como texto y decimales como string.
export interface ReservaGrpc {
  id: number;
  clienteId: number;
  vehiculoId: number;
  fechaInicio: string;
  fechaFin: string;
  precioDiario: string;
  importeTotal: string;
  estado: string;
  createdAt: string;
  updatedAt: string;
  mantenimiento?: string;
}

export type Reserva = Omit<ReservaGrpc, 'estado'> & {
  estado: EstadoReserva;
};

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

// El enum de proto lleva el prefijo ESTADO_RESERVA_; la API expone el estado de dominio.
const PREFIJO_ESTADO = 'ESTADO_RESERVA_';

const aEstado = (valor: string): EstadoReserva =>
  valor.replace(PREFIJO_ESTADO, '') as EstadoReserva;

const aEstadoProto = (estado?: EstadoReserva) =>
  estado ? `${PREFIJO_ESTADO}${estado}` : undefined;

const aReserva = (r: ReservaGrpc): Reserva => ({
  ...r,
  estado: aEstado(r.estado),
});

interface RentalService {
  crearReserva(datos: DatosReserva): Observable<{ reserva: ReservaGrpc }>;
  buscarReservaPorId(datos: {
    id: number;
  }): Observable<{ reserva: ReservaGrpc }>;
  listarReservas(
    filtro: Omit<FiltroReservas, 'estado'> & { estado?: string },
  ): Observable<{ reservas: ReservaGrpc[] }>;
  cancelarReserva(datos: {
    id: number;
    clienteId: number;
  }): Observable<{ reserva: ReservaGrpc }>;
  historialCliente(datos: {
    clienteId: number;
  }): Observable<{ reservas: ReservaGrpc[] }>;
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
    const { reserva } = await rpc(
      this.servicio.crearReserva(datos),
      NOMBRE,
    );
    return aReserva(reserva);
  }

  async buscarPorId(id: number) {
    const { reserva } = await rpc(
      this.servicio.buscarReservaPorId({ id }),
      NOMBRE,
    );
    return aReserva(reserva);
  }

  async listar(filtro: FiltroReservas = {}) {
    const { reservas } = await rpc(
      this.servicio.listarReservas({
        ...filtro,
        estado: aEstadoProto(filtro.estado),
      }),
      NOMBRE,
    );
    return reservas.map(aReserva);
  }

  async cancelar(id: number, clienteId: number) {
    const { reserva } = await rpc(
      this.servicio.cancelarReserva({ id, clienteId }),
      NOMBRE,
    );
    return aReserva(reserva);
  }

  async historial(clienteId: number) {
    const { reservas } = await rpc(
      this.servicio.historialCliente({ clienteId }),
      NOMBRE,
    );
    return reservas.map(aReserva);
  }

  async vehiculosOcupados(fechaInicio: string, fechaFin: string) {
    const { ids } = await rpc(
      this.servicio.vehiculosOcupados({ fechaInicio, fechaFin }),
      NOMBRE,
    );
    return ids;
  }
}
