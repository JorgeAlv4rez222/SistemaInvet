import type { PosicionMapa } from '../hooks/useUbicaciones'
import { calcularCapacidad, nivelOcupacion } from '../../../shared/utils/cubicacion'

export function PosicionBtn({ pos, onClick }: { pos: PosicionMapa; onClick: () => void }) {
  let clase = 'mapa-pos-btn mapa-pos-btn--libre'
  let titulo = 'Libre'

  if (pos.ocupada && pos.lote) {
    const capacidad = calcularCapacidad(pos.lote)
    const nivel     = nivelOcupacion(pos.lote.cantidad, capacidad)
    clase  = `mapa-pos-btn mapa-pos-btn--${nivel}`
    titulo = capacidad > 0
      ? `${pos.lote.nombre} · ${pos.lote.cantidad}/${capacidad} cajas`
      : pos.lote.nombre
  } else if (pos.ocupada) {
    clase  = 'mapa-pos-btn mapa-pos-btn--parcial'
    titulo = 'Ocupada'
  }

  return (
    <button className={clase} onClick={onClick} title={titulo}>
      <span className="mapa-pos-nivel">N{pos.nivel}</span>
      <span className="mapa-pos-lado">{pos.posicion}</span>
      {pos.ocupada && <span className="mapa-pos-dot" />}
    </button>
  )
}
