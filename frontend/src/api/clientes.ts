import { http } from './http'
import type { Cliente } from '../types/cliente'

export interface DatosCliente {
  documento: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  fechaNacimiento?: string
}

export async function listarClientes(): Promise<Cliente[]> {
  const { data } = await http.get<Cliente[]>('/clientes')
  return data
}

export async function crearCliente(
  datos: DatosCliente,
): Promise<Cliente> {
  const { data } = await http.post<Cliente>('/clientes', datos)
  return data
}

export async function actualizarCliente(
  id: number,
  datos: Partial<DatosCliente>,
): Promise<Cliente> {
  const { data } = await http.patch<Cliente>(`/clientes/${id}`, datos)
  return data
}

export async function eliminarCliente(id: number): Promise<void> {
  await http.delete(`/clientes/${id}`)
}