import { useEffect, useState, type ReactNode } from 'react'

// Poner imágenes en /public/hero. Si no tiene ninguna solo veremos el degradado
const IMAGENES = ['/hero/auto1.jpg', '/hero/auto2.jpg', '/hero/auto3.jpg']

export function Header({ children }: { children?: ReactNode }) {
  const [actual, setActual] = useState(0)

  useEffect(() => {
    if (IMAGENES.length <= 1) return
    const id = setInterval(() => {
      setActual((i) => (i + 1) % IMAGENES.length)
    }, 5000) // cambia de imagen cada 5 segundos
    return () => clearInterval(id)
  }, [])

  return (
    <header className="header">
      {IMAGENES.map((src, i) => (
        <div
          key={src}
          className="header-bg"
          style={{ backgroundImage: `url(${src})`, opacity: i === actual ? 1 : 0 }}
        />
      ))}
      <div className="header-velo" />
      <div className="header-contenido contenedor">{children}</div>
    </header>
  )
}