import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { consultarHistorial } from '../api/reservas'
import type { AlquilerHistorial } from '../types/reserva'

const fecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })
const importe = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export function HistorialAlquileres() {
  const [alquileres, setAlquileres] = useState<AlquilerHistorial[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    consultarHistorial()
      .then((datos) => { if (vigente) setAlquileres(datos) })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
      })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [recarga])

  return (
    <section className="contenedor" style={{ padding: '36px 24px 60px' }}>
      <div className="admin-head">
        <div>
          <div style={{ fontSize: 13, color: 'var(--texto-tenue)' }}>Mi cuenta</div>
          <h1 style={{ fontSize: 28 }}>Historial de alquileres</h1>
          <p style={{ color: 'var(--texto-suave)' }}>Tus alquileres finalizados y tus reservas canceladas.</p>
        </div>
        <Link className="btn btn-secundario" to="/reservas">Mis reservas</Link>
      </div>

      {cargando && <p role="status">Cargando historial…</p>}
      {error && <div role="alert">
        <p style={{ color: '#A62E2A' }}>{error}</p>
        <button className="btn btn-secundario" type="button" onClick={() => {
          setCargando(true)
          setError('')
          setRecarga((valor) => valor + 1)
        }}>Reintentar</button>
      </div>}

      {!cargando && !error && (
        <div className="tabla-wrap" style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <caption style={{ textAlign: 'left', padding: '12px 0', color: 'var(--texto-tenue)' }}>
              Los días y el importe corresponden al período originalmente reservado.
            </caption>
            <thead><tr>
              <th>Vehículo</th><th>Patente</th><th>Inicio</th><th>Fin</th>
              <th style={{ textAlign: 'right' }}>Días</th>
              <th style={{ textAlign: 'right' }}>Importe total</th><th>Estado</th>
            </tr></thead>
            <tbody>
              {alquileres.length === 0 && <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--texto-suave)' }}>
                Todavía no tenés alquileres finalizados ni reservas canceladas.
              </td></tr>}
              {alquileres.map((alquiler) => <tr key={alquiler.id}>
                <td style={{ fontWeight: 600 }}>{alquiler.vehiculo}</td>
                <td className="mono">{alquiler.patente}</td>
                <td>{fecha.format(new Date(alquiler.fechaInicio))}</td>
                <td>{fecha.format(new Date(alquiler.fechaFin))}</td>
                <td style={{ textAlign: 'right' }}>{alquiler.cantidadDias}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{importe.format(alquiler.importeTotal)}</td>
                <td><span className="badge" style={alquiler.estado === 'CANCELADA'
                  ? { background: '#FFF0EF', color: '#A62E2A' }
                  : { background: '#F0F3F7', color: '#5A6676' }}>
                  {alquiler.estado}
                </span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
