export type TipoVehiculo = 'SEDAN' | 'SUV' | 'PICKUP' | 'COUPE' | 'HATCHBACK'
export type EstadoVehiculo = 'DISPONIBLE' | 'RESERVADO' | 'EN_ALQUILER'
// Verificación policial de la patente (Hito 3). ROBADO inhabilita el vehículo.
export type VerificacionVehiculo = 'PENDIENTE' | 'VALIDADO' | 'ROBADO'

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
  verificacion: VerificacionVehiculo
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

// Hito 3: incorporación de un vehículo de un propietario externo.
export type EstadoVehiculoExterno = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
export type ResultadoValidacion = 'VALIDADO' | 'RECHAZADO'

export interface VehiculoExterno {
  id: number
  clienteId: number
  patente: string
  marca: string
  modelo: string
  anio: number
  color?: string | null
  tipo: TipoVehiculo
  precioDiario: number
  estado: EstadoVehiculoExterno
  validacionPatente: ResultadoValidacion | null
  validacionTitularidad: ResultadoValidacion | null
  vehiculoId: number | null
  motivoRechazo: string | null
  createdAt: string
  updatedAt: string
}