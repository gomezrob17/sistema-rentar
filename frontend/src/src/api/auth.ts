import { http } from './http'

export interface UsuarioSesion {
  sub: number
  email: string
  rol: 'CLIENTE'
  nombre: string
  clienteId: number
}

interface LoginRespuesta {
  accessToken: string
  usuario: UsuarioSesion
}

export async function iniciarSesionApi(
  email: string,
  password: string,
): Promise<LoginRespuesta> {
  const { data } = await http.post<LoginRespuesta>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function cambiarPasswordApi(
  passwordActual: string,
  passwordNueva: string,
) {
  const { data } = await http.patch<{ mensaje: string }>('/auth/password', {
    passwordActual,
    passwordNueva,
  })
  return data
}