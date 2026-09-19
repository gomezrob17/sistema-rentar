import { http } from './http'
import { graphqlRequest } from './graphql'
import type { FiltroReservas, Reserva, ReservaConsulta } from '../types/reserva'

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

// Consulta de reservas (punto 5)
const QUERY = `
  query Reservas($filtro: FiltroReservasInput) {
    reservas(filtro: $filtro) {
      id
      cliente
      vehiculo
      patente
      tipo
      fechaInicio
      fechaFin
      precioDiario
      importeTotal
      estado
    }
  }
`

export async function consultarReservas(
  filtro: FiltroReservas,
): Promise<ReservaConsulta[]> {
  const limpio = Object.fromEntries(
    Object.entries(filtro).filter(
      ([, valor]) => valor !== '' && valor !== undefined && valor !== null,
    ),
  )

  const data = await graphqlRequest<{ reservas: ReservaConsulta[] }>(QUERY, {
    filtro: limpio,
  })

  return data.reservas
}