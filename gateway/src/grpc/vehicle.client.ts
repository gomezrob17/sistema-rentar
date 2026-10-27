import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  EstadoVehiculo,
  TipoVehiculo,
  VerificacionVehiculo,
} from '../vehiculos/vehiculo.enums';
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
  verificacion: VerificacionVehiculo;
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

export type EstadoVehiculoExterno = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
export type ResultadoValidacion = 'VALIDADO' | 'RECHAZADO';

export interface VehiculoExternoGrpc {
  id: number;
  clienteId: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color?: string;
  tipo: TipoVehiculo;
  precioDiario: string;
  estado: string;
  validacionPatente?: string;
  validacionTitularidad?: string;
  vehiculoId?: number;
  motivoRechazo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatosVehiculoExterno {
  clienteId: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color?: string;
  tipo: TipoVehiculo;
  precioDiario: string;
}

export interface FiltroVehiculosExternos {
  clienteId?: number;
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
  registrarVehiculoExterno(
    datos: DatosVehiculoExterno,
  ): Observable<VehiculoExternoGrpc>;
  buscarVehiculoExternoPorId(id: {
    id: number;
  }): Observable<VehiculoExternoGrpc>;
  listarVehiculosExternos(
    filtro: FiltroVehiculosExternos,
  ): Observable<{ vehiculosExternos: VehiculoExternoGrpc[] }>;
}

// Vehículo con la misma forma que devolvía Hito 1: color en null si no está cargado.
export type Vehiculo = Omit<VehiculoGrpc, 'color'> & { color: string | null };

const aVehiculo = (v: VehiculoGrpc): Vehiculo => ({
  ...v,
  color: v.color ?? null,
});

// El proto usa nombres de enum con prefijo para no chocar entre enums; la API
// expone los nombres de dominio del enunciado.
const aEstadoExterno = (valor: string): EstadoVehiculoExterno => {
  if (valor === 'EXTERNO_APROBADO') return 'APROBADO';
  if (valor === 'EXTERNO_RECHAZADO') return 'RECHAZADO';
  return 'PENDIENTE';
};

const aResultadoValidacion = (
  valor?: string,
): ResultadoValidacion | null => {
  if (!valor || valor === 'RESULTADO_VALIDACION_SIN_ESPECIFICAR') return null;
  return valor === 'VALIDACION_RECHAZADO' ? 'RECHAZADO' : 'VALIDADO';
};

export interface VehiculoExterno {
  id: number;
  clienteId: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string | null;
  tipo: TipoVehiculo;
  precioDiario: string;
  estado: EstadoVehiculoExterno;
  validacionPatente: ResultadoValidacion | null;
  validacionTitularidad: ResultadoValidacion | null;
  vehiculoId: number | null;
  motivoRechazo: string | null;
  createdAt: string;
  updatedAt: string;
}

const aVehiculoExterno = (e: VehiculoExternoGrpc): VehiculoExterno => ({
  id: e.id,
  clienteId: e.clienteId,
  patente: e.patente,
  marca: e.marca,
  modelo: e.modelo,
  anio: e.anio,
  color: e.color || null,
  tipo: e.tipo,
  precioDiario: e.precioDiario,
  estado: aEstadoExterno(e.estado),
  validacionPatente: aResultadoValidacion(e.validacionPatente),
  validacionTitularidad: aResultadoValidacion(e.validacionTitularidad),
  vehiculoId: e.vehiculoId || null,
  motivoRechazo: e.motivoRechazo || null,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
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

  async registrarExterno(datos: DatosVehiculoExterno) {
    return aVehiculoExterno(
      await rpc(this.servicio.registrarVehiculoExterno(datos), NOMBRE),
    );
  }

  async buscarExternoPorId(id: number) {
    return aVehiculoExterno(
      await rpc(this.servicio.buscarVehiculoExternoPorId({ id }), NOMBRE),
    );
  }

  async listarExternos(filtro: FiltroVehiculosExternos = {}) {
    const { vehiculosExternos } = await rpc(
      this.servicio.listarVehiculosExternos(filtro),
      NOMBRE,
    );
    return vehiculosExternos.map(aVehiculoExterno);
  }
}
