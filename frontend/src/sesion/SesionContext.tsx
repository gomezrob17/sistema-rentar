import { createContext, useContext, useState, type ReactNode } from 'react'

export type Rol = 'admin' | 'cliente'

export interface Usuario {
  email: string
  rol: Rol
  nombre: string
}

// Usuarios de prueba (login simulado, sin backend ya que el TP no lo pide)
const USUARIOS: (Usuario & { pass: string })[] = [
  { email: 'admin@unla.com.ar', pass: 'Admin123', rol: 'admin', nombre: 'Administrador' },
  { email: 'cliente1@pruebas.com.ar', pass: '12345678', rol: 'cliente', nombre: 'Cliente 1' },
]

interface Sesion {
  usuario: Usuario | null
  iniciarSesion: (email: string, pass: string) => Usuario | null
  salir: () => void
}

const SesionContext = createContext<Sesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const guardado = localStorage.getItem('rentar_usuario')
    return guardado ? (JSON.parse(guardado) as Usuario) : null
  })

  function iniciarSesion(email: string, pass: string): Usuario | null {
    const encontrado = USUARIOS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.pass === pass,
    )
    if (!encontrado) return null
    const datos: Usuario = { email: encontrado.email, rol: encontrado.rol, nombre: encontrado.nombre }
    setUsuario(datos)
    localStorage.setItem('rentar_usuario', JSON.stringify(datos))
    return datos
  }

  function salir() {
    setUsuario(null)
    localStorage.removeItem('rentar_usuario')
  }

  return (
    <SesionContext.Provider value={{ usuario, iniciarSesion, salir }}>
      {children}
    </SesionContext.Provider>
  )
}

export function useSesion() {
  const ctx = useContext(SesionContext)
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return ctx
}