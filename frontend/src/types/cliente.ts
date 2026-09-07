export interface Cliente {
  id: number
  documento: string
  nombre: string
  apellido: string
  email: string
  telefono?: string | null
  fechaNacimiento?: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
}