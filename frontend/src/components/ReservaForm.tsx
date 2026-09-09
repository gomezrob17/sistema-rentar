import { useState, type FormEvent } from 'react'
import type { VehiculoDisponible } from '../types/vehiculo'
import { crearReserva } from '../api/reservas'
import type { Reserva } from '../types/reserva'
import { useSesion } from '../sesion/SesionContext'
import { IlustracionVehiculo } from './IlustracionVehiculo'

// Igual que en el backend: se cobra todo período iniciado
const MS_POR_DIA = 24 * 60 * 60 * 1000

const fechaBonita = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function ReservaForm({ vehiculo, fechas, onListo, onCancelar }: {
  vehiculo: VehiculoDisponible
  fechas: { inicio: string; fin: string } // fechas fijas de la búsqueda inicial
  onListo: () => void
  onCancelar: () => void
}) {
  const { usuario } = useSesion()
  const [reserva, setReserva] = useState<Reserva | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Período alquilado y total (misma fórmula que el backend)
  const dias = Math.max(1, Math.ceil(
    (new Date(fechas.fin).getTime() - new Date(fechas.inicio).getTime()) / MS_POR_DIA,
  ))
  const total = Number(vehiculo.precioDiario) * dias

  function formatear(valor: string) {
    return fechaBonita.format(new Date(valor))
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!usuario?.clienteId) return
    setGuardando(true)
    setError('')
    try {
      const nueva = await crearReserva({
        clienteId: usuario.clienteId,
        vehiculoId: vehiculo.id,
        fechaInicio: new Date(fechas.inicio).toISOString(),
        fechaFin: new Date(fechas.fin).toISOString(),
      })
      setReserva(nueva)
    } catch (err) {
      // axios deja el mensaje del back en response.data.message
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Error al reservar')
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
    } finally {
      setGuardando(false)
    }
  }

  // Fila de dato fijo del resumen (label a la izq, valor a la der)
  function fila(etiqueta: string, valor: string) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid #EEF1F5', fontSize: 14 }}>
        <span style={{ color: 'var(--texto-tenue)' }}>{etiqueta}</span>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{valor}</span>
      </div>
    )
  }

  return (
    <div className="form-panel">
      <div className="form-campos">
        {reserva ? (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Reserva confirmada</h2>
            <p style={{ color: '#1F7A54', fontSize: 14, marginTop: 0, marginBottom: 20 }}>
              ✓ Tu reserva quedó registrada en estado CONFIRMADA.
            </p>

            {fila('N° de reserva', `#${reserva.id}`)}
            {fila('Vehículo', `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente})`)}
            {fila('Desde', formatear(reserva.fechaInicio))}
            {fila('Hasta', formatear(reserva.fechaFin))}
            {fila('Estado', reserva.estado)}
            {fila('Total', `$${Number(reserva.importeTotal).toLocaleString('es-AR')}`)}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="button" className="btn btn-primario" onClick={onListo}>Volver a la lista</button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Reservar vehículo</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
              Revisá los datos y confirmá tu reserva.
            </p>

            {fila('Vehículo', `${vehiculo.marca} ${vehiculo.modelo}`)}
            {fila('Patente', vehiculo.patente)}
            {fila('Año', vehiculo.color ? `${vehiculo.anio} · ${vehiculo.color}` : `${vehiculo.anio}`)}
            {fila('Tipo', vehiculo.tipo)}

            {/* Fechas fijas: salen del buscador de la Home y no se pueden cambiar acá */}
            {fila('Desde', formatear(fechas.inicio))}
            {fila('Hasta', formatear(fechas.fin))}
            <div className="fh" style={{ marginTop: 8 }}>
              Las fechas son las de tu búsqueda. Para cambiarlas volvé al buscador y buscá de nuevo.
            </div>

            {error && <p style={{ color: '#D6413B', fontSize: 13 }}>⚠ {error}</p>}

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button type="button" className="btn btn-primario" onClick={confirmar} disabled={guardando}>
                {guardando ? 'Confirmando…' : `Confirmar reserva · $${total.toLocaleString('es-AR')}`}
              </button>
              <button type="button" className="btn btn-secundario" onClick={onCancelar}>Cancelar</button>
            </div>
          </>
        )}
      </div>

      <div className="form-preview">
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8ea3ba', marginBottom: 8 }}>
          Resumen
        </div>
        <div style={{ fontFamily: 'var(--fuente-titulo)', fontWeight: 700, fontSize: 20, color: '#fff' }}>
          {vehiculo.marca} {vehiculo.modelo}
        </div>
        <div style={{ fontSize: 13, color: '#8ea3ba', marginBottom: 10 }}>
          {vehiculo.anio}{vehiculo.color ? ` · ${vehiculo.color}` : ''} · {vehiculo.tipo} · {vehiculo.patente}
        </div>
        <div key={vehiculo.tipo} className="preview-anim" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <IlustracionVehiculo tipo={vehiculo.tipo} width={260} />
        </div>

        {/* Desglose del importe */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.18)', marginTop: 10, paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c6d2e2', fontSize: 13, marginBottom: 6 }}>
            <span>${Number(vehiculo.precioDiario).toLocaleString('es-AR')} × {dias} día(s)</span>
            <span>${Number(vehiculo.precioDiario * dias).toLocaleString('es-AR')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: '#c6d2e2', fontSize: 13 }}>Total a pagar</span>
            <span style={{ fontFamily: 'var(--fuente-titulo)', fontWeight: 800, fontSize: 26, color: '#fff' }}>
              ${total.toLocaleString('es-AR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
