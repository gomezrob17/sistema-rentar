import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { EstadoVehiculo, TipoVehiculo } from '../vehiculos/vehiculo.enums';
import { rpc } from './rpc';

export const VEHICLE_SERVICE = 'VEHICLE_SERVICE';
const NOMBRE = 'Vehicle Service';

// Mensajes de proto/vehicle.proto como los entrega @grpc/proto-loader:
// campos en camelCase, enums como texto y decimales como string.
export interface VehiculoGrpc {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color?: string;
  tipo: TipoVehiculo;
  precioDiario: string;
  estado: EstadoVehiculo;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DatosVehiculo {
  patente?: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  tipo?: TipoVehiculo;
  precioDiario?: string;
}

export interface FiltroVehiculos {
  ids?: number[];
  texto?: string;
  tipo?: TipoVehiculo;
}

export interface FiltroDisponibilidad {
  fechaInicio: string;
  fechaFin: string;
  tipo?: TipoVehiculo;
  marca?: string;
  modelo?: string;
  precioMin?: string;
  precioMax?: string;
  excluidos: number[];
}

interface VehicleService {
  crearVehiculo(datos: DatosVehiculo): Observable<VehiculoGrpc>;
  listarVehiculos(
    filtro: FiltroVehiculos,
  ): Observable<{ vehiculos: VehiculoGrpc[] }>;
  buscarVehiculoPorId(id: { id: number }): Observable<VehiculoGrpc>;
  actualizarVehiculo(
    datos: DatosVehiculo & { id: number },
  ): Observable<VehiculoGrpc>;
  darDeBajaVehiculo(id: { id: number }): Observable<VehiculoGrpc>;
  actualizarEstadoVehiculo(datos: {
    id: number;
    estado: EstadoVehiculo;
  }): Observable<VehiculoGrpc>;
  buscarVehiculosDisponibles(
    filtro: FiltroDisponibilidad,
  ): Observable<{ vehiculos: VehiculoGrpc[] }>;
  validarVehiculoParaReserva(id: { id: number }): Observable<VehiculoGrpc>;
}

// Vehículo con la misma forma que devolvía Hito 1: color en null si no está cargado.
export type Vehiculo = Omit<VehiculoGrpc, 'color'> & { color: string | null };

const aVehiculo = (v: VehiculoGrpc): Vehiculo => ({
  ...v,
  color: v.color ?? null,
});

// Cliente del Vehicle Service. Cada llamada pasa por rpc(): deadline y errores gRPC -> HTTP.
@Injectable()
export class VehicleClient implements OnModuleInit {
  private servicio: VehicleService;

  constructor(@Inject(VEHICLE_SERVICE) private readonly cliente: ClientGrpc) {}

  onModuleInit() {
    this.servicio = this.cliente.getService<VehicleService>('VehicleService');
  }

  async crear(datos: DatosVehiculo) {
    return aVehiculo(await rpc(this.servicio.crearVehiculo(datos), NOMBRE));
  }

  async listar(filtro: FiltroVehiculos = {}) {
    const { vehiculos } = await rpc(
      this.servicio.listarVehiculos(filtro),
      NOMBRE,
    );
    return vehiculos.map(aVehiculo);
  }

  async buscarPorId(id: number) {
    return aVehiculo(
      await rpc(this.servicio.buscarVehiculoPorId({ id }), NOMBRE),
    );
  }

  async actualizar(id: number, datos: DatosVehiculo) {
    return aVehiculo(
      await rpc(this.servicio.actualizarVehiculo({ id, ...datos }), NOMBRE),
    );
  }

  async darDeBaja(id: number) {
    return aVehiculo(
      await rpc(this.servicio.darDeBajaVehiculo({ id }), NOMBRE),
    );
  }

  async actualizarEstado(id: number, estado: EstadoVehiculo) {
    return aVehiculo(
      await rpc(this.servicio.actualizarEstadoVehiculo({ id, estado }), NOMBRE),
    );
  }

  async buscarDisponibles(filtro: FiltroDisponibilidad) {
    const { vehiculos } = await rpc(
      this.servicio.buscarVehiculosDisponibles(filtro),
      NOMBRE,
    );
    return vehiculos.map(aVehiculo);
  }

  async validarParaReserva(id: number) {
    return aVehiculo(
      await rpc(this.servicio.validarVehiculoParaReserva({ id }), NOMBRE),
    );
  }
}
