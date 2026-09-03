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
  const codigoBarra = item?.codigo_barra?.trim() || null
  const lpn         = item?.lpn ?? null

  const [lpnConfirmado, setLpnConfirmado]       = useState<string | null>(null)

  const [barcode, setBarcode]                   = useState('')
  const [barcodeOk, setBarcodeOk]               = useState(false)
  const [sinStockMode, setSinStockMode]         = useState(false)
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
    // Solo omitir escaneo si el producto tiene item cargado y no tiene código de barras
    if (item && !item.codigo_barra) {
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

  const [validandoBarcode, setValidandoBarcode] = useState(false)

  async function handleValidarBarcode(val: string) {
    if (!val.trim()) return
    // Sin item cargado o sin código de barras: cualquier scan confirma
    if (!item || !item.codigo_barra) { setBarcodeOk(true); setError(null); return }
    // Normalizar ceros iniciales: el Excel puede perder el cero del EAN13 al tratarlo como número
    const normalizar = (s: string) => s.replace(/^0+/, '')
    const ok = normalizar(val.trim()) === normalizar(item.codigo_barra)
    if (ok) { setBarcodeOk(true); setError(null) }
    else setError('Código de barras incorrecto. Escanea el producto correcto.')
  }

  function handleBarcodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '')
    setBarcode(val)
    setBarcodeOk(false)
    setError(null)
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleValidarBarcode(barcode)
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
        {!barcodeOk && !sinStockMode && (
          <>
            {/* Botón Sin stock — encima del escaneo */}
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', marginBottom: 'var(--spacing-sm)', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.4)' }}
              onClick={() => { setSinStockMode(true); setError(null) }}
            >
              Sin stock
            </button>

            <label className="pm-confirmar-label">
              {validandoBarcode ? 'Validando…' : codigoBarra ? 'Escanear código de barras' : 'Escanear producto'}
              <div className="pm-confirmar-barcode-row">
                <input
                  ref={barcodeRef}
                  type="text"
                  inputMode="numeric"
                  className={`pm-confirmar-input ${error && !barcodeOk ? 'pm-confirmar-input--error' : ''}`}
                  placeholder="Escanea o ingresa el código…"
                  value={barcode}
                  onChange={handleBarcodeChange}
                  onKeyDown={handleBarcodeKeyDown}
                  autoComplete="off"
                  disabled={validandoBarcode}
                />
                <BarcodeScanner
                  title="Escanear con cámara"
                  onDetected={(codigo) => { setBarcode(codigo); handleValidarBarcode(codigo) }}
                />
              </div>
              <button
                type="button"
                className="btn-primario"
                style={{ marginTop: 'var(--spacing-xs)' }}
                disabled={!barcode.trim() || validandoBarcode}
                onClick={() => handleValidarBarcode(barcode)}
              >
                {validandoBarcode ? 'Validando…' : 'Verificar'}
              </button>
            </label>
          </>
        )}

        {/* Modo sin stock: solo pide motivo */}
        {sinStockMode && (
          <>
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
              Sin stock — se registrará como 0 unidades despachadas
            </div>
            <label className="pm-confirmar-label">
              Motivo (obligatorio)
              <textarea
                className="pm-confirmar-textarea"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de falta de stock…"
                autoFocus
              />
            </label>
          </>
        )}

        {/* Cantidad — visible solo si barcode está ok */}
        {barcodeOk && (
          <>
            <div className="pm-confirmar-barcode-ok">
              Producto escaneado correctamente
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
              <div className="ing-productos-lista pm-equivalente-lista">
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

      {sinStockMode && (
        <div className="pm-confirmar-acciones">
          <button className="btn-secundario pm-confirmar-btn" disabled={isPending} onClick={() => { setSinStockMode(false); setMotivo(''); setError(null) }}>
            Cancelar
          </button>
          <button
            className="pm-confirmar-btn"
            style={{ flex: 1, padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}
            disabled={isPending || !motivo.trim()}
            onClick={handleSinStock}
          >
            {isPending ? 'Registrando…' : 'Confirmar sin stock'}
          </button>
        </div>
      )}

      {barcodeOk && !sinStockMode && (
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
