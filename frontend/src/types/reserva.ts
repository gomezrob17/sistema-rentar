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
