import { useState, type FormEvent } from 'react'
import { reportarAveria } from '../api/vehiculos'
import type { Vehiculo } from '../types/vehiculo'

export function AveriaForm({ vehiculo, onListo, onCancelar }: {
  vehiculo: Vehiculo
  onListo: () => void
  onCancelar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await reportarAveria(vehiculo.id, motivo.trim())
      onListo()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Error al registrar la avería')
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="form-campos averia-panel">
      <div className="averia-head">
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>
            Reportar avería de {vehiculo.marca} {vehiculo.modelo}
          </h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: 13, margin: 0 }}>
            <span className="mono">{vehiculo.patente}</span> · {vehiculo.tipo} · ${Number(vehiculo.precioDiario).toLocaleString('es-AR')} por día
          </p>
        </div>
        <span className="badge" style={{ background: '#FFF0EF', color: '#A62E2A' }}>
          Queda fuera de servicio
        </span>
      </div>

      <p style={{ color: 'var(--texto-suave)', fontSize: 13, margin: '12px 0 16px' }}>
        Al confirmar, el vehículo pasa a <strong>INHABILITADO</strong> inmediatamente. El
        sistema busca un reemplazo equivalente para las reservas futuras confirmadas y
        actualiza cada reserva en segundo plano.
      </p>

      <label className="fl" htmlFor="motivo-averia">Motivo *</label>
      <textarea
        id="motivo-averia"
        className="fi"
        rows={3}
        maxLength={500}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Por ejemplo: falla en el sistema de frenos detectada durante la revisión técnica"
        required
        autoFocus
      />
      <div className="fh">{motivo.length}/500 caracteres</div>

      {error && <p role="alert" style={{ color: '#D6413B', fontSize: 13 }}>⚠ {error}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button type="submit" className="btn btn-primario" disabled={guardando || !motivo.trim()}>
          {guardando ? 'Registrando…' : 'Registrar avería'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
