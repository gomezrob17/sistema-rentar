import type { VehiculoDisponible } from '../types/vehiculo'
import { IlustracionVehiculo } from './IlustracionVehiculo'

export function VehiculoCard({ v }: { v: VehiculoDisponible }) {
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
          <div className="vcard-precio">${v.precioDiario.toLocaleString('es-AR')}<span> /día</span></div>
          <button className="btn btn-primario vcard-btn">Reservar</button>
        </div>
      </div>
    </div>
  )
}