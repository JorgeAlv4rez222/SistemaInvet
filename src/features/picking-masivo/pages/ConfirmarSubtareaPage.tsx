import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useColaSubtareas, useConfirmarSubtarea, useEditarParcial } from '../hooks/usePickingMasivo'
import { productosApi } from '../../productos/services/productos.api'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import { onlyNumbersKeyDown, onlyNumbersPaste } from '../../../shared/utils/numericInput'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'
import type { ProductoConUbicacion } from '../../productos/services/productos.api'

export function ConfirmarSubtareaPage() {
  const { id: sesionId, subtareaId } = useParams<{ id: string; subtareaId: string }>()
  const navigate    = useNavigate()
  const operadorId  = localStorage.getItem('user_id') ?? ''

  const { data, isLoading } = useColaSubtareas(sesionId ?? null)
  const confirmarSubtarea   = useConfirmarSubtarea(sesionId ?? '')
  const editarParcial       = useEditarParcial(sesionId ?? '')

  // La cola incluye libre+bloqueado; para editar parciales los buscamos en sesion detail
  // La cola ya los incluye si volvemos a la misma subtarea en estado parcial tras reingreso.
  // Buscamos en la cola completa (incluye bloqueado del mismo operador)
  const subtarea = (data ?? []).find((s) => s.id === subtareaId)
  const esParcialEditable = subtarea?.estado === 'parcial' || subtarea?.estado === 'sin_stock'

  const item = subtarea?.items_picking_masivo
  const codigoBarra = item?.codigo_barra ?? null
  const lpn         = item?.lpn ?? null

  const [lpnConfirmado, setLpnConfirmado]       = useState<string | null>(null)

  const [barcode, setBarcode]                   = useState('')
  const [barcodeOk, setBarcodeOk]               = useState(false)
  const [cantidad, setCantidad]                 = useState('')
  const [motivo, setMotivo]                     = useState('')
  const [equivalenteActivo, setEquivalenteActivo] = useState(false)
  const [busquedaEq, setBusquedaEq]             = useState('')
  const [opcionesEq, setOpcionesEq]             = useState<ProductoConUbicacion[]>([])
  const [equivalenteSel, setEquivalenteSel]     = useState<ProductoConUbicacion | null>(null)
  const [buscandoEq, setBuscandoEq]             = useState(false)
  const [error, setError]                       = useState<string | null>(null)

  const barcodeRef = useRef<HTMLInputElement>(null)

  // Pre-cargar cantidad y motivo si es parcial editable
  useEffect(() => {
    if (!subtarea) return
    if (esParcialEditable) {
      setCantidad(String(subtarea.cantidad_despachada ?? ''))
      setMotivo(subtarea.motivo_diferencia ?? '')
    } else {
      setCantidad(String(subtarea.cantidad_asignada))
    }
    // Si el producto no tiene código de barras en catálogo, omitir escaneo
    if (!item?.codigo_barra) {
      setBarcodeOk(true)
    } else {
      setBarcodeOk(false)
      setBarcode('')
      setTimeout(() => barcodeRef.current?.focus(), 100)
    }
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

  function barcodeValido(val: string): boolean {
    if (!val) return false
    const codigoCatalogo = item?.codigo_barra ?? ''
    if (!codigoCatalogo) return true  // sin código de barras en catálogo: cualquier scan confirma
    return val === codigoCatalogo || val.includes(codigoCatalogo) || codigoCatalogo.includes(val)
  }

  function handleBarcodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.trim()
    setBarcode(val)
    if (barcodeValido(val)) { setBarcodeOk(true); setError(null) }
    else setBarcodeOk(false)
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (barcodeValido(barcode)) { setBarcodeOk(true); setError(null) }
      else setError('Código de barras incorrecto. Escanea el producto correcto.')
    }
  }

  // Pantalla post-confirmación: mostrar LPN — va ANTES del check de subtarea
  // porque al confirmar, la cola refresca y subtarea pasa a undefined antes de renderizar esto
  if (lpnConfirmado) {
    return (
      <div className="notas-page pm-lpn-confirmado-page">
        <div className="pm-lpn-confirmado-wrap">
          <div className="pm-lpn-confirmado-check">✓</div>
          <p className="pm-lpn-confirmado-titulo">Producto confirmado</p>
          <p className="pm-lpn-confirmado-label">Etiqueta el bulto con este LPN:</p>
          <div className="pm-lpn-confirmado-codigo">{lpnConfirmado}</div>
          <button
            className="btn-primario pm-lpn-confirmado-btn"
            onClick={() => navigate(`/picking-masivo/operador/${sesionId}`)}
          >
            Siguiente producto
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) return <div className="notas-page"><p className="cargando">Cargando…</p></div>
  if (!subtarea)  return <div className="notas-page"><p className="error">Subtarea no encontrada o ya procesada</p></div>

  const cantAsignada   = subtarea.cantidad_asignada
  const cantNum        = parseInt(cantidad, 10) || 0
  const requiereMotivo = cantNum < cantAsignada

  async function confirmar(cantidadFinal: number, motivoFinal: string | undefined) {
    if (!sesionId) return
    setError(null)
    try {
      if (esParcialEditable) {
        await editarParcial.mutateAsync({
          subtareaId: subtarea!.id,
          usuarioId:  operadorId,
          cantidadDespachada: cantidadFinal,
          motivo:     motivoFinal,
        })
      } else {
        await confirmarSubtarea.mutateAsync({
          subtareaId:         subtarea!.id,
          usuarioId:          operadorId,
          cantidadDespachada: cantidadFinal,
          motivo:             motivoFinal,
          productoRealId:     equivalenteSel?.id,
        })
      }
      // Si el ítem tiene LPN, mostrar pantalla de confirmación con LPN antes de volver
      if (lpn && cantidadFinal > 0) {
        setLpnConfirmado(lpn)
      } else {
        navigate(`/picking-masivo/operador/${sesionId}`)
      }
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al confirmar la subtarea')
    }
  }

  function handleConfirmarDespacho() {
    if (!barcodeOk) { setError('Escanea el producto primero'); return }
    if (cantNum <= 0)              { setError('Ingresa una cantidad válida'); return }
    if (cantNum > cantAsignada)    { setError(`No puedes despachar más de lo asignado (${cantAsignada})`); return }
    if (cantNum < cantAsignada && !motivo.trim()) { setError('El motivo es obligatorio para despacho parcial'); return }
    confirmar(cantNum, cantNum < cantAsignada ? motivo.trim() : undefined)
  }

  function handleSinStock() {
    if (!barcodeOk) { setError('Escanea el producto primero'); return }
    if (!motivo.trim()) { setError('Indica el motivo de la falta de stock'); return }
    confirmar(0, motivo.trim())
  }

  const isPending = confirmarSubtarea.isPending || editarParcial.isPending

  return (
    <div className="notas-page pm-confirmar-page">
      <button className="btn-volver" style={{ marginBottom: 'var(--spacing-sm)' }} onClick={() => navigate(`/picking-masivo/operador/${sesionId}`)}>
        ← Volver
      </button>
      <div className="pm-confirmar-header">
        {subtarea.posicion_codigo === '—'
          ? <span className="pm-confirmar-barra-acento" />
          : <span className="pm-confirmar-pos">{subtarea.posicion_codigo}</span>
        }
        <span className="pm-confirmar-prod">
          {equivalenteSel
            ? `${equivalenteSel.sku}${equivalenteSel.nombre && equivalenteSel.nombre !== equivalenteSel.sku ? ` — ${equivalenteSel.nombre}` : ''}`
            : `${item?.codigo ?? ''}${item?.descripcion && item.descripcion !== item.codigo ? ` — ${item.descripcion}` : ''}`
          }
        </span>
        <span className="pm-confirmar-cant">Solicitado: {cantAsignada}</span>
        {lpn && (
          <span className="pm-confirmar-lpn">LPN: <strong>{lpn}</strong></span>
        )}
        {esParcialEditable && (
          <span className="badge badge-parcial">Editando parcial</span>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="pm-confirmar-form">
        {!barcodeOk && (
          <label className="pm-confirmar-label">
            {codigoBarra ? 'Escanear código de barras' : 'Escanear producto'}
            <div className="pm-confirmar-barcode-row">
              <input
                ref={barcodeRef}
                type="text"
                className={`pm-confirmar-input ${barcode && !barcodeValido(barcode) ? 'pm-confirmar-input--error' : ''}`}
                placeholder="Escanea o ingresa el código…"
                value={barcode}
                onChange={handleBarcodeChange}
                onKeyDown={handleBarcodeKeyDown}
                autoComplete="off"
              />
              <BarcodeScanner
                title="Escanear con cámara"
                onDetected={(codigo) => {
                  setBarcode(codigo)
                  if (barcodeValido(codigo)) { setBarcodeOk(true); setError(null) }
                  else { setError('Código de barras incorrecto. Escanea el producto correcto.') }
                }}
              />
            </div>
            {barcode && !barcodeValido(barcode) && (
              <span className="pm-confirmar-barcode-error">Código incorrecto</span>
            )}
          </label>
        )}

        {/* Cantidad — visible solo si barcode está ok */}
        {barcodeOk && (
          <>
            <div className="pm-confirmar-barcode-ok">
              ✓ Producto escaneado correctamente
            </div>

            <label className="pm-confirmar-label">
              Ingrese cantidad:
              <input
                type="number"
                className="pm-confirmar-input"
                min={0}
                max={cantAsignada}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                onKeyDown={onlyNumbersKeyDown}
                onPaste={onlyNumbersPaste}
                autoFocus
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

            {!esParcialEditable && item?.codigo?.includes('-') && (
              <button
                type="button"
                className={`filtro-btn pm-confirmar-toggle-btn ${equivalenteActivo ? 'activo' : ''}`}
                onClick={() => { setEquivalenteActivo((v) => !v); setEquivalenteSel(null); setBusquedaEq('') }}
              >
                Producto equivalente
              </button>
            )}


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
          </>
        )}
      </div>

      {barcodeOk && (
        <div className="pm-confirmar-acciones">
          <button className="btn-secundario pm-confirmar-btn" disabled={isPending} onClick={handleSinStock}>
            Sin stock
          </button>
          <button className="btn-primario pm-confirmar-btn" disabled={isPending} onClick={handleConfirmarDespacho}>
            {isPending ? 'Confirmando…' : esParcialEditable ? 'Guardar cambio' : 'Confirmar'}
          </button>
        </div>
      )}
    </div>
  )
}
