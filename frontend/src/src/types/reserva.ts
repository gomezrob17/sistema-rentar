// Lo que devuelve el backend (REST punto 4) al crear una reserva.
// Los importes llegan como string: los Decimal de la DB se serializan así.
export interface Reserva {
  id: number
  clienteId: number
  vehiculoId: number
  fechaInicio: string
  fechaFin: string
  precioDiario: string
  importeTotal: string
  estado: 'CONFIRMADA' | 'CANCELADA' | 'FINALIZADA'
  createdAt: string
  updatedAt: string
}

export type EstadoReserva = 'CONFIRMADA' | 'CANCELADA' | 'FINALIZADA'

export type TipoVehiculo = 'SEDAN' | 'SUV' | 'HATCHBACK' | 'PICKUP' | 'COUPE'

// Lo que devuelve la consulta de reservas (punto 5).
export interface ReservaConsulta {
  id: number
  clienteId: number
  cliente: string
  vehiculoId: number
  vehiculo: string
  patente: string
  tipo: TipoVehiculo
  fechaInicio: string
  fechaFin: string
  precioDiario: number
  importeTotal: number
  estado: EstadoReserva
}

// Todos los filtros son opcionales
export interface FiltroReservas {
  cliente?: string
  clienteId?: number
  vehiculo?: string
  vehiculoId?: number
  tipo?: TipoVehiculo
  estado?: EstadoReserva
  fechaDesde?: string
  fechaHasta?: string
}