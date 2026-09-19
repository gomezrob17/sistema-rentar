import { useState, type FormEvent } from 'react'
import type { Cliente } from '../types/cliente'
import {
  actualizarCliente,
  crearCliente,
  type DatosCliente,
} from '../api/clientes'

export function ClienteForm({
  cliente,
  onListo,
  onCancelar,
}: {
  cliente?: Cliente
  onListo: () => void
  onCancelar: () => void
}) {
  const esEdicion = !!cliente

  const [documento, setDocumento] = useState(cliente?.documento ?? '')
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [apellido, setApellido] = useState(cliente?.apellido ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [fechaNacimiento, setFechaNacimiento] = useState(
    cliente?.fechaNacimiento?.slice(0, 10) ?? '',
  )

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const datos: DatosCliente = {
      documento: documento.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim(),
      telefono: telefono.trim() || undefined,
      fechaNacimiento: fechaNacimiento || undefined,
    }

    try {
      if (esEdicion) {
        await actualizarCliente(cliente.id, datos)
      } else {
        await crearCliente(datos)
      }

      onListo()
    } catch (err) {
      const msg = (
        err as {
          response?: {
            data?: {
              message?: string | string[]
            }
          }
        }
      )?.response?.data?.message ?? (
        err instanceof Error ? err.message : 'Error al guardar el cliente'
      )

      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="form-panel">
      <form onSubmit={guardar} className="form-campos">
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>
          {esEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        </h2>

        <p
          style={{
            color: 'var(--texto-tenue)',
            fontSize: 13,
            marginTop: 0,
            marginBottom: 18,
          }}
        >
          El ID lo asigna el sistema automáticamente.
        </p>

        <div className="fila2">
          <div>
            <label className="fl" htmlFor="documento">
              Documento *
            </label>
            <input
              id="documento"
              className="fi"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              required
              placeholder="30123456"
            />
          </div>

          <div>
            <label className="fl" htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              className="fi"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="cliente@email.com"
            />
          </div>
        </div>

        <div className="fila2">
          <div>
            <label className="fl" htmlFor="nombre">
              Nombre *
            </label>
            <input
              id="nombre"
              className="fi"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Juan"
            />
          </div>

          <div>
            <label className="fl" htmlFor="apellido">
              Apellido *
            </label>
            <input
              id="apellido"
              className="fi"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              required
              placeholder="Pérez"
            />
          </div>
        </div>

        <div className="fila2">
          <div>
            <label className="fl" htmlFor="telefono">
              Teléfono
            </label>
            <input
              id="telefono"
              className="fi"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="1123456789"
            />
          </div>

          <div>
            <label className="fl" htmlFor="fechaNacimiento">
              Fecha de nacimiento
            </label>
            <input
              id="fechaNacimiento"
              className="fi"
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: '#D6413B', fontSize: 13 }}>
            ⚠ {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={guardando}
          >
            {guardando
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar cambios'
                : 'Crear cliente'}
          </button>

          <button
            type="button"
            className="btn btn-secundario"
            onClick={onCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>
        </div>
      </form>

      <div className="form-preview">
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            color: '#8ea3ba',
            marginBottom: 8,
          }}
        >
          Vista previa
        </div>

        <div
          style={{
            fontFamily: 'var(--fuente-titulo)',
            fontWeight: 700,
            fontSize: 20,
            color: '#fff',
          }}
        >
          {nombre || 'Nombre'} {apellido || 'Apellido'}
        </div>

        <div
          style={{
            fontSize: 13,
            color: '#8ea3ba',
            marginTop: 8,
          }}
        >
          {email || 'email@ejemplo.com'}
        </div>

        <div
          style={{
            fontSize: 13,
            color: '#8ea3ba',
            marginTop: 6,
          }}
        >
          {documento || 'Documento'}
        </div>

        {telefono && (
          <div
            style={{
              fontSize: 13,
              color: '#8ea3ba',
              marginTop: 6,
            }}
          >
            Teléfono: {telefono}
          </div>
        )}
      </div>
    </div>
  )
}