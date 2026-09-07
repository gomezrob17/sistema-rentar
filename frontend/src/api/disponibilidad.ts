import { graphqlRequest } from './graphql'
import type { FiltroDisponibilidad, VehiculoDisponible } from '../types/vehiculo'

const QUERY = `
  query VehiculosDisponibles($filtro: FiltroDisponibilidadInput!) {
    vehiculosDisponibles(filtro: $filtro) {
      id
      patente
      marca
      modelo
      anio
      color
      tipo
      precioDiario
    }
  }
`

export async function buscarDisponibles(filtro: FiltroDisponibilidad): Promise<VehiculoDisponible[]> {
  const data = await graphqlRequest<{ vehiculosDisponibles: VehiculoDisponible[] }>(QUERY, { filtro })
  return data.vehiculosDisponibles
}