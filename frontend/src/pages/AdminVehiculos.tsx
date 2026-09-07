import { useEffect, useState, useCallback } from 'react'
import { listarVehiculos, eliminarVehiculo } from '../api/vehiculos'
import type { EstadoVehiculo, Vehiculo } from '../types/vehiculo'
import { VehiculoForm } from '../components/VehiculoForm'

const ESTADO_ESTILO: Record<EstadoVehiculo, { bg: string; color: string }> = {
  DISPONIBLE: { bg: '#E5F6EE', color: '#1F7A54' },
  RESERVADO: { bg: '#FBF0DA', color: '#9A6B00' },
  EN_ALQUILER: { bg: '#EAF1FE', color: '#2456B8' },
}

type Editando = null | 'nuevo' | Vehiculo

export function AdminVehiculos() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<Editando>(null)
  const [ocultarBajas, setOcultarBajas] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    listarVehiculos()
      .then(setVehiculos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function darBaja(v: Vehiculo) {
    if (!window.confirm(`¿Dar de baja ${v.marca} ${v.modelo} (${v.patente})?`)) return
    try {
      await eliminarVehiculo(v.id)
      cargar()
    } catch (e) {
      alert('No se pudo dar de baja: ' + (e instanceof Error ? e.message : ''))
    }
  }

  if (editando) {
    return (
      <section className="contenedor" style={{ padding: '36px 24px 60px' }}>
        <VehiculoForm
          vehiculo={editando === 'nuevo' ? undefined : editando}
          onListo={() => { setEditando(null); cargar() }}
          onCancelar={() => setEditando(null)}
        />
      </section>
    )
  }

  // Si Hay algun vehiculo dado de baja mostramos o no el filtro
  const hayBajas = vehiculos.some((v) => !v.activo)
  // Segun el filtro se muestra la tablita
  const visibles = ocultarBajas ? vehiculos.filter((v) => v.activo) : vehiculos

  return (
    <section className="contenedor" style={{ padding: '36px 24px 60px' }}>
      <div className="admin-head">
        <div>
          <div style={{ fontSize: 13, color: 'var(--texto-tenue)' }}>Administración</div>
          <h1 style={{ fontSize: 28 }}>Vehículos</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {hayBajas && (
            <button className={ocultarBajas ? 'btn-filtro activo' : 'btn-filtro'} onClick={() => setOcultarBajas((v) => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18l-7 8v5l-4 2v-7z" /></svg>
              {ocultarBajas ? 'Mostrar dados de baja' : 'Ocultar dados de baja'}
            </button>
          )}
          <button className="btn btn-primario" onClick={() => setEditando('nuevo')}>+ Nuevo vehículo</button>
        </div>
      </div>

      {cargando && <p style={{ color: 'var(--texto-suave)' }}>Cargando vehículos…</p>}
      {error && <p style={{ color: '#D6413B' }}>⚠ {error}</p>}

      {!cargando && !error && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Patente</th><th>Marca / Modelo</th><th>Año</th><th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Precio/día</th><th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={7} style={{ color: 'var(--texto-suave)', textAlign: 'center', padding: 30 }}>No hay vehículos para mostrar.</td></tr>
              )}
              {visibles.map((v) => {
                const est = ESTADO_ESTILO[v.estado]
                return (
                  <tr key={v.id} className={v.activo ? '' : 'inactivo'}>
                    <td className="mono">{v.patente}</td>
                    <td style={{ fontWeight: 600 }}>{v.marca} {v.modelo}</td>
                    <td>{v.anio}</td>
                    <td><span className="badge" style={{ background: '#EEF1F5', color: 'var(--texto-suave)' }}>{v.tipo}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(v.precioDiario).toLocaleString('es-AR')}</td>
                    <td>
                      {v.activo
                        ? <span className="badge" style={{ background: est.bg, color: est.color }}>● {v.estado}</span>
                        : <span className="badge" style={{ background: '#F0F3F7', color: 'var(--texto-tenue)' }}>○ Inactivo</span>}
                    </td>
                    <td>
                      <div className="acciones">
                        {v.activo ? (
                          <>
                            <button className="iconbtn" onClick={() => setEditando(v)}>Editar</button>
                            <button className="iconbtn peligro" onClick={() => darBaja(v)}>Baja</button>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>Dado de baja</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}