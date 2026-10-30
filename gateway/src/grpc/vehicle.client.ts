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

// Mensajes de proto/rentar/vehiculos/v1/vehicle.proto como los entrega
// @grpc/proto-loader: campos en camelCase, enums como texto y decimales como string.
export interface VehiculoGrpc {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color?: string;
  tipo: string;
  precioDiario: string;
  estado: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  verificacion: string;
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

// Los enums de proto llevan el prefijo del enum; la API expone los nombres de
// dominio del enunciado.
const PREFIJO_TIPO = 'TIPO_VEHICULO_';
const PREFIJO_ESTADO = 'ESTADO_VEHICULO_';
const PREFIJO_VERIFICACION = 'VERIFICACION_VEHICULO_';

const aTipoProto = (tipo?: TipoVehiculo) =>
  tipo ? `${PREFIJO_TIPO}${tipo}` : undefined;

const aTipo = (valor: string): TipoVehiculo =>
  valor.replace(PREFIJO_TIPO, '') as TipoVehiculo;

const aEstado = (valor: string): EstadoVehiculo =>
  valor.replace(PREFIJO_ESTADO, '') as EstadoVehiculo;

const aVerificacion = (valor: string): VerificacionVehiculo =>
  valor.replace(PREFIJO_VERIFICACION, '') as VerificacionVehiculo;

// Formas que viajan por gRPC (enums con prefijo).
interface DatosVehiculoGrpc {
  patente?: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  tipo?: string;
  precioDiario?: string;
}

interface FiltroVehiculosGrpc {
  ids?: number[];
  texto?: string;
  tipo?: string;
}

interface FiltroDisponibilidadGrpc {
  fechaInicio: string;
  fechaFin: string;
  tipo?: string;
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
  tipo: string;
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

interface DatosVehiculoExternoGrpc {
  clienteId: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color?: string;
  tipo: string;
  precioDiario: string;
}

export interface FiltroVehiculosExternos {
  clienteId?: number;
}

interface VehicleService {
  crearVehiculo(
    datos: DatosVehiculoGrpc,
  ): Observable<{ vehiculo: VehiculoGrpc }>;
  listarVehiculos(
    filtro: FiltroVehiculosGrpc,
  ): Observable<{ vehiculos: VehiculoGrpc[] }>;
  buscarVehiculoPorId(id: {
    id: number;
  }): Observable<{ vehiculo: VehiculoGrpc }>;
  actualizarVehiculo(
    datos: DatosVehiculoGrpc & { id: number },
  ): Observable<{ vehiculo: VehiculoGrpc }>;
  darDeBajaVehiculo(id: {
    id: number;
  }): Observable<{ vehiculo: VehiculoGrpc }>;
  actualizarEstadoVehiculo(datos: {
    id: number;
    estado: string;
  }): Observable<{ vehiculo: VehiculoGrpc }>;
  buscarVehiculosDisponibles(
    filtro: FiltroDisponibilidadGrpc,
  ): Observable<{ vehiculos: VehiculoGrpc[] }>;
  validarVehiculoParaReserva(id: {
    id: number;
  }): Observable<{ vehiculo: VehiculoGrpc }>;
  registrarVehiculoExterno(
    datos: DatosVehiculoExternoGrpc,
  ): Observable<{ vehiculoExterno: VehiculoExternoGrpc }>;
  buscarVehiculoExternoPorId(id: {
    id: number;
  }): Observable<{ vehiculoExterno: VehiculoExternoGrpc }>;
  listarVehiculosExternos(
    filtro: FiltroVehiculosExternos,
  ): Observable<{ vehiculosExternos: VehiculoExternoGrpc[] }>;
}

// Vehículo con la misma forma que devolvía Hito 1: color en null si no está cargado.
export type Vehiculo = Omit<
  VehiculoGrpc,
  'color' | 'tipo' | 'estado' | 'verificacion'
> & {
  color: string | null;
  tipo: TipoVehiculo;
  estado: EstadoVehiculo;
  verificacion: VerificacionVehiculo;
};

const aVehiculo = (v: VehiculoGrpc): Vehiculo => ({
  ...v,
  color: v.color ?? null,
  tipo: aTipo(v.tipo),
  estado: aEstado(v.estado),
  verificacion: aVerificacion(v.verificacion),
});

const aEstadoExterno = (valor: string): EstadoVehiculoExterno => {
  if (valor === 'ESTADO_VEHICULO_EXTERNO_APROBADO') return 'APROBADO';
  if (valor === 'ESTADO_VEHICULO_EXTERNO_RECHAZADO') return 'RECHAZADO';
  return 'PENDIENTE';
};

const aResultadoValidacion = (
  valor?: string,
): ResultadoValidacion | null => {
  if (!valor || valor === 'RESULTADO_VALIDACION_UNSPECIFIED') return null;
  return valor === 'RESULTADO_VALIDACION_RECHAZADO' ? 'RECHAZADO' : 'VALIDADO';
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
  tipo: aTipo(e.tipo),
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
    const { vehiculo } = await rpc(
      this.servicio.crearVehiculo({
        ...datos,
        tipo: aTipoProto(datos.tipo),
      }),
      NOMBRE,
    );
    return aVehiculo(vehiculo);
  }

  async listar(filtro: FiltroVehiculos = {}) {
    const { vehiculos } = await rpc(
      this.servicio.listarVehiculos({
        ...filtro,
        tipo: aTipoProto(filtro.tipo),
      }),
      NOMBRE,
    );
    return vehiculos.map(aVehiculo);
  }

  async buscarPorId(id: number) {
    const { vehiculo } = await rpc(
      this.servicio.buscarVehiculoPorId({ id }),
      NOMBRE,
    );
    return aVehiculo(vehiculo);
  }

  async actualizar(id: number, datos: DatosVehiculo) {
    const { vehiculo } = await rpc(
      this.servicio.actualizarVehiculo({
        id,
        ...datos,
        tipo: aTipoProto(datos.tipo),
      }),
      NOMBRE,
    );
    return aVehiculo(vehiculo);
  }

  async darDeBaja(id: number) {
    const { vehiculo } = await rpc(
      this.servicio.darDeBajaVehiculo({ id }),
      NOMBRE,
    );
    return aVehiculo(vehiculo);
  }

  async actualizarEstado(id: number, estado: EstadoVehiculo) {
    const { vehiculo } = await rpc(
      this.servicio.actualizarEstadoVehiculo({
        id,
        estado: `${PREFIJO_ESTADO}${estado}`,
      }),
      NOMBRE,
    );
    return aVehiculo(vehiculo);
  }

  async buscarDisponibles(filtro: FiltroDisponibilidad) {
    const { vehiculos } = await rpc(
      this.servicio.buscarVehiculosDisponibles({
        ...filtro,
        tipo: aTipoProto(filtro.tipo),
      }),
      NOMBRE,
    );
    return vehiculos.map(aVehiculo);
  }

  async validarParaReserva(id: number) {
    const { vehiculo } = await rpc(
      this.servicio.validarVehiculoParaReserva({ id }),
      NOMBRE,
    );
    return aVehiculo(vehiculo);
  }

  async registrarExterno(datos: DatosVehiculoExterno) {
    const { vehiculoExterno } = await rpc(
      this.servicio.registrarVehiculoExterno({
        ...datos,
        tipo: `${PREFIJO_TIPO}${datos.tipo}`,
      }),
      NOMBRE,
    );
    return aVehiculoExterno(vehiculoExterno);
  }

  async buscarExternoPorId(id: number) {
    const { vehiculoExterno } = await rpc(
      this.servicio.buscarVehiculoExternoPorId({ id }),
      NOMBRE,
    );
    return aVehiculoExterno(vehiculoExterno);
  }

  async listarExternos(filtro: FiltroVehiculosExternos = {}) {
    const { vehiculosExternos } = await rpc(
      this.servicio.listarVehiculosExternos(filtro),
      NOMBRE,
    );
    return vehiculosExternos.map(aVehiculoExterno);
  }
}
