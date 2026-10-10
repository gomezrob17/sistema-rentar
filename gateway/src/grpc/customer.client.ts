import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { rpc } from './rpc';

export const CUSTOMER_SERVICE = 'CUSTOMER_SERVICE';
const NOMBRE = 'Customer Service';

// Mensajes de proto/customer.proto como los entrega @grpc/proto-loader:
// campos en camelCase y fechas como string.
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

interface CustomerService {
  crearCliente(datos: DatosCliente): Observable<ClienteGrpc>;
  listarClientes(
    filtro: FiltroClientes,
  ): Observable<{ clientes: ClienteGrpc[] }>;
  buscarClientePorId(id: { id: number }): Observable<ClienteGrpc>;
  actualizarCliente(
    datos: DatosCliente & { id: number },
  ): Observable<ClienteGrpc>;
  darDeBajaCliente(id: { id: number }): Observable<ClienteGrpc>;
  existeCliente(id: { id: number }): Observable<{ existe: boolean }>;
  validarClienteParaReserva(id: { id: number }): Observable<ClienteGrpc>;
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
    return aCliente(await rpc(this.servicio.crearCliente(datos), NOMBRE));
  }

  async listar(filtro: FiltroClientes = {}) {
    const { clientes } = await rpc(
      this.servicio.listarClientes(filtro),
      NOMBRE,
    );
    return clientes.map(aCliente);
  }

  async buscarPorId(id: number) {
    return aCliente(
      await rpc(this.servicio.buscarClientePorId({ id }), NOMBRE),
    );
  }

  async actualizar(id: number, datos: DatosCliente) {
    return aCliente(
      await rpc(this.servicio.actualizarCliente({ id, ...datos }), NOMBRE),
    );
  }

  async darDeBaja(id: number) {
    return aCliente(
      await rpc(this.servicio.darDeBajaCliente({ id }), NOMBRE),
    );
  }

  async existe(id: number) {
    const { existe } = await rpc(
      this.servicio.existeCliente({ id }),
      NOMBRE,
    );
    return existe;
  }

  async validarParaReserva(id: number) {
    return aCliente(
      await rpc(this.servicio.validarClienteParaReserva({ id }), NOMBRE),
    );
  }
}
