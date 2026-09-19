import { http } from './http'
import type { TipoVehiculo, Vehiculo } from '../types/vehiculo'

// Datos que carga el admin. Del id se encarga ya el sistema
// ni estado ni activo los manejamos en el back
export interface DatosVehiculo {
  patente: string
  marca: string
  modelo: string
  anio: number
  color?: string
  tipo: TipoVehiculo
  precioDiario: number
}

export async function listarVehiculos(): Promise<Vehiculo[]> {
  const { data } = await http.get<Vehiculo[]>('/vehiculos')
  return data
}

export async function crearVehiculo(datos: DatosVehiculo): Promise<Vehiculo> {
  const { data } = await http.post<Vehiculo>('/vehiculos', datos)
  return data
}

export async function actualizarVehiculo(id: number, datos: Partial<Omit<DatosVehiculo, 'patente'>>): Promise<Vehiculo> {
  const { data } = await http.patch<Vehiculo>(`/vehiculos/${id}`, datos)
  return data
}

export async function eliminarVehiculo(id: number): Promise<void> {
  await http.delete(`/vehiculos/${id}`)
}