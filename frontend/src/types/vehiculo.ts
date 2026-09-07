export type TipoVehiculo = 'SEDAN' | 'SUV' | 'PICKUP' | 'COUPE' | 'HATCHBACK'
export type EstadoVehiculo = 'DISPONIBLE' | 'RESERVADO' | 'EN_ALQUILER'

export const TIPOS: TipoVehiculo[] = ['SEDAN', 'SUV', 'PICKUP', 'COUPE', 'HATCHBACK']

// El vehículo completo que devuelve la API REST (punto 1)
export interface Vehiculo {
  id: number
  patente: string
  marca: string
  modelo: string
  anio: number
  color?: string | null
  tipo: TipoVehiculo
  precioDiario: number
  estado: EstadoVehiculo
  activo: boolean
}

// Lo que devuelve la consulta de disponibilidad (punto 2)
export interface VehiculoDisponible {
  id: number
  patente: string
  marca: string
  modelo: string
  anio: number
  color?: string | null
  tipo: TipoVehiculo
  precioDiario: number
}

// Lo que el usuario manda para filtrar disponibilidad
export interface FiltroDisponibilidad {
  fechaInicio: string
  fechaFin: string
  tipo?: TipoVehiculo
  marca?: string
  modelo?: string
  precioMin?: number
  precioMax?: number
}