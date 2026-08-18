import type { RackMapa, PosicionMapa } from '../hooks/useUbicaciones'
import { PosicionBtn } from './PosicionBtn'

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

export function RackDetalleModal({
  rack,
  onClose,
  onPosicion,
}: {
  rack:       RackMapa
  onClose:    () => void
  onPosicion: (p: PosicionMapa) => void
}) {
  const total    = rack.posiciones.length
  const ocupadas = rack.posiciones.filter((p) => p.ocupada).length
  // Ordenar de mayor a menor nivel (N4 arriba, N1 abajo = vista real del rack)
  const posicionesOrdenadas = [...rack.posiciones].sort((a, b) => b.nivel - a.nivel)

  return (
    <div className="mapa-pos-overlay" onClick={onClose}>
      <div className="mapa-pos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mapa-pos-modal-header">
          <div className="mapa-pos-modal-titulo">
            <span className="mapa-pos-modal-codigo">{rack.codigo}</span>
            <span className="mapa-pos-modal-nivel">{ocupadas}/{total} ocupadas</span>
          </div>
          <button className="mapa-pos-modal-cerrar" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className="mapa-pos-modal-body">
          <div className="mapa-posiciones-grid">
            {posicionesOrdenadas.map((pos) => (
              <PosicionBtn key={pos.id} pos={pos} onClick={() => onPosicion(pos)} />
            ))}
          </div>
        </div>

        <div className="mapa-leyenda">
          <span className="mapa-leyenda-item mapa-leyenda-libre">Libre</span>
          <span className="mapa-leyenda-item mapa-leyenda-parcial">Parcial</span>
          <span className="mapa-leyenda-item mapa-leyenda-casi-llena">Casi llena</span>
          <span className="mapa-leyenda-item mapa-leyenda-llena">Llena</span>
        </div>
      </div>
    </div>
  )
}
