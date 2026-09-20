import { useEffect, useState } from 'react'
import { cancelarReserva } from '../api/reservas'
import type { ReservaConsulta } from '../types/reserva'

export function CancelarReserva({ reserva, onCancelada }: {
  reserva: ReservaConsulta
  onCancelada: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [iniciada, setIniciada] = useState(() => new Date(reserva.fechaInicio).getTime() <= Date.now())
  const puedeCancelar = reserva.estado === 'CONFIRMADA' && !iniciada

  // La acción también desaparece si el período empieza con la pantalla abierta.
  // El servidor vuelve a verificar la fecha al recibir la solicitud.
  useEffect(() => {
    if (!puedeCancelar) return
    const reloj = window.setInterval(() => {
      setIniciada(new Date(reserva.fechaInicio).getTime() <= Date.now())
    }, 1000)
    return () => window.clearInterval(reloj)
  }, [puedeCancelar, reserva.fechaInicio])

  async function confirmar() {
    setGuardando(true)
    setError('')
    try {
      await cancelarReserva(reserva.id)
      onCancelada()
    } catch (err) {
      const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(mensaje ?? 'No se pudo cancelar la reserva. Volvé a intentarlo.')
      setGuardando(false)
    }
  }

  if (!puedeCancelar) return <span style={{ color: 'var(--texto-tenue)' }}>—</span>

  return (
    <div style={{ minWidth: 160, maxWidth: 250 }}>
      {confirmando ? (
        <div>
          <p style={{ margin: '0 0 8px' }}>¿Cancelar la reserva de {reserva.vehiculo}?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-secundario" disabled={guardando} onClick={confirmar}>
              {guardando ? 'Cancelando…' : 'Sí, cancelar'}
            </button>
            <button type="button" className="btn-filtro" disabled={guardando} onClick={() => { setConfirmando(false); setError('') }}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-secundario" onClick={() => setConfirmando(true)}
          aria-label={`Cancelar reserva ${reserva.id} de ${reserva.vehiculo}`}>
          Cancelar
        </button>
      )}
      {error && <p role="alert" style={{ color: '#A62E2A', marginBottom: 0 }}>{error}</p>}
    </div>
  )
}
