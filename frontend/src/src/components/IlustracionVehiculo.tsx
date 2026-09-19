import type { TipoVehiculo } from '../types/vehiculo'

export function IlustracionVehiculo({ tipo, width = 210 }: { tipo: TipoVehiculo; width?: number }) {
  return (
    <svg viewBox="0 0 200 100" width={width} height={width / 2}>
      {contenido(tipo)}
    </svg>
  )
}

function contenido(tipo: TipoVehiculo) {
  const rueda = (cx: number, r: number) => (
    <g><circle cx={cx} cy="80" r={r} fill="#0E1A2B" /><circle cx={cx} cy="80" r={r * 0.4} fill="#F6B71E" /></g>
  )
  const sombra = (rx: number) => <ellipse cx="100" cy="87" rx={rx} ry="7" fill="#0E1A2B" opacity="0.1" />

  switch (tipo) {
    case 'SUV':
      return (<>{sombra(86)}<path d="M16 64 C16 55 22 53 30 52 L52 49 C58 33 72 29 90 29 L138 29 C156 29 167 37 175 49 L186 52 C193 54 196 57 196 65 L196 76 C196 79 194 80 191 80 L21 80 C18 80 16 78 16 74 Z" fill="#8aa0b8" /><path d="M56 49 L61 33 C62 31 64 31 67 31 L134 31 C138 31 140 33 142 36 L150 49 Z" fill="#a7bacf" />{rueda(56, 15)}{rueda(150, 15)}</>)
    case 'PICKUP':
      return (<>{sombra(88)}<path d="M14 66 C14 58 20 56 28 55 L190 55 C194 55 196 57 196 61 L196 76 C196 79 194 80 191 80 L19 80 C16 80 14 78 14 74 Z" fill="#8aa0b8" /><path d="M40 55 L45 35 C46 33 48 33 51 33 L92 33 C96 33 98 36 100 42 L102 55 Z" fill="#a7bacf" /><path d="M104 44 L188 44 L188 55 L104 55 Z" fill="#7c92a8" />{rueda(54, 15)}{rueda(152, 15)}</>)
    case 'COUPE':
      return (<>{sombra(86)}<path d="M14 70 C14 62 22 60 30 59 L58 55 C70 44 88 39 110 39 L140 41 C164 45 180 55 190 62 C195 64 196 66 196 71 L196 77 C196 79 194 80 191 80 L19 80 C16 80 14 78 14 74 Z" fill="#8aa0b8" /><path d="M64 55 C80 43 96 41 112 41 L136 43 C152 47 162 53 170 60 Z" fill="#a7bacf" />{rueda(56, 14)}{rueda(150, 14)}</>)
    case 'HATCHBACK':
      return (<>{sombra(76)}<path d="M30 68 C30 60 36 58 44 57 L64 53 C74 41 86 37 100 37 L120 37 C136 37 148 45 154 55 L168 58 C176 59 178 61 178 67 L178 76 C178 79 176 80 173 80 L35 80 C32 80 30 78 30 74 Z" fill="#8aa0b8" /><path d="M70 53 C80 42 90 40 100 40 L118 40 C130 40 139 46 145 54 Z" fill="#a7bacf" />{rueda(64, 14)}{rueda(146, 14)}</>)
    default: // SEDAN
      return (<>{sombra(84)}<path d="M18 68 C18 60 26 58 34 57 L62 53 C74 40 88 36 104 36 L128 36 C146 36 158 44 168 54 L182 58 C192 60 194 64 194 70 L194 76 C194 79 192 80 189 80 L23 80 C20 80 18 78 18 74 Z" fill="#8aa0b8" /><path d="M68 52 C80 40 90 38 104 38 L124 38 C138 38 148 44 156 52 Z" fill="#a7bacf" />{rueda(58, 14)}{rueda(150, 14)}</>)
  }
}