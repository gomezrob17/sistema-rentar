// Mismos valores que el enum RolUsuario de proto/rentar/clientes/v1/customer.proto (y que Hito 1).
export enum RolUsuario {
  CLIENTE = 'CLIENTE',
  ADMIN = 'ADMIN',
}

export interface AuthPayload {
  sub: number;
  rol: RolUsuario;
  clienteId?: number;
  nombre: string;
  email: string;
}
