import type { VehiculoDisponible } from '../types/vehiculo'
import { IlustracionVehiculo } from './IlustracionVehiculo'

export function VehiculoCard({ v, onReservar, ocultarReservar, bloqueado }: {
  v: VehiculoDisponible
  onReservar?: (v: VehiculoDisponible) => void
  ocultarReservar?: boolean // el admin no reserva
  bloqueado?: string // si viene, el botón se deshabilita y muestra el motivo
}) {
  return (
    <div className="vcard">
      <div className="vcard-imagen">
        <span className="vcard-badge">{v.tipo}</span>
        <IlustracionVehiculo tipo={v.tipo} width={210} />
      </div>
      <div className="vcard-cuerpo">
        <div className="vcard-titulo">{v.marca} {v.modelo}</div>
        <div className="vcard-meta">{v.anio}{v.color ? ` · ${v.color}` : ''} · {v.patente}</div>
        <div className="vcard-pie">
          <div className="vcard-precio">${Number(v.precioDiario).toLocaleString('es-AR')}<span> /día</span></div>
          {!ocultarReservar && (
            <button
              className="btn btn-primario vcard-btn"
              onClick={() => onReservar?.(v)}
              disabled={!!bloqueado}
              title={bloqueado ?? undefined}
            >
              Reservar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
