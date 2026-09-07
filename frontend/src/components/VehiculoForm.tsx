import { useState, type FormEvent } from 'react'
import type { TipoVehiculo, Vehiculo } from '../types/vehiculo'
import { TIPOS } from '../types/vehiculo'
import { CATALOGO, modelosDe, tipoDe } from '../catalogo/marcas'
import { crearVehiculo, actualizarVehiculo, type DatosVehiculo } from '../api/vehiculos'
import { IlustracionVehiculo } from './IlustracionVehiculo'

export function VehiculoForm({ vehiculo, onListo, onCancelar }: {
  vehiculo?: Vehiculo
  onListo: () => void
  onCancelar: () => void
}) {
  const esEdicion = !!vehiculo
  const [patente, setPatente] = useState(vehiculo?.patente ?? '')
  const [marca, setMarca] = useState(vehiculo?.marca ?? '')
  const [modelo, setModelo] = useState(vehiculo?.modelo ?? '')
  const [tipo, setTipo] = useState<TipoVehiculo>(vehiculo?.tipo ?? 'SEDAN')
  const [anio, setAnio] = useState(vehiculo?.anio?.toString() ?? '')
  const [color, setColor] = useState(vehiculo?.color ?? '')
  const [precio, setPrecio] = useState(vehiculo?.precioDiario?.toString() ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const modelos = modelosDe(marca)

  function elegirMarca(m: string) {
    setMarca(m)
    setModelo('') // al cambiar la marca se limpia el modelo
  }
  function elegirModelo(mod: string) {
    setModelo(mod)
    const t = tipoDe(marca, mod) // el tipo se sugiere solo según el modelo
    if (t) setTipo(t)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      if (esEdicion) {
        // En edición NO se manda la patente (no es posible modificarla por norma)
        await actualizarVehiculo(vehiculo!.id, {
          marca, modelo, tipo, anio: Number(anio),
          color: color.trim() || undefined, precioDiario: Number(precio),
        })
      } else {
        const datos: DatosVehiculo = {
          patente: patente.trim(), marca, modelo, tipo, anio: Number(anio),
          color: color.trim() || undefined, precioDiario: Number(precio),
        }
        await crearVehiculo(datos)
      }
      onListo()
    } catch (err) {
      // axios deja el mensaje del back en response.data.message
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Error al guardar')
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="form-panel">
      <form onSubmit={guardar} className="form-campos">
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>{esEdicion ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>El ID lo asigna el sistema automáticamente.</p>

        <label className="fl">Patente *</label>
        <input className="fi" value={patente} onChange={(e) => setPatente(e.target.value)} required disabled={esEdicion}
          placeholder="AB123CD" style={esEdicion ? { background: '#F0F3F7', color: '#8593A5' } : undefined} />
        {esEdicion && <div className="fh">La patente no se puede modificar.</div>}

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
            <input className="fi" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} required min={1900} placeholder="2022" />
          </div>
          <div>
            <label className="fl">Color</label>
            <input className="fi" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Gris" />
          </div>
        </div>

        <label className="fl">Precio por día (ARS) *</label>
        <input className="fi" type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} required min={1} step="0.01" placeholder="15000" style={{ maxWidth: 220 }} />

        {error && <p style={{ color: '#D6413B', fontSize: 13 }}>⚠ {error}</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear vehículo'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>

      <div className="form-preview">
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8ea3ba', marginBottom: 8 }}>Vista previa</div>
        <div style={{ fontFamily: 'var(--fuente-titulo)', fontWeight: 700, fontSize: 20, color: '#fff' }}>{marca || 'Marca'} {modelo}</div>
        <div style={{ fontSize: 13, color: '#8ea3ba', marginBottom: 10 }}>{anio || 'Año'}{color ? ` · ${color}` : ''} · {tipo}</div>
        <div key={tipo} className="preview-anim" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <IlustracionVehiculo tipo={tipo} width={260} />
        </div>
      </div>
    </div>
  )
}