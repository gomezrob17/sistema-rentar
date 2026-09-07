import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion/SesionContext'

export function Navbar() {
  const { usuario, salir } = useSesion()
  const navigate = useNavigate()

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [adminMenuAbierto, setAdminMenuAbierto] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const adminMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function alClickAfuera(e: MouseEvent) {
      const objetivo = e.target as Node

      if (
        menuRef.current &&
        !menuRef.current.contains(objetivo)
      ) {
        setMenuAbierto(false)
      }

      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(objetivo)
      ) {
        setAdminMenuAbierto(false)
      }
    }

    document.addEventListener('mousedown', alClickAfuera)

    return () => {
      document.removeEventListener('mousedown', alClickAfuera)
    }
  }, [])

  function cerrarSesion() {
    setMenuAbierto(false)
    salir()
    navigate('/')
  }

  function cerrarMenuAdmin() {
    setAdminMenuAbierto(false)
  }

  const clase = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'navlink activo' : 'navlink'

  return (
    <nav className="navbar">
      <div className="contenedor navbar-inner">
        <Link to="/" className="navbar-logo">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F6B71E"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
            <path d="M4 17h16v-4H4z" />
            <circle cx="7.5" cy="17.5" r="1.5" />
            <circle cx="16.5" cy="17.5" r="1.5" />
          </svg>
          Rentar
        </Link>

        <div className="navbar-links">
          <NavLink to="/" end className={clase}>
            Inicio
          </NavLink>

          {usuario?.rol === 'admin' && (
            <div className="navbar-admin" ref={adminMenuRef}>
              <button
                className="navbar-admin-btn"
                onClick={() =>
                  setAdminMenuAbierto((abierto) => !abierto)
                }
                aria-expanded={adminMenuAbierto}
                aria-haspopup="menu"
              >
                Administración

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  style={{
                    transform: adminMenuAbierto
                      ? 'rotate(180deg)'
                      : 'none',
                    transition: 'transform .2s',
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {adminMenuAbierto && (
                <div className="navbar-menu navbar-admin-menu">
                  <NavLink
                    to="/admin/vehiculos"
                    className="navbar-menu-link"
                    onClick={cerrarMenuAdmin}
                  >
                    ABM Vehículos
                  </NavLink>

                  <NavLink
                    to="/admin/clientes"
                    className="navbar-menu-link"
                    onClick={cerrarMenuAdmin}
                  >
                    ABM Clientes
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {usuario ? (
            <div className="navbar-usuario" ref={menuRef}>
              <button
                className="navbar-usuario-btn"
                onClick={() => setMenuAbierto((v) => !v)}
              >
                Hola, {usuario.nombre}

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  style={{
                    transform: menuAbierto
                      ? 'rotate(180deg)'
                      : 'none',
                    transition: 'transform .2s',
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {menuAbierto && (
                <div className="navbar-menu">
                  <button
                    className="navbar-menu-item"
                    onClick={cerrarSesion}
                  >
                    Salir
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/ingreso" className="navbar-cta">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}