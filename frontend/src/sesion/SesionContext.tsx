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

// Usuarios de prueba (login simulado, sin backend ya que el TP no lo pide)
const USUARIOS: (Usuario & { pass: string })[] = [
  { email: 'admin@unla.com.ar', pass: 'Admin123', rol: 'admin', nombre: 'Administrador' },
  { email: 'cliente1@pruebas.com.ar', pass: '12345678', rol: 'cliente', nombre: 'Cliente 1' },
]

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
    const encontrado = USUARIOS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.pass === pass,
    )
    if (encontrado) {
      const datos: Usuario = {
        email: encontrado.email,
        rol: encontrado.rol,
        nombre: encontrado.nombre,
      }
      setUsuario(datos)
      localStorage.setItem('rentar_usuario', JSON.stringify(datos))
      return datos
    }

    try {
      const respuesta = await iniciarSesionApi(email, pass)
      const datos: Usuario = {
        id: respuesta.usuario.sub,
        email: respuesta.usuario.email,
        rol: 'cliente',
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