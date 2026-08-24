import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useColaSubtareas, useConfirmarSubtarea } from '../hooks/usePickingMasivo'
import { productosApi } from '../../productos/services/productos.api'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import { onlyNumbersKeyDown, onlyNumbersPaste } from '../../../shared/utils/numericInput'
import type { ProductoConUbicacion } from '../../productos/services/productos.api'

export function ConfirmarSubtareaPage() {
  const { id: sesionId, subtareaId } = useParams<{ id: string; subtareaId: string }>()
  const navigate    = useNavigate()
  const operadorId  = localStorage.getItem('user_id') ?? ''

  const { data, isLoading } = useColaSubtareas(sesionId ?? null)
  const confirmarSubtarea   = useConfirmarSubtarea(sesionId ?? '')

  const subtarea = (data ?? []).find((s) => s.id === subtareaId)

  const [cantidad, setCantidad]                 = useState('')
  const [motivo, setMotivo]                     = useState('')
  const [equivalenteActivo, setEquivalenteActivo] = useState(false)
  const [busquedaEq, setBusquedaEq]             = useState('')
  const [opcionesEq, setOpcionesEq]             = useState<ProductoConUbicacion[]>([])
  const [equivalenteSel, setEquivalenteSel]     = useState<ProductoConUbicacion | null>(null)
  const [buscandoEq, setBuscandoEq]             = useState(false)
  const [error, setError]                       = useState<string | null>(null)

  useEffect(() => {
    if (subtarea) setCantidad(String(subtarea.cantidad_asignada))
  }, [subtarea?.id])

  useEffect(() => {
    if (!equivalenteActivo || !busquedaEq.trim()) { setOpcionesEq([]); return }
    let vigente = true
    setBuscandoEq(true)
    productosApi.buscar(busquedaEq.trim())
      .then((res) => { if (vigente) setOpcionesEq(res) })
      .catch(() => { if (vigente) setOpcionesEq([]) })
      .finally(() => { if (vigente) setBuscandoEq(false) })
    return () => { vigente = false }
  }, [busquedaEq, equivalenteActivo])

  if (isLoading) return <div className="notas-page"><p className="cargando">Cargando…</p></div>
  if (!subtarea)  return <div className="notas-page"><p className="error">Subtarea no encontrada o ya procesada</p></div>

  const cantAsignada    = subtarea.cantidad_asignada
  const cantNum         = parseInt(cantidad, 10) || 0
  const requiereMotivo  = cantNum < cantAsignada

  async function confirmar(cantidadFinal: number, motivoFinal: string | undefined) {
    if (!sesionId) return
    setError(null)
    try {
      await confirmarSubtarea.mutateAsync({
        subtareaId:         subtarea!.id,
        usuarioId:          operadorId,
        cantidadDespachada: cantidadFinal,
        motivo:             motivoFinal,
        productoRealId:     equivalenteSel?.id,
      })
      navigate(`/picking-masivo/operador/${sesionId}`)
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al confirmar la subtarea')
    }
  }

  function handleConfirmarDespacho() {
    if (cantNum <= 0) { setError('Ingresa una cantidad válida'); return }
    if (cantNum > cantAsignada) { setError(`No puedes despachar más de lo asignado (${cantAsignada})`); return }
    if (cantNum < cantAsignada && !motivo.trim()) { setError('El motivo es obligatorio para despacho parcial'); return }
    confirmar(cantNum, cantNum < cantAsignada ? motivo.trim() : undefined)
  }

  function handleSinStock() {
    if (!motivo.trim()) { setError('Indica el motivo de la falta de stock'); return }
    setCantidad('0')
    confirmar(0, motivo.trim())
  }

  return (
    <div className="notas-page pm-confirmar-page">
      <div className="pm-confirmar-header">
        <span className="pm-confirmar-pos">{subtarea.posicion_codigo}</span>
        <span className="pm-confirmar-prod">
          {equivalenteSel ? equivalenteSel.sku : subtarea.items_picking_masivo?.codigo}
          {' — '}
          {equivalenteSel ? equivalenteSel.nombre : subtarea.items_picking_masivo?.descripcion}
        </span>
        <span className="pm-confirmar-cant">Asignado: {cantAsignada} uds</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="pm-confirmar-form">
        <label className="pm-confirmar-label">
          Cantidad a despachar
          <input
            type="number"
            className="pm-confirmar-input"
            min={0}
            max={cantAsignada}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            onKeyDown={onlyNumbersKeyDown}
            onPaste={onlyNumbersPaste}
          />
        </label>

        {requiereMotivo && (
          <label className="pm-confirmar-label">
            Motivo (obligatorio)
            <textarea
              className="pm-confirmar-textarea"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo de la diferencia…"
            />
          </label>
        )}

        <button
          type="button"
          className={`filtro-btn pm-confirmar-toggle-btn ${equivalenteActivo ? 'activo' : ''}`}
          onClick={() => { setEquivalenteActivo((v) => !v); setEquivalenteSel(null); setBusquedaEq('') }}
        >
          Producto equivalente
        </button>

        {equivalenteActivo && (
          <div className="ing-busqueda">
            <input
              type="search"
              placeholder="Buscar producto equivalente…"
              value={equivalenteSel ? `${equivalenteSel.sku} — ${equivalenteSel.nombre}` : busquedaEq}
              onChange={(e) => { setBusquedaEq(e.target.value); setEquivalenteSel(null) }}
              autoComplete="off"
            />
          </div>
        )}

        {equivalenteActivo && !equivalenteSel && busquedaEq.trim() && (
          <div className="ing-productos-lista">
            {buscandoEq && <p className="cargando">Buscando…</p>}
            {!buscandoEq && opcionesEq.length === 0 && <p className="picking-nombre">Sin resultados</p>}
            {!buscandoEq && opcionesEq.map((p) => (
              <button key={p.id} type="button" className="ing-prod-fila" onClick={() => setEquivalenteSel(p)}>
                <span>{p.sku} — {p.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pm-confirmar-acciones">
        <button className="btn-secundario pm-confirmar-btn" disabled={confirmarSubtarea.isPending} onClick={handleSinStock}>
          Sin stock
        </button>
        <button className="btn-primario pm-confirmar-btn" disabled={confirmarSubtarea.isPending} onClick={handleConfirmarDespacho}>
          {confirmarSubtarea.isPending ? 'Confirmando…' : 'Confirmar despacho'}
        </button>
      </div>
    </div>
  )
}
