const estados: Record<string, { etiqueta: string; fondo: string; texto: string }> = {
  PENDIENTE: { etiqueta: 'Pendiente', fondo: '#FFF4D6', texto: '#805B10' },
  REALIZADO: { etiqueta: 'Realizado', fondo: '#E5F6EE', texto: '#1F7A54' },
  NO_REALIZADO: { etiqueta: 'No realizado', fondo: '#FFF0EF', texto: '#A62E2A' },
}

export function EstadoMantenimiento({ estado }: { estado?: string | null }) {
  const detalle = estado ? estados[estado] : undefined
  if (!detalle) return <span style={{ color: 'var(--texto-tenue)' }}>Sin solicitud</span>
  return <span className="badge" style={{ background: detalle.fondo, color: detalle.texto }}>
    {detalle.etiqueta}
  </span>
}
