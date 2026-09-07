import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion/SesionContext'

export function Navbar() {
  const { usuario, salir } = useSesion()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menú si hacés click en cualquier lado fuera de él
  useEffect(() => {
    function alClickAfuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', alClickAfuera)
    return () => document.removeEventListener('mousedown', alClickAfuera)
  }, [])

  function cerrarSesion() {
    setMenuAbierto(false)
    salir()
    navigate('/') // vuelve al home, donde se puede volver a ingresar
  }

  // Le pone la clase 'activo' al link de la página en la que estás parado
  const clase = ({ isActive }: { isActive: boolean }) => (isActive ? 'navlink activo' : 'navlink')

  return (
    <nav className="navbar">
      <div className="contenedor navbar-inner">
        <Link to="/" className="navbar-logo">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F6B71E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
            <path d="M4 17h16v-4H4z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" />
          </svg>
          Rentar
        </Link>

        <div className="navbar-links">
          <NavLink to="/" end className={clase}>Inicio</NavLink>
          {usuario?.rol === 'admin' && <NavLink to="/admin/vehiculos" className={clase}>Administración</NavLink>}

          {usuario ? (
            <div className="navbar-usuario" ref={menuRef}>
              <button className="navbar-usuario-btn" onClick={() => setMenuAbierto((v) => !v)}>
                Hola, {usuario.nombre}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                  style={{ transform: menuAbierto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuAbierto && (
                <div className="navbar-menu">
                  <button className="navbar-menu-item" onClick={cerrarSesion}>Salir</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/ingreso" className="navbar-cta">Ingresar</Link>
          )}
        </div>
      </div>
    </nav>
  )
}