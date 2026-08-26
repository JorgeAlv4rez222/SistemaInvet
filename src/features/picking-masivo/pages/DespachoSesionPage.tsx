import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useSesionPicking, useBuscarLpn, useValidarLpn, useBuscarItem, useValidarItem, useDespacharSesion } from '../hooks/usePickingMasivo'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'

type ItemPendienteLpn = {
  itemId:         string
  codigo:         string
  descripcion:    string
  cantidadPedida: number
  tienda:         string | null
  lpn:            string
}

type ItemValidadoLpn = ItemPendienteLpn

type ItemPendienteSodimac = {
  itemId:             string
  codigo:             string
  descripcion:        string
  cantidadPedida:     number
  cantidadDespachada: number
  tienda:             string | null
}

type ItemValidadoSodimac = ItemPendienteSodimac

// Fase Sodimac: validar productos → cargar Excel LPN → validar LPNs → despachar
type FaseSodimac = 'productos' | 'lpns'

export function DespachoSesionPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const sesionId   = id ?? ''
  const adminId    = localStorage.getItem('user_id') ?? ''

  const { data: sesion, isLoading } = useSesionPicking(sesionId || null)

  // LPN flow (Imperial)
  const buscarLpn       = useBuscarLpn()
  const validarLpn      = useValidarLpn(sesionId)

  // Barcode flow (Sodimac)
  const buscarItem      = useBuscarItem()
  const validarItem     = useValidarItem(sesionId)

  const despacharSesion = useDespacharSesion()

  const [scanInput, setScanInput]                   = useState('')
  const [itemPendienteLpn, setItemPendienteLpn]     = useState<ItemPendienteLpn | null>(null)
  const [itemPendienteSodimac, setItemPendienteSodimac] = useState<ItemPendienteSodimac | null>(null)
  const [validadosLpn, setValidadosLpn]             = useState<ItemValidadoLpn[]>([])
  const [validadosSodimac, setValidadosSodimac]     = useState<ItemValidadoSodimac[]>([])
  const [inicializado, setInicializado]             = useState(false)
  const [detalleLpn, setDetalleLpn]                 = useState<ItemValidadoLpn | null>(null)
  const [errorScan, setErrorScan]                   = useState<string | null>(null)
  const [mostrarChofer, setMostrarChofer]           = useState(false)
  const [nombreChofer, setNombreChofer]             = useState('')
  const [errorDespacho, setErrorDespacho]           = useState<string | null>(null)

  // Sodimac fase 2: LPN
  const [faseSodimac, setFaseSodimac]               = useState<FaseSodimac>('productos')
  const [mostrarCargarLpn, setMostrarCargarLpn]     = useState(false)
  const [lpnsExcel, setLpnsExcel]                   = useState<string[]>([])          // LPNs únicos del Excel
  const [lpnsEscaneados, setLpnsEscaneados]         = useState<Set<string>>(new Set())
  const [lpnScanInput, setLpnScanInput]             = useState('')
  const [errorLpnScan, setErrorLpnScan]             = useState<string | null>(null)
  const [errorExcel, setErrorExcel]                 = useState<string | null>(null)

  const inputRef    = useRef<HTMLInputElement>(null)
  const lpnInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Detectar si la sesión usa LPN (Imperial) o no (Sodimac)
  const items = (sesion as any)?.items as Array<{
    id: string; codigo: string; descripcion: string
    cantidad_pedida: number; tienda: string | null
    lpn: string | null; lpn_validado: boolean
    subtareas_picking_masivo?: Array<{ cantidad_despachada: number | null }>
  }> | undefined

  const sesionTieneLpn = items ? items.some((i) => !!i.lpn) : true

  // Inicializar validados desde la BD al cargar la sesión
  useEffect(() => {
    if (!sesion || inicializado || !items) return
    if (sesionTieneLpn) {
      const yaValidados = items
        .filter((i) => i.lpn_validado && i.lpn)
        .map((i) => ({
          itemId:         i.id,
          codigo:         i.codigo,
          descripcion:    i.descripcion,
          cantidadPedida: i.cantidad_pedida,
          tienda:         i.tienda ?? null,
          lpn:            i.lpn!,
        }))
      setValidadosLpn(yaValidados)
    } else {
      const yaValidados = items
        .filter((i) => i.lpn_validado)
        .map((i) => {
          const despachada = (i.subtareas_picking_masivo ?? []).reduce(
            (acc, s) => acc + (s.cantidad_despachada ?? 0), 0
          )
          return {
            itemId:             i.id,
            codigo:             i.codigo,
            descripcion:        i.descripcion,
            cantidadDespachada: despachada,
            tienda:             i.tienda ?? null,
          }
        })
      setValidadosSodimac(yaValidados)
    }
    setInicializado(true)
  }, [sesion, inicializado, items, sesionTieneLpn])

  // ── Handlers LPN (Imperial) ──────────────────────────────────────────────────

  async function handleBuscarLpn(lpn: string) {
    const lpnTrimmed = lpn.trim()
    if (!lpnTrimmed) return
    setErrorScan(null)
    try {
      const res = await buscarLpn.mutateAsync({ sesionId, lpn: lpnTrimmed })
      setItemPendienteLpn({ ...res, lpn: lpnTrimmed })
      setScanInput('')
    } catch (e) {
      setErrorScan(e instanceof ApiResponseError ? e.message : 'LPN no encontrado en esta sesión')
      setScanInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function handleConfirmarLpn() {
    if (!itemPendienteLpn) return
    try {
      await validarLpn.mutateAsync({ sesionId, lpn: itemPendienteLpn.lpn })
      setValidadosLpn((prev) =>
        prev.some((v) => v.itemId === itemPendienteLpn.itemId)
          ? prev
          : [itemPendienteLpn, ...prev]
      )
      setItemPendienteLpn(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (e) {
      setErrorScan(e instanceof ApiResponseError ? e.message : 'Error al confirmar el LPN')
      setItemPendienteLpn(null)
    }
  }

  // ── Handlers Barcode (Sodimac) ───────────────────────────────────────────────

  async function handleBuscarItem(termino: string) {
    const term = termino.trim()
    if (!term) return
    setErrorScan(null)
    try {
      const res = await buscarItem.mutateAsync({ sesionId, termino: term })
      setItemPendienteSodimac(res)
      setScanInput('')
    } catch (e) {
      setErrorScan(e instanceof ApiResponseError ? e.message : 'Producto no encontrado en esta sesión')
      setScanInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function handleConfirmarSodimac() {
    if (!itemPendienteSodimac) return
    try {
      await validarItem.mutateAsync({ sesionId, itemId: itemPendienteSodimac.itemId })
      setValidadosSodimac((prev) =>
        prev.some((v) => v.itemId === itemPendienteSodimac.itemId)
          ? prev
          : [itemPendienteSodimac, ...prev]
      )
      setItemPendienteSodimac(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (e) {
      setErrorScan(e instanceof ApiResponseError ? e.message : 'Error al confirmar el producto')
      setItemPendienteSodimac(null)
    }
  }

  // ── Handlers LPN Excel (Sodimac fase 2) ─────────────────────────────────────

  function handleArchivoExcel(file: File) {
    setErrorExcel(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        // Extraer LPNs únicos — buscar columna "LPN" (case-insensitive)
        const lpnKey = Object.keys(rows[0] ?? {}).find((k) => k.trim().toUpperCase() === 'LPN')
        if (!lpnKey) { setErrorExcel('No se encontró la columna LPN en el archivo'); return }
        const unicos = [...new Set(
          rows.map((r) => String(r[lpnKey] ?? '').trim()).filter(Boolean)
        )]
        if (unicos.length === 0) { setErrorExcel('El archivo no contiene LPNs válidos'); return }
        setLpnsExcel(unicos)
        setLpnsEscaneados(new Set())
        setMostrarCargarLpn(false)
        setFaseSodimac('lpns')
        setTimeout(() => lpnInputRef.current?.focus(), 100)
      } catch {
        setErrorExcel('Error al leer el archivo Excel')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleEscanearLpn(lpn: string) {
    const lpnTrimmed = lpn.trim()
    if (!lpnTrimmed) return
    setErrorLpnScan(null)
    if (!lpnsExcel.includes(lpnTrimmed)) {
      setErrorLpnScan(`LPN "${lpnTrimmed}" no está en la lista de esta OC`)
      setLpnScanInput('')
      setTimeout(() => lpnInputRef.current?.focus(), 50)
      return
    }
    if (lpnsEscaneados.has(lpnTrimmed)) {
      setErrorLpnScan(`LPN "${lpnTrimmed}" ya fue validado`)
      setLpnScanInput('')
      setTimeout(() => lpnInputRef.current?.focus(), 50)
      return
    }
    setLpnsEscaneados((prev) => new Set([...prev, lpnTrimmed]))
    setLpnScanInput('')
    setTimeout(() => lpnInputRef.current?.focus(), 50)
  }

  async function handleDespachar() {
    if (!nombreChofer.trim()) return
    setErrorDespacho(null)
    try {
      await despacharSesion.mutateAsync({ sesionId, usuarioId: adminId, nombreChofer: nombreChofer.trim() })
      navigate('/picking-masivo')
    } catch (e) {
      setErrorDespacho(e instanceof ApiResponseError ? e.message : 'Error al despachar')
    }
  }

  if (isLoading) return <div className="notas-page"><p className="cargando">Cargando…</p></div>
  if (!sesion)   return <div className="notas-page"><p className="error">Sesión no encontrada</p></div>

  if (sesion.estado !== 'completada' && sesion.estado !== 'despachado') {
    return (
      <div className="notas-page">
        <p className="error">La sesión debe estar completada para iniciar el despacho</p>
        <button className="btn-secundario" onClick={() => navigate('/picking-masivo')}>Volver</button>
      </div>
    )
  }

  const totalItems     = sesion.total_items
  const validados      = sesionTieneLpn ? validadosLpn : validadosSodimac
  const totalValidados = validados.length
  const todosProductosValidados = totalValidados >= totalItems
  const isPending      = buscarLpn.isPending || buscarItem.isPending

  // Sodimac fase 2: LPNs
  const totalLpns        = lpnsExcel.length
  const lpnsValidadosN   = lpnsEscaneados.size
  const todosLpnsValidados = totalLpns > 0 && lpnsValidadosN >= totalLpns

  return (
    <div className="notas-page pm-despacho-page">
      <div className="pm-despacho-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>← Volver</button>
        <div className="pm-despacho-titulo-wrap" style={{ fontSize: '1.75rem' }}>
          <span className="pm-despacho-titulo-cliente">{sesion.nombre_cliente ?? sesion.numero_oc}</span>
          <span className="pm-despacho-titulo-sep">—</span>
          <span className="pm-despacho-titulo-label">Validación de Carga</span>
        </div>
      </div>

      {/* ── FASE 1: Escáner productos (LPN o código de barra según cliente) ── */}
      {sesion.estado === 'completada' && (!sesionTieneLpn ? faseSodimac === 'productos' : true) && (
        <div className="pm-despacho-scanner-card">
          <label className="pm-confirmar-label">
            {sesionTieneLpn ? 'Escanear LPN' : 'Escanear código de barra'}
            <div className="pm-confirmar-barcode-row">
              <input
                ref={inputRef}
                type="text"
                className={`pm-confirmar-input ${errorScan ? 'pm-confirmar-input--error' : ''}`}
                placeholder={sesionTieneLpn ? 'Escanea o ingresa el LPN…' : 'Escanea el código de barra o código…'}
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setErrorScan(null) }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  sesionTieneLpn ? handleBuscarLpn(scanInput) : handleBuscarItem(scanInput)
                }}
                autoFocus
                autoComplete="off"
              />
              <BarcodeScanner
                title="Escanear con cámara"
                onDetected={(val) => sesionTieneLpn ? handleBuscarLpn(val) : handleBuscarItem(val)}
              />
            </div>
          </label>
          {errorScan && <p className="pm-confirmar-barcode-error">{errorScan}</p>}
          <button
            className="btn-primario pm-despacho-scan-btn"
            disabled={!scanInput.trim() || isPending}
            onClick={() => sesionTieneLpn ? handleBuscarLpn(scanInput) : handleBuscarItem(scanInput)}
          >
            {isPending ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      )}

      {/* Lista de productos validados (fase 1) */}
      {validados.length > 0 && (!sesionTieneLpn ? faseSodimac === 'productos' : true) && (
        <div className="pm-despacho-validados-card">
          <div className="pm-despacho-validados-header">
            <p className="pm-despacho-validados-titulo">Productos Validados ({validados.length})</p>
            <span className="pm-despacho-validados-ratio">{totalValidados}/{totalItems}</span>
          </div>
          <div className="pm-items-lista">
            {sesionTieneLpn
              ? validadosLpn.map((v) => (
                  <div
                    key={v.itemId}
                    className="pm-item-card pm-despacho-validado-fila pm-despacho-validado-fila--click"
                    onClick={() => setDetalleLpn(v)}
                  >
                    <div className="pm-despacho-validado-info">
                      <span className="pm-despacho-validado-codigo">{v.codigo}</span>
                      {v.tienda && <span className="pm-despacho-validado-tienda">{v.tienda}</span>}
                    </div>
                    <span className="pm-despacho-validado-cant">{v.cantidadPedida}</span>
                    <span className="pm-despacho-validado-check">✓</span>
                  </div>
                ))
              : validadosSodimac.map((v) => (
                  <div key={v.itemId} className="pm-item-card pm-despacho-validado-fila">
                    <div className="pm-despacho-validado-info">
                      <span className="pm-despacho-validado-codigo">{v.codigo}</span>
                      <span className="pm-despacho-validado-desc">{v.descripcion}</span>
                    </div>
                    <span className="pm-despacho-validado-cant">{v.cantidadDespachada}</span>
                    <span className="pm-despacho-validado-check">✓</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {sesion.estado === 'despachado' && (
        <div className="pm-despacho-completado">OC despachada</div>
      )}

      {/* Botón Confirmar Preparación (Sodimac) / Despachar Carga (Imperial) */}
      {todosProductosValidados && sesion.estado === 'completada' && !mostrarChofer && (
        sesionTieneLpn
          ? (
            <button className="btn-primario pm-despacho-despachar-btn" onClick={() => setMostrarChofer(true)}>
              Despachar Carga
            </button>
          ) : faseSodimac === 'productos' ? (
            <button className="btn-primario pm-despacho-despachar-btn" onClick={() => setMostrarCargarLpn(true)}>
              Confirmar Preparación
            </button>
          ) : null
      )}

      {/* ── FASE 2 (Sodimac): escáner LPN ── */}
      {!sesionTieneLpn && faseSodimac === 'lpns' && sesion.estado === 'completada' && (
        <>
          <div className="pm-despacho-scanner-card">
            <div className="pm-despacho-fase-label">Fase 2 — Validación de LPN</div>
            <label className="pm-confirmar-label">
              Escanear LPN
              <div className="pm-confirmar-barcode-row">
                <input
                  ref={lpnInputRef}
                  type="text"
                  className={`pm-confirmar-input ${errorLpnScan ? 'pm-confirmar-input--error' : ''}`}
                  placeholder="Escanea o ingresa el LPN…"
                  value={lpnScanInput}
                  onChange={(e) => { setLpnScanInput(e.target.value); setErrorLpnScan(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleEscanearLpn(lpnScanInput)}
                  autoFocus
                  autoComplete="off"
                />
                <BarcodeScanner title="Escanear con cámara" onDetected={handleEscanearLpn} />
              </div>
            </label>
            {errorLpnScan && <p className="pm-confirmar-barcode-error">{errorLpnScan}</p>}
            <button
              className="btn-primario pm-despacho-scan-btn"
              disabled={!lpnScanInput.trim()}
              onClick={() => handleEscanearLpn(lpnScanInput)}
            >
              Validar
            </button>
          </div>

          {/* Lista LPNs pendientes / validados */}
          <div className="pm-despacho-validados-card">
            <div className="pm-despacho-validados-header">
              <p className="pm-despacho-validados-titulo">LPNs Validados</p>
              <span className="pm-despacho-validados-ratio">{lpnsValidadosN}/{totalLpns}</span>
            </div>
            <div className="pm-items-lista">
              {lpnsExcel.map((lpn) => {
                const validado = lpnsEscaneados.has(lpn)
                return (
                  <div key={lpn} className={`pm-item-card pm-despacho-validado-fila${validado ? '' : ' pm-despacho-lpn-pendiente'}`}>
                    <span className="pm-despacho-validado-codigo" style={{ fontFamily: 'monospace' }}>{lpn}</span>
                    <span className={validado ? 'pm-despacho-validado-check' : 'pm-despacho-lpn-pendiente-icon'}>
                      {validado ? '✓' : '○'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {todosLpnsValidados && (
            <button className="btn-primario pm-despacho-despachar-btn" onClick={() => setMostrarChofer(true)}>
              Despachar Carga
            </button>
          )}
        </>
      )}

      {/* Modal cargar Excel LPN (Sodimac) */}
      {mostrarCargarLpn && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setMostrarCargarLpn(false)}
        >
          <div
            className="modal-box pm-despacho-modal"
            style={{ background: 'var(--bg-card, #1e2229)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', minWidth: '300px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">Cargar Excel de LPN</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
              Sube el archivo Excel con las columnas <strong>LPN, CODIGO, TIENDA, CANTIDAD DE EMPAQUE</strong>.
              El sistema extraerá los LPN únicos para validar.
            </p>
            {errorExcel && <p className="pm-confirmar-barcode-error">{errorExcel}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivoExcel(f) }}
            />
            <div className="pm-confirmar-acciones">
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setMostrarCargarLpn(false)}>
                Cancelar
              </button>
              <button className="btn-primario pm-confirmar-btn" onClick={() => fileInputRef.current?.click()}>
                Seleccionar archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle LPN validado (solo Imperial) */}
      {detalleLpn && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setDetalleLpn(null)}
        >
          <div
            className="modal-box"
            style={{ background: 'var(--bg-card, #1e2229)', border: '3px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', width: '90vw', maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">{detalleLpn.codigo}</h3>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Tienda</span>
              <span className="pm-despacho-modal-valor">{detalleLpn.tienda ?? '—'}</span>
            </div>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cantidad</span>
              <span className="pm-despacho-modal-valor"><strong>{detalleLpn.cantidadPedida}</strong></span>
            </div>
            <div className="pm-despacho-modal-fila" style={{ marginTop: 'var(--spacing-sm)' }}>
              <span className="pm-despacho-modal-label">LPN</span>
              <span className="pm-despacho-modal-valor" style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>{detalleLpn.lpn}</span>
            </div>
            <button className="btn-secundario" style={{ width: '100%', marginTop: 'var(--spacing-md)' }} onClick={() => setDetalleLpn(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal confirmación LPN (Imperial) */}
      {itemPendienteLpn && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setItemPendienteLpn(null)}
        >
          <div
            className="modal-box pm-despacho-modal"
            style={{ background: 'var(--bg-card, #1e2229)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', minWidth: '300px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">Confirmar bulto</h3>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Código</span>
              <span className="pm-despacho-modal-valor">{itemPendienteLpn.codigo}</span>
            </div>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cantidad</span>
              <span className="pm-despacho-modal-valor"><strong>{itemPendienteLpn.cantidadPedida}</strong> uds</span>
            </div>
            {itemPendienteLpn.tienda && (
              <div className="pm-despacho-modal-fila">
                <span className="pm-despacho-modal-label">Tienda</span>
                <span className="pm-despacho-modal-valor">{itemPendienteLpn.tienda}</span>
              </div>
            )}
            <div className="pm-confirmar-acciones" style={{ marginTop: 'var(--spacing-md)' }}>
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setItemPendienteLpn(null)}>
                Volver
              </button>
              <button
                className="btn-primario pm-confirmar-btn"
                disabled={validarLpn.isPending}
                onClick={handleConfirmarLpn}
              >
                {validarLpn.isPending ? 'Confirmando…' : 'Confirmado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación producto (Sodimac) */}
      {itemPendienteSodimac && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setItemPendienteSodimac(null)}
        >
          <div
            className="modal-box pm-despacho-modal"
            style={{ background: 'var(--bg-card, #1e2229)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', minWidth: '300px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">Confirmar producto</h3>
            {itemPendienteSodimac.cantidadDespachada < itemPendienteSodimac.cantidadPedida && (
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ background: 'var(--accent-yellow, #f59e0b)', color: '#000', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', padding: '2px 10px', borderRadius: '999px', textTransform: 'uppercase' }}>
                  Parcial
                </span>
              </div>
            )}
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Código</span>
              <span className="pm-despacho-modal-valor" style={{ fontFamily: 'monospace', color: 'var(--accent-green)' }}>{itemPendienteSodimac.codigo}</span>
            </div>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cant. solicitada</span>
              <span className="pm-despacho-modal-valor" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>
                {itemPendienteSodimac.cantidadPedida}
              </span>
            </div>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cant. despachada</span>
              <span className="pm-despacho-modal-valor" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>
                {itemPendienteSodimac.cantidadDespachada}
              </span>
            </div>
            <div className="pm-confirmar-acciones" style={{ marginTop: 'var(--spacing-md)' }}>
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setItemPendienteSodimac(null)}>
                Volver
              </button>
              <button
                className="btn-primario pm-confirmar-btn"
                disabled={validarItem.isPending}
                onClick={handleConfirmarSodimac}
              >
                {validarItem.isPending ? 'Confirmando…' : 'Confirmado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chofer */}
      {mostrarChofer && (
        <div className="modal-overlay" onClick={() => setMostrarChofer(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">Confirmar despacho</h3>
            <label className="pm-confirmar-label">
              Nombre del chofer <span style={{ color: 'var(--danger)' }}>*</span>
              <input
                type="text"
                className="pm-confirmar-input"
                placeholder="Ej: Juan Pérez"
                value={nombreChofer}
                onChange={(e) => setNombreChofer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && nombreChofer.trim() && handleDespachar()}
                autoFocus
              />
            </label>
            {errorDespacho && <p className="pm-confirmar-barcode-error">{errorDespacho}</p>}
            <div className="pm-confirmar-acciones">
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setMostrarChofer(false)} disabled={despacharSesion.isPending}>
                Cancelar
              </button>
              <button
                className="btn-primario pm-confirmar-btn"
                disabled={!nombreChofer.trim() || despacharSesion.isPending}
                onClick={handleDespachar}
              >
                {despacharSesion.isPending ? 'Despachando…' : 'Confirmar despacho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
