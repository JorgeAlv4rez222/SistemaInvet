import type { PosicionMapa } from '../hooks/useUbicaciones'

export function PosicionBtn({ pos, onClick }: { pos: PosicionMapa; onClick: () => void }) {
  const titulo = pos.ocupada && pos.lote
    ? `${pos.lote.nombre} · ${pos.lote.cantidad} uds.`
    : pos.ocupada ? 'Ocupada' : 'Libre'

  return (
    <button className="mapa-pos-btn" onClick={onClick} title={titulo}>
      <span className="mapa-pos-lado">{pos.posicion}</span>
    </button>
  )
}
