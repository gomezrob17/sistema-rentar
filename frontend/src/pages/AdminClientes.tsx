import { useCallback, useEffect, useState } from 'react'
import {
  eliminarCliente,
  listarClientes,
} from '../api/clientes'
import type { Cliente } from '../types/cliente'
import { ClienteForm } from '../components/ClienteForm'

type Editando = null | 'nuevo' | Cliente

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return '-'

  const fechaFormateada = new Date(fecha).toLocaleDateString('es-AR', {
    timeZone: 'UTC',
  })

  return fechaFormateada
}

export function AdminClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<Editando>(null)
  const [ocultarBajas, setOcultarBajas] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    setError('')

    listarClientes()
      .then(setClientes)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : 'Error al cargar los clientes',
        ),
      )
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function darBaja(cliente: Cliente) {
    const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`

    if (
      !window.confirm(
        `¿Dar de baja al cliente ${nombreCompleto} (${cliente.documento})?`,
      )
    ) {
      return
    }

    try {
      await eliminarCliente(cliente.id)
      cargar()
    } catch (e) {
      alert(
        'No se pudo dar de baja: ' +
          (e instanceof Error ? e.message : ''),
      )
    }
  }

  if (editando) {
    return (
      <section
        className="contenedor"
        style={{ padding: '36px 24px 60px' }}
      >
        <ClienteForm
          cliente={editando === 'nuevo' ? undefined : editando}
          onListo={() => {
            setEditando(null)
            cargar()
          }}
          onCancelar={() => setEditando(null)}
        />
      </section>
    )
  }

  const hayBajas = clientes.some((cliente) => !cliente.activo)

  const visibles = ocultarBajas
    ? clientes.filter((cliente) => cliente.activo)
    : clientes

  return (
    <section
      className="contenedor"
      style={{ padding: '36px 24px 60px' }}
    >
      <div className="admin-head">
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--texto-tenue)',
            }}
          >
            Administración
          </div>

          <h1 style={{ fontSize: 28 }}>Clientes</h1>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {hayBajas && (
            <button
              className={
                ocultarBajas
                  ? 'btn-filtro activo'
                  : 'btn-filtro'
              }
              onClick={() => setOcultarBajas((valor) => !valor)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 5h18l-7 8v5l-4 2v-7z" />
              </svg>

              {ocultarBajas
                ? 'Mostrar dados de baja'
                : 'Ocultar dados de baja'}
            </button>
          )}

          <button
            className="btn btn-primario"
            onClick={() => setEditando('nuevo')}
          >
            + Nuevo cliente
          </button>
        </div>
      </div>

      {cargando && (
        <p style={{ color: 'var(--texto-suave)' }}>
          Cargando clientes…
        </p>
      )}

      {error && (
        <p style={{ color: '#D6413B' }}>
          ⚠ {error}
        </p>
      )}

      {!cargando && !error && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Nombre completo</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Fecha de nacimiento</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      color: 'var(--texto-suave)',
                      textAlign: 'center',
                      padding: 30,
                    }}
                  >
                    No hay clientes para mostrar.
                  </td>
                </tr>
              )}

              {visibles.map((cliente) => (
                <tr
                  key={cliente.id}
                  className={cliente.activo ? '' : 'inactivo'}
                >
                  <td className="mono">
                    {cliente.documento}
                  </td>

                  <td style={{ fontWeight: 600 }}>
                    {cliente.nombre} {cliente.apellido}
                  </td>

                  <td>{cliente.email}</td>

                  <td>{cliente.telefono || '-'}</td>

                  <td>
                    {formatearFecha(cliente.fechaNacimiento)}
                  </td>

                  <td>
                    {cliente.activo ? (
                      <span
                        className="badge"
                        style={{
                          background: '#E5F6EE',
                          color: '#1F7A54',
                        }}
                      >
                        ● Activo
                      </span>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          background: '#F0F3F7',
                          color: 'var(--texto-tenue)',
                        }}
                      >
                        ○ Inactivo
                      </span>
                    )}
                  </td>

                  <td>
                    <div className="acciones">
                      {cliente.activo ? (
                        <>
                          <button
                            className="iconbtn"
                            onClick={() => setEditando(cliente)}
                          >
                            Editar
                          </button>

                          <button
                            className="iconbtn peligro"
                            onClick={() => darBaja(cliente)}
                          >
                            Baja
                          </button>
                        </>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--texto-tenue)',
                          }}
                        >
                          Dado de baja
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}