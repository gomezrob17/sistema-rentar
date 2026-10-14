import { createContext, useContext, useState, type ReactNode } from 'react'
import { cambiarPasswordApi, iniciarSesionApi } from '../api/auth'

export type Rol = 'admin' | 'cliente'

export interface Usuario {
  id?: number
  email: string
  rol: Rol
  nombre: string
  clienteId?: number
}

interface Sesion {
  usuario: Usuario | null
  iniciarSesion: (email: string, pass: string) => Promise<Usuario | null>
  cambiarPassword: (actual: string, nueva: string) => Promise<void>
  salir: () => void
}

const SesionContext = createContext<Sesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const guardado = localStorage.getItem('rentar_usuario')
    return guardado ? (JSON.parse(guardado) as Usuario) : null
  })

  async function iniciarSesion(
    email: string,
    pass: string,
  ): Promise<Usuario | null> {
    // El backend valida las credenciales (admin y clientes viven en la base) y devuelve el rol.
    try {
      const respuesta = await iniciarSesionApi(email, pass)
      const datos: Usuario = {
        id: respuesta.usuario.sub,
        email: respuesta.usuario.email,
        rol: respuesta.usuario.rol === 'ADMIN' ? 'admin' : 'cliente',
        nombre: respuesta.usuario.nombre,
        clienteId: respuesta.usuario.clienteId,
      }
      localStorage.setItem('rentar_token', respuesta.accessToken)
      setUsuario(datos)
      localStorage.setItem('rentar_usuario', JSON.stringify(datos))
      return datos
    } catch {
      return null
    }
  }

  async function cambiarPassword(actual: string, nueva: string) {
    await cambiarPasswordApi(actual, nueva)
  }

  function salir() {
    setUsuario(null)
    localStorage.removeItem('rentar_usuario')
    localStorage.removeItem('rentar_token')
  }

  return (
    <SesionContext.Provider value={{ usuario, iniciarSesion, cambiarPassword, salir }}>
      {children}
    </SesionContext.Provider>
  )
}

export function useSesion() {
  const ctx = useContext(SesionContext)
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return ctx
}