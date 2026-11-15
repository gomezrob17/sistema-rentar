// Resultado de la reasignación automática por avería (recuperatorio).
export function EstadoReasignacion({ estado, detalle }: {
  estado?: string | null
  detalle?: string | null
}) {
  if (!estado) return <span style={{ color: 'var(--texto-tenue)' }}>—</span>

  const reasignada = estado === 'REASIGNADA'
  return (
    <div style={{ maxWidth: 320 }}>
      <span
        className="badge"
        style={reasignada
          ? { background: '#E5F6EE', color: '#1F7A54' }
          : { background: '#FFF0EF', color: '#A62E2A' }}
      >
        {reasignada ? 'Reasignada' : 'Fallida'}
      </span>
      {detalle && (
        <div style={{ fontSize: 11, color: 'var(--texto-tenue)', marginTop: 4 }}>
          {detalle}
        </div>
      )}
    </div>
  )
}
