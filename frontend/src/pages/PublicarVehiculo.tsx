import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { listarMisVehiculosExternos, registrarVehiculoExterno } from '../api/vehiculos'
import { CATALOGO, modelosDe, tipoDe } from '../catalogo/marcas'
import { IlustracionVehiculo } from '../components/IlustracionVehiculo'
import { TIPOS, type EstadoVehiculoExterno, type TipoVehiculo, type VehiculoExterno } from '../types/vehiculo'

const ESTADO_ESTILO: Record<EstadoVehiculoExterno, { bg: string; color: string; texto: string }> = {
  PENDIENTE: { bg: '#FBF0DA', color: '#9A6B00', texto: 'Pendiente de validación' },
  APROBADO: { bg: '#E5F6EE', color: '#1F7A54', texto: 'Incorporado a la flota' },
  RECHAZADO: { bg: '#FFF0EF', color: '#A62E2A', texto: 'Rechazado' },
}

function fechaBonita(valor: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
}

function mensajeDeError(err: unknown) {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
    ?? (err instanceof Error ? err.message : 'Error al registrar el vehículo')
  return Array.isArray(msg) ? msg.join(' · ') : String(msg)
}

export function PublicarVehiculo() {
  const [patente, setPatente] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [tipo, setTipo] = useState<TipoVehiculo>('SEDAN')
  const [anio, setAnio] = useState('')
  const [color, setColor] = useState('')
  const [precio, setPrecio] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [solicitud, setSolicitud] = useState<VehiculoExterno | null>(null)
  const [solicitudes, setSolicitudes] = useState<VehiculoExterno[]>([])
  const [cargando, setCargando] = useState(true)

  const modelos = modelosDe(marca)

  const cargar = useCallback(async () => {
    try {
      setSolicitudes(await listarMisVehiculosExternos())
    } catch {
      // El listado es informativo; el formulario sigue disponible si falla.
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let activo = true
    listarMisVehiculosExternos()
      .then((lista) => { if (activo) setSolicitudes(lista) })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  // Mientras haya una solicitud en proceso, refrescamos el estado.
  useEffect(() => {
    if (!solicitudes.some((s) => s.estado === 'PENDIENTE')) return
    const intervalo = window.setInterval(cargar, 3000)
    return () => window.clearInterval(intervalo)
  }, [solicitudes, cargar])

  function elegirMarca(valor: string) {
    setMarca(valor)
    setModelo('')
  }

  function elegirModelo(valor: string) {
    setModelo(valor)
    const sugerido = tipoDe(marca, valor)
    if (sugerido) setTipo(sugerido)
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setSolicitud(null)
    try {
      const nueva = await registrarVehiculoExterno({
        patente: patente.trim(),
        marca,
        modelo,
        tipo,
        anio: Number(anio),
        color: color.trim() || undefined,
        precioDiario: Number(precio),
      })
      setSolicitud(nueva)
      setSolicitudes((lista) => [nueva, ...lista.filter((s) => s.id !== nueva.id)])
      setPatente('')
      setMarca('')
      setModelo('')
      setTipo('SEDAN')
      setAnio('')
      setColor('')
      setPrecio('')
      await cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="contenedor" style={{ padding: '36px 24px 60px' }}>
      <div className="admin-head">
        <div>
          <div style={{ fontSize: 13, color: 'var(--texto-tenue)' }}>Clientes</div>
          <h1 style={{ fontSize: 28 }}>Ofrecer mi vehículo</h1>
          <p style={{ color: 'var(--texto-suave)', margin: '6px 0 0', maxWidth: 720 }}>
            Registrá tu vehículo para incorporarlo a Rentar. La patente y la titularidad se validan de forma
            asíncrona; mientras tanto la solicitud queda pendiente. Si ambas validaciones son correctas, el
            vehículo pasa a estar disponible para alquilar.
          </p>
        </div>
      </div>

      <div className="form-panel" style={{ marginTop: 24 }}>
        <form onSubmit={registrar} className="form-campos">
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Datos del vehículo</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
            El estado y los resultados de las validaciones los asigna el sistema.
          </p>

          <label className="fl">Patente *</label>
          <input
            className="fi"
            value={patente}
            onChange={(e) => setPatente(e.target.value.toUpperCase())}
            required
            placeholder="DEF456"
          />

          <div className="fila2">
            <div>
              <label className="fl">Marca *</label>
              <select className="fi" value={marca} onChange={(e) => elegirMarca(e.target.value)} required>
                <option value="">Elegí una marca</option>
                {CATALOGO.map((m) => <option key={m.marca} value={m.marca}>{m.marca}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Modelo *</label>
              <select className="fi" value={modelo} onChange={(e) => elegirModelo(e.target.value)} required disabled={!marca}>
                <option value="">{marca ? 'Elegí un modelo' : 'Elegí marca primero'}</option>
                {modelos.map((mo) => <option key={mo.nombre} value={mo.nombre}>{mo.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="fila3">
            <div>
              <label className="fl">Tipo *</label>
              <select className="fi" value={tipo} onChange={(e) => setTipo(e.target.value as TipoVehiculo)}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Año *</label>
              <input className="fi" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} required min={1900} placeholder="2023" />
            </div>
            <div>
              <label className="fl">Color</label>
              <input className="fi" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Blanco" />
            </div>
          </div>

          <label className="fl">Precio por día (ARS) *</label>
          <input
            className="fi"
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
            min={1}
            step="0.01"
            placeholder="32000"
            style={{ maxWidth: 220 }}
          />

          {error && <p style={{ color: '#D6413B', fontSize: 13 }}>{error}</p>}
          {solicitud && (
            <div style={{ background: '#EAF8F1', border: '1px solid #C6E9D7', color: '#1F7A54', borderRadius: 10, padding: '12px 14px', fontSize: 14 }}>
              Solicitud #{solicitud.id} registrada. Queda <strong>pendiente de validación</strong>; el estado se actualiza solo en unos instantes.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn btn-primario" disabled={guardando}>
              {guardando ? 'Registrando…' : 'Publicar vehículo'}
            </button>
          </div>
        </form>

        <div className="form-preview">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8ea3ba', marginBottom: 8 }}>
            Vista previa
          </div>
          <div style={{ fontFamily: 'var(--fuente-titulo)', fontWeight: 700, fontSize: 20, color: '#fff' }}>
            {marca || 'Marca'} {modelo}
          </div>
          <div style={{ fontSize: 13, color: '#8ea3ba', marginBottom: 10 }}>
            {anio || 'Año'}{color ? ` · ${color}` : ''} · {tipo} {patente ? `· ${patente}` : ''}
          </div>
          <div key={tipo} className="preview-anim" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <IlustracionVehiculo tipo={tipo} width={260} />
          </div>
        </div>
      </div>

      <section style={{ marginTop: 34 }}>
        <h2 style={{ fontSize: 22, marginBottom: 14 }}>Mis solicitudes</h2>
        {cargando && <p style={{ color: 'var(--texto-suave)' }}>Cargando solicitudes…</p>}
        {!cargando && solicitudes.length === 0 && (
          <p style={{ color: 'var(--texto-suave)' }}>Todavía no registraste ningún vehículo.</p>
        )}
        {solicitudes.length > 0 && (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Patente</th><th>Vehículo</th><th>Precio/día</th><th>Estado</th>
                  <th>Validaciones</th><th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => {
                  const estilo = ESTADO_ESTILO[s.estado]
                  return (
                    <tr key={s.id}>
                      <td className="mono">{s.patente}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.marca} {s.modelo}</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>{s.anio} · {s.tipo}</div>
                      </td>
                      <td>${Number(s.precioDiario).toLocaleString('es-AR')}</td>
                      <td>
                        <span className="badge" style={{ background: estilo.bg, color: estilo.color }}>{estilo.texto}</span>
                        {s.motivoRechazo && (
                          <div style={{ fontSize: 12, color: '#A62E2A', marginTop: 4 }}>{s.motivoRechazo}</div>
                        )}
                        {s.vehiculoId && (
                          <div style={{ fontSize: 12, color: 'var(--texto-tenue)', marginTop: 4 }}>Vehículo #{s.vehiculoId}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                        <div>Patente: {s.validacionPatente ?? '—'}</div>
                        <div>Titularidad: {s.validacionTitularidad ?? '—'}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>{fechaBonita(s.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
