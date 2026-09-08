import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSesion } from '../sesion/SesionContext'

export function RutaCliente({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()

  if (!usuario) return <Navigate to="/ingreso" replace />
  if (usuario.rol !== 'cliente') return <Navigate to="/" replace />

  return <>{children}</>
}