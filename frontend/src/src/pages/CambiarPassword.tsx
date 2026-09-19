import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { cambiarPasswordApi } from '../api/auth'

export function CambiarPassword() {
  const navigate = useNavigate()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [mostrarActual, setMostrarActual] = useState(false)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (nueva !== confirmacion) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }

    try {
      await cambiarPasswordApi(actual, nueva)
      setMensaje('Contraseña actualizada correctamente.')
      setActual('')
      setNueva('')
      setConfirmacion('')
    } catch {
      setError('No se pudo cambiar la contraseña. Verificá la contraseña actual.')
    }
  }

  return (
    <section className="contenedor password-page">
      <div className="password-card">
        <div className="password-card-head">
          <div className="password-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              <path d="M12 14v2" />
            </svg>
          </div>
          <div>
            <h1>Cambiar contraseña</h1>
          </div>
        </div>

        <form onSubmit={enviar} className="password-form">
          <div className="password-field">
            <label className="fl" htmlFor="password-actual">Contraseña actual</label>
            <div className="password-input-wrap">
              <input id="password-actual" className="fi" value={actual} onChange={(e) => setActual(e.target.value)} type={mostrarActual ? 'text' : 'password'} required autoComplete="current-password" />
              <button type="button" className="password-visibility" onClick={() => setMostrarActual((visible) => !visible)} aria-label={mostrarActual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'} title={mostrarActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <IconoOjo visible={mostrarActual} />
              </button>
            </div>
          </div>

          <div className="password-field">
            <label className="fl" htmlFor="password-nueva">Nueva contraseña</label>
            <div className="password-input-wrap">
              <input id="password-nueva" className="fi" value={nueva} onChange={(e) => setNueva(e.target.value)} type={mostrarNueva ? 'text' : 'password'} minLength={8} required autoComplete="new-password" />
              <button type="button" className="password-visibility" onClick={() => setMostrarNueva((visible) => !visible)} aria-label={mostrarNueva ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'} title={mostrarNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <IconoOjo visible={mostrarNueva} />
              </button>
            </div>
            <p className="password-hint">Usá al menos 8 caracteres.</p>
          </div>

          <div className="password-field">
            <label className="fl" htmlFor="password-confirmacion">Confirmar nueva contraseña</label>
            <div className="password-input-wrap">
              <input id="password-confirmacion" className="fi" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} type={mostrarConfirmacion ? 'text' : 'password'} minLength={8} required autoComplete="new-password" />
              <button type="button" className="password-visibility" onClick={() => setMostrarConfirmacion((visible) => !visible)} aria-label={mostrarConfirmacion ? 'Ocultar confirmación' : 'Mostrar confirmación'} title={mostrarConfirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <IconoOjo visible={mostrarConfirmacion} />
              </button>
            </div>
          </div>

          {error && <p className="password-alert error">{error}</p>}
          {mensaje && <p className="password-alert success">{mensaje}</p>}

          <div className="password-actions">
            <button type="button" className="btn btn-secundario" onClick={() => navigate('/')}>Cancelar</button>
            <button type="submit" className="btn btn-primario">Guardar contraseña</button>
          </div>
        </form>

      </div>
    </section>
  )
}

function IconoOjo({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 8.5 4 9.8 6.1a2.8 2.8 0 0 1 0 .9 15.8 15.8 0 0 1-3.2 3.7" />
      <path d="M6.6 6.6A15.8 15.8 0 0 0 2.2 11c-.3.5-.3 1.1 0 1.6C3.5 14.7 7 18 12 18c1 0 2-.2 2.9-.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.2 12c1.3-2.1 4.8-6 9.8-6s8.5 3.9 9.8 6c-1.3 2.1-4.8 6-9.8 6s-8.5-3.9-9.8-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}