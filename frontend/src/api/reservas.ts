import { http } from './http'
import type { Reserva } from '../types/reserva'

// Datos para dar de alta una reserva (punto 4)
export interface DatosReserva {
  clienteId: number
  vehiculoId: number
  fechaInicio: string
  fechaFin: string
}

export async function crearReserva(datos: DatosReserva): Promise<Reserva> {
  const { data } = await http.post<Reserva>('/reservas', datos)
  return data
}
