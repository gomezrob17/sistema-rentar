import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { RolUsuario } from '../auth/auth.types';
import { rpc } from './rpc';

export const CUSTOMER_SERVICE = 'CUSTOMER_SERVICE';
const NOMBRE = 'Customer Service';

// Mensajes de proto/rentar/clientes/v1/customer.proto como los entrega
// @grpc/proto-loader: campos en camelCase y fechas como string.
export interface ClienteGrpc {
  id: number;
  documento: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  fechaNacimiento?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DatosCliente {
  documento?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  fechaNacimiento?: string;
}

export interface FiltroClientes {
  ids?: number[];
  texto?: string;
}

// El enum de proto lleva el prefijo ROL_USUARIO_; la API expone el rol de dominio.
const PREFIJO_ROL = 'ROL_USUARIO_';

const aRol = (valor: string): RolUsuario =>
  valor.replace(PREFIJO_ROL, '') as RolUsuario;

export interface UsuarioAutenticadoGrpc {
  usuarioId: number;
  rol: string;
  clienteId?: number;
  nombre: string;
  email: string;
}

export interface UsuarioAutenticado {
  usuarioId: number;
  rol: RolUsuario;
  clienteId?: number;
  nombre: string;
  email: string;
}

interface CustomerService {
  crearCliente(
    datos: DatosCliente,
  ): Observable<{ cliente: ClienteGrpc }>;
  listarClientes(
    filtro: FiltroClientes,
  ): Observable<{ clientes: ClienteGrpc[] }>;
  buscarClientePorId(id: {
    id: number;
  }): Observable<{ cliente: ClienteGrpc }>;
  actualizarCliente(
    datos: DatosCliente & { id: number },
  ): Observable<{ cliente: ClienteGrpc }>;
  darDeBajaCliente(id: {
    id: number;
  }): Observable<{ cliente: ClienteGrpc }>;
  existeCliente(id: { id: number }): Observable<{ existe: boolean }>;
  validarClienteParaReserva(id: {
    id: number;
  }): Observable<{ cliente: ClienteGrpc }>;
  autenticar(credenciales: {
    email: string;
    password: string;
  }): Observable<{ usuario: UsuarioAutenticadoGrpc }>;
  cambiarContrasena(datos: {
    usuarioId: number;
    actual: string;
    nueva: string;
  }): Observable<object>;
}

// Cliente con la misma forma que devolvía Hito 1: telefono y fechaNacimiento
// en null si no están cargados.
export type Cliente = Omit<ClienteGrpc, 'telefono' | 'fechaNacimiento'> & {
  telefono: string | null;
  fechaNacimiento: string | null;
};

const aCliente = (c: ClienteGrpc): Cliente => ({
  ...c,
  telefono: c.telefono || null,
  fechaNacimiento: c.fechaNacimiento || null,
});

// Cliente del Customer Service. Cada llamada pasa por rpc(): deadline y errores gRPC -> HTTP.
@Injectable()
export class CustomerClient implements OnModuleInit {
  private servicio: CustomerService;

  constructor(@Inject(CUSTOMER_SERVICE) private readonly cliente: ClientGrpc) {}

  onModuleInit() {
    this.servicio = this.cliente.getService<CustomerService>('CustomerService');
  }

  async crear(datos: DatosCliente) {
    const { cliente } = await rpc(this.servicio.crearCliente(datos), NOMBRE);
    return aCliente(cliente);
  }

  async listar(filtro: FiltroClientes = {}) {
    const { clientes } = await rpc(
      this.servicio.listarClientes(filtro),
      NOMBRE,
    );
    return clientes.map(aCliente);
  }

  async buscarPorId(id: number) {
    const { cliente } = await rpc(
      this.servicio.buscarClientePorId({ id }),
      NOMBRE,
    );
    return aCliente(cliente);
  }

  async actualizar(id: number, datos: DatosCliente) {
    const { cliente } = await rpc(
      this.servicio.actualizarCliente({ id, ...datos }),
      NOMBRE,
    );
    return aCliente(cliente);
  }

  async darDeBaja(id: number) {
    const { cliente } = await rpc(
      this.servicio.darDeBajaCliente({ id }),
      NOMBRE,
    );
    return aCliente(cliente);
  }

  async existe(id: number) {
    const { existe } = await rpc(this.servicio.existeCliente({ id }), NOMBRE);
    return existe;
  }

  async validarParaReserva(id: number) {
    const { cliente } = await rpc(
      this.servicio.validarClienteParaReserva({ id }),
      NOMBRE,
    );
    return aCliente(cliente);
  }

  async autenticar(
    email: string,
    password: string,
  ): Promise<UsuarioAutenticado> {
    const { usuario } = await rpc(
      this.servicio.autenticar({ email, password }),
      NOMBRE,
    );
    return { ...usuario, rol: aRol(usuario.rol) };
  }

  async cambiarContrasena(usuarioId: number, actual: string, nueva: string) {
    await rpc(
      this.servicio.cambiarContrasena({ usuarioId, actual, nueva }),
      NOMBRE,
    );
  }
}
