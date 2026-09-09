import { RolUsuario } from '@prisma/client';

export interface AuthPayload {
  sub: number;
  rol: RolUsuario;
  clienteId: number;
  nombre: string;
  email: string;
}