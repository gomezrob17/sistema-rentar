import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { VehiculoCard } from '../components/VehiculoCard'
import { ReservaForm } from '../components/ReservaForm'
import { buscarDisponibles } from '../api/disponibilidad'
import { listarVehiculos } from '../api/vehiculos'
import { useSesion } from '../sesion/SesionContext'
import { TIPOS, type TipoVehiculo, type Vehiculo, type VehiculoDisponible } from '../types/vehiculo'

function fechaDefault(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  d.setHours(9, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function Home() {
  const navigate = useNavigate()
  const { usuario } = useSesion()
  const [fechaInicio, setFechaInicio] = useState(fechaDefault(1))
  const [fechaFin, setFechaFin] = useState(fechaDefault(2))
  const [tipo, setTipo] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')

  const [flota, setFlota] = useState<Vehiculo[]>([])
  const [resultados, setResultados] = useState<VehiculoDisponible[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [busco, setBusco] = useState(false)
  // Fechas de la última búsqueda ejecutada (las del formulario de reserva)
  const [fechasBusqueda, setFechasBusqueda] = useState<{ inicio: string; fin: string } | null>(null)
  // Vehículo que se está por reservar (muestra el panel de reserva)
  const [reservando, setReservando] = useState<VehiculoDisponible | null>(null)

  // Traemos la flota de vehiculos una vez para armar los desplegables de marca y modelo
  useEffect(() => {
    listarVehiculos().then(setFlota).catch(() => setFlota([]))
  }, [])

  const activos = flota.filter((v) => v.activo)
  // Marcas que existen para el tipo elegido (o todas, si no se eligió tipo)
  const marcas = Array.from(new Set(activos.filter((v) => !tipo || v.tipo === tipo).map((v) => v.marca))).sort()
  // Modelos que existen para ese tipo + esa marca
  const modelos = Array.from(new Set(
    activos.filter((v) => (!tipo || v.tipo === tipo) && (!marca || v.marca === marca)).map((v) => v.modelo),
  )).sort()

  function elegirTipo(t: string) { setTipo(t); setMarca(''); setModelo('') }
  function elegirMarca(m: string) { setMarca(m); setModelo('') }

  async function ejecutarBusqueda(fechas = { inicio: fechaInicio, fin: fechaFin }) {
    setCargando(true)
    setError('')
    setBusco(true)
    // Congelamos las fechas de ESTA búsqueda: son las que usa el formulario de reserva
    setFechasBusqueda(fechas)
    try {
      const datos = await buscarDisponibles({
        fechaInicio: new Date(fechas.inicio).toISOString(),
        fechaFin: new Date(fechas.fin).toISOString(),
        tipo: tipo ? (tipo as TipoVehiculo) : undefined,
        marca: marca || undefined,
        modelo: modelo || undefined,
        precioMin: precioMin ? Number(precioMin) : undefined,
        precioMax: precioMax ? Number(precioMax) : undefined,
      })
      setResultados(datos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar')
    } finally {
      setCargando(false)
    }
  }

  function buscar(e: FormEvent) {
    e.preventDefault()
    ejecutarBusqueda()
  }

  function reservar(v: VehiculoDisponible) {
    // La reserva la hace un cliente: sin sesión lo mandamos a loguearse
    if (!usuario) {
      navigate('/ingreso')
      return
    }
    setReservando(v)
  }

  // Panel de reserva: reemplaza la Home hasta confirmar o cancelar
  if (reservando && fechasBusqueda) {
    const vehiculo = reservando
    const fechas = fechasBusqueda
    return (
      <section className="contenedor" style={{ padding: '36px 24px 60px' }}>
        <ReservaForm
          vehiculo={vehiculo}
          fechas={fechas}
          onListo={() => {
            setReservando(null)
            // Refrescamos la disponibilidad con las mismas fechas de la búsqueda
            ejecutarBusqueda(fechas)
          }}
          onCancelar={() => setReservando(null)}
        />
      </section>
    )
  }

  return (
    <>
      <Header>
        <h1>Alquiler de autos para viajar a tu manera.</h1>
        <p>Elegí las fechas y consultá qué vehículos están disponibles.</p>
      </Header>

      <section className="contenedor" style={{ marginTop: -60, position: 'relative', zIndex: 2 }}>
        <form className="buscador" onSubmit={buscar}>
          <div className="buscador-campo fecha">
            <label>Inicio *</label>
            <input type="datetime-local" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </div>
          <div className="buscador-campo fecha">
            <label>Fin *</label>
            <input type="datetime-local" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
          </div>
          <div className="buscador-campo">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => elegirTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="buscador-campo">
            <label>Marca</label>
            <select value={marca} onChange={(e) => elegirMarca(e.target.value)} disabled={marcas.length === 0}>
              <option value="">Todas</option>
              {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="buscador-campo">
            <label>Modelo</label>
            <select value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={modelos.length === 0}>
              <option value="">Todos</option>
              {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="buscador-campo precio">
            <label>Precio por día (ARS)</label>
            <div className="precio-rango">
              <input type="text" inputMode="numeric" placeholder="Mín"
                value={precioMin ? Number(precioMin).toLocaleString('es-AR') : ''}
                onChange={(e) => setPrecioMin(e.target.value.replace(/\D/g, ''))} />
              <input type="text" inputMode="numeric" placeholder="Máx"
                value={precioMax ? Number(precioMax).toLocaleString('es-AR') : ''}
                onChange={(e) => setPrecioMax(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          <button type="submit" className="btn btn-primario buscador-boton">Buscar</button>
        </form>
      </section>

      <section className="contenedor" style={{ padding: '40px 24px 60px' }}>
        {!busco && <p style={{ color: 'var(--texto-suave)' }}>Elegí las fechas y tocá Buscar para ver la disponibilidad.</p>}
        {cargando && <p style={{ color: 'var(--texto-suave)' }}>Buscando…</p>}
        {error && <p style={{ color: '#D6413B' }}>⚠ {error}</p>}
        {!cargando && !error && busco && resultados.length === 0 && (
          <p style={{ color: 'var(--texto-suave)' }}>No hay vehículos disponibles para esas fechas y filtros.</p>
        )}
        {resultados.length > 0 && (
          <>
            <h2 style={{ fontSize: 26, marginBottom: 18 }}>{resultados.length} vehículo(s) disponible(s)</h2>
            <div className="grilla">
              {resultados.map((v) => (
                <VehiculoCard
                  key={v.id}
                  v={v}
                  onReservar={reservar}
                  ocultarReservar={usuario?.rol === 'admin'}
                  bloqueado={
                    usuario && usuario.rol === 'cliente' && !usuario.clienteId
                      ? 'Tu sesión no está vinculada a un cliente. Iniciá sesión con tu cuenta real.'
                      : undefined
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}