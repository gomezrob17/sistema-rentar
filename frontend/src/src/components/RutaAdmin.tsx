import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSesion } from '../sesion/SesionContext'

export function RutaAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  if (usuario?.rol !== 'admin') return <Navigate to="/ingreso" replace />
  return <>{children}</>
}