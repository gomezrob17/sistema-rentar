import { useState, type FormEvent, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion/SesionContext'

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--borde)',
  borderRadius: 10, padding: '10px 12px', fontSize: 14, margin: '6px 0 14px',
  fontFamily: 'var(--fuente-texto)',
}

export function Ingreso() {
  const { iniciarSesion } = useSesion()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const u = await iniciarSesion(email, pass)
    if (!u) {
      setError('Email o contraseña incorrectos.')
      return
    }
    setError('')
    // Al administrador lo lleva al panel y al cliente a la Home
    navigate(u.rol === 'admin' ? '/admin/vehiculos' : '/')
  }

  return (
    <section className="contenedor" style={{ padding: '48px 24px', display: 'grid', placeItems: 'center' }}>
      <form onSubmit={enviar} style={{ width: 380, background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 'var(--radio-lg)', padding: 28 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Ingresá a Rentar</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: 14, marginTop: 0, marginBottom: 20 }}>Usá tu email y contraseña.</p>

        <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={inputStyle} placeholder="tu@email.com" />

        <label style={{ fontSize: 13, fontWeight: 600 }}>Contraseña</label>
        <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" required style={inputStyle} placeholder="••••••••" />

        {error && <p style={{ color: '#D6413B', fontSize: 13, margin: '4px 0 12px' }}>⚠ {error}</p>}

        <button type="submit" className="btn btn-primario" style={{ width: '100%', marginTop: 8 }}>Ingresar</button>

        <div style={{ marginTop: 18, padding: 12, background: 'var(--fondo)', borderRadius: 10, fontSize: 12, color: 'var(--texto-suave)', lineHeight: 1.7 }}>
          <b>Usuarios de prueba</b><br />
          Admin → admin@unla.com.ar / Admin123<br />
          Cliente → cliente1@pruebas.com.ar / 12345678
        </div>
      </form>
    </section>
  )
}