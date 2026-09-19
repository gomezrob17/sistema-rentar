import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSesion } from '../sesion/SesionContext'

// Para las pantallas que ven los dos roles, el back decide quien lo ve.
export function RutaPrivada({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()

  if (!usuario) return <Navigate to="/ingreso" replace />

  return <>{children}</>
}