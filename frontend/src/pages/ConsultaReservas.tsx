import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { consultarReservas } from '../api/reservas'
import { CancelarReserva } from '../components/CancelarReserva'
import { useSesion } from '../sesion/SesionContext'
import type {
  EstadoReserva,
  FiltroReservas,
  ReservaConsulta,
  TipoVehiculo,
} from '../types/reserva'

const TIPOS: TipoVehiculo[] = ['SEDAN', 'SUV', 'HATCHBACK', 'PICKUP', 'COUPE']

const ESTADOS: EstadoReserva[] = ['CONFIRMADA', 'CANCELADA', 'FINALIZADA']

const COLOR_ESTADO: Record<EstadoReserva, { fondo: string; texto: string }> = {
  CONFIRMADA: { fondo: '#E5F6EE', texto: '#1F7A54' },
  CANCELADA: { fondo: '#FFF0EF', texto: '#A62E2A' },
  FINALIZADA: { fondo: '#F0F3F7', texto: '#5A6676' },
}

interface Formulario {
  cliente: string
  vehiculo: string
  tipo: string
  estado: string
  fechaDesde: string
  fechaHasta: string
}

const FORM_VACIO: Formulario = {
  cliente: '',
  vehiculo: '',
  tipo: '',
  estado: '',
  fechaDesde: '',
  fechaHasta: '',
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatearImporte(importe: number) {
  return importe.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  })
}

export function ConsultaReservas() {
  const { usuario } = useSesion()
  const esAdmin = usuario?.rol === 'admin'

  const [form, setForm] = useState<Formulario>(FORM_VACIO)
  const [reservas, setReservas] = useState<ReservaConsulta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtroAplicado, setFiltroAplicado] = useState<Formulario>(FORM_VACIO)

  const buscar = useCallback((valores: Formulario) => {
    setFiltroAplicado(valores)
    setCargando(true)
    setError('')

    const filtro: FiltroReservas = {
      cliente: valores.cliente.trim() || undefined,
      vehiculo: valores.vehiculo.trim() || undefined,
      tipo: (valores.tipo as TipoVehiculo) || undefined,
      estado: (valores.estado as EstadoReserva) || undefined,
      fechaDesde: valores.fechaDesde
        ? `${valores.fechaDesde}T00:00:00.000Z`
        : undefined,
      fechaHasta: valores.fechaHasta
        ? `${valores.fechaHasta}T23:59:59.999Z`
        : undefined,
    }

    consultarReservas(filtro)
      .then(setReservas)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : 'Error al consultar las reservas',
        ),
      )
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    buscar(FORM_VACIO)
  }, [buscar])

  function cambiar(campo: keyof Formulario, valor: string) {
    setForm((actual) => ({ ...actual, [campo]: valor }))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    buscar(form)
  }

  function limpiar() {
    setForm(FORM_VACIO)
    buscar(FORM_VACIO)
  }

  const hayFiltros = Object.values(form).some((valor) => valor !== '')

  return (
    <section className="contenedor" style={{ padding: '36px 24px 60px' }}>
      <div className="admin-head">
        <div>
          <div style={{ fontSize: 13, color: 'var(--texto-tenue)' }}>
            {esAdmin ? 'Administración' : 'Mi cuenta'}
          </div>

          <h1 style={{ fontSize: 28 }}>
            {esAdmin ? 'Reservas' : 'Mis reservas'}
          </h1>
        </div>
      </div>

      <form
        className="buscador"
        onSubmit={enviar}
        style={{ marginBottom: 22 }}
      >

        {esAdmin && (
          <div className="buscador-campo">
            <label htmlFor="f-cliente">Cliente</label>

            <input
              id="f-cliente"
              type="text"
              placeholder="Nombre, documento o email"
              value={form.cliente}
              onChange={(e) => cambiar('cliente', e.target.value)}
            />
          </div>
        )}

        <div className="buscador-campo">
          <label htmlFor="f-vehiculo">Vehículo</label>

          <input
            id="f-vehiculo"
            type="text"
            placeholder="Marca, modelo o patente"
            value={form.vehiculo}
            onChange={(e) => cambiar('vehiculo', e.target.value)}
          />
        </div>

        <div className="buscador-campo">
          <label htmlFor="f-tipo">Tipo</label>

          <select
            id="f-tipo"
            value={form.tipo}
            onChange={(e) => cambiar('tipo', e.target.value)}
          >
            <option value="">Todos</option>

            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <div className="buscador-campo">
          <label htmlFor="f-estado">Estado</label>

          <select
            id="f-estado"
            value={form.estado}
            onChange={(e) => cambiar('estado', e.target.value)}
          >
            <option value="">Todos</option>

            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>

        <div className="buscador-campo fecha">
          <label htmlFor="f-desde">Desde</label>

          <input
            id="f-desde"
            type="date"
            value={form.fechaDesde}
            onChange={(e) => cambiar('fechaDesde', e.target.value)}
          />
        </div>

        <div className="buscador-campo fecha">
          <label htmlFor="f-hasta">Hasta</label>

          <input
            id="f-hasta"
            type="date"
            value={form.fechaHasta}
            onChange={(e) => cambiar('fechaHasta', e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primario buscador-boton"
          disabled={cargando}
        >
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>

        {hayFiltros && (
          <button
            type="button"
            className="btn-filtro buscador-boton"
            onClick={limpiar}
          >
            Limpiar
          </button>
        )}
      </form>

      {cargando && (
        <p style={{ color: 'var(--texto-suave)' }}>Cargando reservas…</p>
      )}

      {error && <p style={{ color: '#D6413B' }}>⚠ {error}</p>}
      {aviso && <p role="status" style={{ color: '#1F7A54' }}>{aviso}</p>}

      {!cargando && !error && (
        <div className="tabla-wrap" style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                {esAdmin && <th>Cliente</th>}
                <th>Vehículo</th>
                <th>Patente</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th style={{ textAlign: 'right' }}>Precio diario</th>
                <th style={{ textAlign: 'right' }}>Importe total</th>
                <th>Estado</th>
                {!esAdmin && <th>Acciones</th>}
              </tr>
            </thead>

            <tbody>
              {reservas.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      color: 'var(--texto-suave)',
                      textAlign: 'center',
                      padding: 30,
                    }}
                  >
                    No hay reservas para mostrar.
                  </td>
                </tr>
              )}

              {reservas.map((reserva) => (
                <tr key={reserva.id}>
                  {esAdmin && (
                    <td style={{ fontWeight: 600 }}>{reserva.cliente}</td>
                  )}

                  <td>
                    {reserva.vehiculo}

                    <div style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
                      {reserva.tipo}
                    </div>
                  </td>

                  <td className="mono">{reserva.patente}</td>

                  <td>{formatearFecha(reserva.fechaInicio)}</td>

                  <td>{formatearFecha(reserva.fechaFin)}</td>

                  <td style={{ textAlign: 'right' }}>
                    {formatearImporte(reserva.precioDiario)}
                  </td>

                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatearImporte(reserva.importeTotal)}
                  </td>

                  <td>
                    <span
                      className="badge"
                      style={{
                        background: COLOR_ESTADO[reserva.estado].fondo,
                        color: COLOR_ESTADO[reserva.estado].texto,
                      }}
                    >
                      {reserva.estado}
                    </span>
                  </td>
                  {!esAdmin && (
                    <td>
                      <CancelarReserva reserva={reserva} onCancelada={() => {
                        setAviso('Reserva cancelada. Podés verla en tu historial de alquileres.')
                        buscar(filtroAplicado)
                      }} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!cargando && !error && reservas.length > 0 && (
        <p
          style={{
            marginTop: 14,
            fontSize: 13,
            color: 'var(--texto-tenue)',
          }}
        >
          {reservas.length} reserva{reservas.length === 1 ? '' : 's'}
        </p>
      )}
    </section>
  )
}
