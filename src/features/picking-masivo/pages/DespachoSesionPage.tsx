import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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

type ItemValidadoSodimac = ItemPendienteSodimac & { estado: string }

type LpnDetalle = { codigo: string; tienda: string; cantidad: number }
type LpnEntry   = { lpn: string; totalEmpaque: number; items: LpnDetalle[] }

// Fase Sodimac: validar productos → cargar Excel LPN → validar LPNs → despachar
type FaseSodimac = 'productos' | 'lpns'

export function DespachoSesionPage() {
  const { id }          = useParams<{ id: string }>()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const sesionId        = id ?? ''
  const adminId         = localStorage.getItem('user_id') ?? ''
  const iniciarEnLpns   = searchParams.get('fase') === 'lpns'

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
  const [faseSodimac, setFaseSodimac]               = useState<FaseSodimac>(iniciarEnLpns ? 'lpns' : 'productos')
  const [mostrarCargarLpn, setMostrarCargarLpn]     = useState(false)
  const [lpnsExcel, setLpnsExcel]                   = useState<LpnEntry[]>(() => {
    try {
      const stored = localStorage.getItem(`pm_lpn_${sesionId}`)
      return stored ? (JSON.parse(stored) as LpnEntry[]) : []
    } catch { return [] }
  })
  const [lpnsEscaneados, setLpnsEscaneados]         = useState<Set<string>>(new Set())
  const [lpnScanInput, setLpnScanInput]             = useState('')
  const [lpnPendiente, setLpnPendiente]             = useState<LpnEntry | null>(null)
  const [lpnDetalleAbierto, setLpnDetalleAbierto]  = useState(false)
  const [errorLpnScan, setErrorLpnScan]             = useState<string | null>(null)
  const [errorExcel, setErrorExcel]                 = useState<string | null>(null)

  const [filtroPendientes, setFiltroPendientes]     = useState(false)
  const [filtroEstadoDespacho, setFiltroEstadoDespacho] = useState<'todos' | 'parcial' | 'sin_stock'>('todos')
  const [productoExpandido, setProductoExpandido]  = useState<string | null>(null)
  const [busquedaSodimac, setBusquedaSodimac]       = useState('')

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
          const estado = despachada === 0 ? 'sin_stock' : despachada < i.cantidad_pedida ? 'parcial' : 'completado'
          return {
            itemId:             i.id,
            codigo:             i.codigo,
            descripcion:        i.descripcion,
            cantidadPedida:     i.cantidad_pedida,
            cantidadDespachada: despachada,
            tienda:             i.tienda ?? null,
            estado,
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
          : [{ ...itemPendienteSodimac, estado: itemPendienteSodimac.cantidadDespachada === 0 ? 'sin_stock' : itemPendienteSodimac.cantidadDespachada < itemPendienteSodimac.cantidadPedida ? 'parcial' : 'completado' }, ...prev]
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
        const wb   = XLSX.read(data, { type: 'array', cellText: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false }) as (string | null)[][]

        // Formato Sodimac: filas "Total XXXXX" marcan el fin de cada LPN
        // Col 0: LPN (solo en la primera fila del grupo), "Total XXXXX" al final, null en filas intermedias
        // Col 1: Código, Col 2: Tienda, Col 3: Cantidad de Empaques
        const lpnMap = new Map<string, LpnEntry>()
        let currentLpn: string | null = null

        for (const row of raw.slice(1)) {
          const col0 = String(row[0] ?? '').trim()
          const col1 = String(row[1] ?? '').trim()
          const col2 = String(row[2] ?? '').trim()
          const col3 = String(row[3] ?? '').trim()
          if (!col0 && !col1) continue

          if (col0.startsWith('Total ')) {
            // Fila de total: actualiza cantidadEmpaque del LPN actual
            const totalLpn = col0.replace('Total ', '').trim()
            const entry = lpnMap.get(totalLpn)
            if (entry) entry.totalEmpaque = parseInt(col3, 10) || 0
            currentLpn = null
          } else if (col0 && /^\d+$/.test(col0)) {
            // Fila nueva con número de LPN
            currentLpn = col0
            if (!lpnMap.has(currentLpn)) {
              lpnMap.set(currentLpn, { lpn: currentLpn, totalEmpaque: 0, items: [] })
            }
            if (col1) {
              lpnMap.get(currentLpn)!.items.push({
                codigo: col1, tienda: col2, cantidad: parseInt(col3, 10) || 0
              })
            }
          } else if (!col0 && col1 && currentLpn) {
            // Fila de detalle (LPN vacío = continuación del anterior)
            lpnMap.get(currentLpn)!.items.push({
              codigo: col1, tienda: col2, cantidad: parseInt(col3, 10) || 0
            })
          }
        }

        const entradas = [...lpnMap.values()]
        if (entradas.length === 0) { setErrorExcel('El archivo no contiene LPNs válidos'); return }
        try { localStorage.setItem(`pm_lpn_${sesionId}`, JSON.stringify(entradas)) } catch {}
        setLpnsExcel(entradas)
        setLpnsEscaneados(new Set())
        setLpnPendiente(null)
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
    if (lpnsExcel.length === 0) {
      setErrorLpnScan('No hay Excel cargado. Carga el archivo Excel de LPNs primero.')
      setLpnScanInput('')
      setTimeout(() => lpnInputRef.current?.focus(), 50)
      return
    }
    const entry = lpnsExcel.find((e) => lpnTrimmed === e.lpn || lpnTrimmed.endsWith(e.lpn))
    if (!entry) {
      setErrorLpnScan(`LPN "${lpnTrimmed}" no encontrado en el Excel (${lpnsExcel.length} LPNs cargados)`)
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
    setLpnPendiente(entry)
    setLpnDetalleAbierto(false)
    setLpnScanInput('')
  }

  function handleConfirmarLpnSodimac() {
    if (!lpnPendiente) return
    setLpnsEscaneados((prev) => new Set([...prev, lpnPendiente.lpn]))
    setLpnPendiente(null)
    setTimeout(() => lpnInputRef.current?.focus(), 50)
  }

  async function handleDespachar() {
    if (!nombreChofer.trim()) return
    setErrorDespacho(null)
    try {
      await despacharSesion.mutateAsync({ sesionId, usuarioId: adminId, nombreChofer: nombreChofer.trim() })
      try { localStorage.removeItem(`pm_lpn_${sesionId}`) } catch {}
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
  const totalLpns          = lpnsExcel.length
  const lpnsValidadosN     = lpnsEscaneados.size
  const todosLpnsValidados = totalLpns > 0 && lpnsValidadosN >= totalLpns

  return (
    <div className="notas-page pm-despacho-page">
      <div className="pm-despacho-header">
        <button className="btn-volver" onClick={() => navigate(`/picking-masivo/${sesionId}`)}>← Volver</button>
        <div className="pm-despacho-titulo-wrap" style={{ fontSize: '1.75rem' }}>
          <span className="pm-despacho-titulo-cliente">{sesion.nombre_cliente ?? sesion.numero_oc}</span>
          <span className="pm-despacho-titulo-sep">—</span>
          <span className="pm-despacho-titulo-label">{faseSodimac === 'lpns' ? 'Validación de Carga' : 'Validación de Preparación'}</span>
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

      {/* Botón Confirmar Preparación arriba — Sodimac fase 1 */}
      {!sesionTieneLpn && faseSodimac === 'productos' && todosProductosValidados && sesion.estado === 'completada' && (
        <button
          className="btn-primario pm-despacho-despachar-btn"
          onClick={() => navigate(`/picking-masivo/${sesionId}`)}
        >
          Confirmar Preparación
        </button>
      )}

      {/* Lista de productos validados (fase 1) */}
      {(!sesionTieneLpn ? faseSodimac === 'productos' : true) && (validados.length > 0 || (items && items.length > 0)) && (
        <div className="pm-despacho-validados-card">
          {/* Fila 1: Validados / Pendientes + contador */}
          {!sesionTieneLpn && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" style={{ padding: '4px 14px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '999px', border: '1px solid var(--border)', cursor: 'pointer', background: !filtroPendientes ? 'var(--accent)' : 'transparent', color: !filtroPendientes ? 'white' : 'var(--text-secondary)' }} onClick={() => setFiltroPendientes(false)}>Validados</button>
                <button type="button" style={{ padding: '4px 14px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '999px', border: '1px solid var(--border)', cursor: 'pointer', background: filtroPendientes ? 'var(--warning)' : 'transparent', color: filtroPendientes ? '#000' : 'var(--text-secondary)' }} onClick={() => setFiltroPendientes(true)}>Pendientes</button>
              </div>
              <span className="pm-despacho-validados-ratio">{totalValidados}/{totalItems}</span>
            </div>
          )}
          {/* Fila 2: búsqueda + Todos/Parcial/Sin stock (solo validados Sodimac) */}
          {!sesionTieneLpn && !filtroPendientes && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="search"
                placeholder="Buscar por código o nombre…"
                value={busquedaSodimac}
                onChange={(e) => setBusquedaSodimac(e.target.value)}
                style={{ flex: 1, minWidth: '160px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}
              />
              {(['todos', 'parcial', 'sin_stock'] as const).map((f) => (
                <button key={f} type="button"
                  onClick={() => setFiltroEstadoDespacho(f)}
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '0.5rem', border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: filtroEstadoDespacho === f ? (f === 'parcial' ? 'var(--warning)' : f === 'sin_stock' ? 'var(--danger)' : 'var(--primary)') : 'var(--surface)',
                    color: filtroEstadoDespacho === f ? (f === 'todos' ? 'white' : '#000') : 'var(--text-secondary)',
                  }}
                >{f === 'todos' ? 'Todos' : f === 'parcial' ? 'Parcial' : 'Sin stock'}</button>
              ))}
            </div>
          )}
          {/* Título de sección */}
          <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {filtroPendientes ? 'Pendientes de validar' : `Productos Validados (${validados.length})`}
          </p>
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
              : filtroPendientes
              ? (items ?? [])
                  .filter((i) => !validadosSodimac.some((v) => v.itemId === i.id))
                  .map((i) => {
                    const despachada = (i.subtareas_picking_masivo ?? []).reduce((s, t) => s + (t.cantidad_despachada ?? 0), 0)
                    return (
                      <div key={i.id} className="pm-item-card pm-despacho-validado-fila">
                        <div className="pm-despacho-validado-info">
                          <span className="pm-despacho-validado-codigo">{i.codigo}</span>
                          <span className="pm-despacho-validado-desc">{i.descripcion}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span className="pm-despacho-validado-cant" style={{ color: 'var(--text-muted)' }}>{despachada}/{i.cantidad_pedida}</span>
                        </div>
                      </div>
                    )
                  })
              : validadosSodimac
                  .filter((v) => {
                    const q = busquedaSodimac.trim().toLowerCase()
                    const matchQ = !q || v.codigo.toLowerCase().includes(q) || v.descripcion.toLowerCase().includes(q)
                    const matchE = filtroEstadoDespacho === 'todos' || v.estado === filtroEstadoDespacho
                    return matchQ && matchE
                  })
                  .map((v) => {
                    const expandido = productoExpandido === v.itemId
                    const ESTADO_LABELS: Record<string, string> = { completado: 'Completado', parcial: 'Parcial', sin_stock: 'Sin stock' }
                    return (
                      <div key={v.itemId} className="ing-prod-item pm-item-card">
                        <div
                          className="ing-prod-fila pm-item-header"
                          role="button" tabIndex={0}
                          onClick={() => setProductoExpandido(expandido ? null : v.itemId)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setProductoExpandido(expandido ? null : v.itemId)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span className="ing-prod-nombre">{v.descripcion || v.codigo}</span>
                            <span className="ing-prod-sku">{v.codigo}</span>
                          </div>
                          <div className="ing-prod-fila-derecha" style={{ gap: '0.5rem' }}>
                            <span className={`badge badge-${v.estado.replace(/_/g, '-')}`}>{ESTADO_LABELS[v.estado] ?? v.estado}</span>
                            <span className="pm-item-chevron">{expandido ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {expandido && (
                          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(103, 207, 232, 0.15)', border: '1px solid rgba(103, 207, 232, 0.35)', display: 'flex', gap: 'var(--spacing-lg)', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: '0.68rem', color: '#67cfe8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Solicitado OC</span>
                              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{v.cantidadPedida}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: '0.68rem', color: '#67cfe8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Enviado</span>
                              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: v.cantidadDespachada < v.cantidadPedida ? 'var(--warning)' : 'var(--success)' }}>{v.cantidadDespachada}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
            }
          </div>
        </div>
      )}

      {sesion.estado === 'despachado' && (
        <div className="pm-despacho-completado">OC despachada</div>
      )}

      {/* Botón Despachar Carga (Imperial únicamente) */}
      {sesionTieneLpn && todosProductosValidados && sesion.estado === 'completada' && !mostrarChofer && (
        <button className="btn-primario pm-despacho-despachar-btn" onClick={() => setMostrarChofer(true)}>
          Despachar Carga
        </button>
      )}

      {/* ── FASE 2 (Sodimac): escáner LPN ── */}
      {!sesionTieneLpn && faseSodimac === 'lpns' && sesion.estado === 'completada' && (
        <>
          <div className="pm-despacho-scanner-card">
            <div className="pm-despacho-fase-label" style={{ color: 'white' }}>Validación de LPN</div>
            {lpnsExcel.length === 0 && (
              <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid var(--warning)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
                ⚠️ No hay Excel cargado. Carga el archivo de LPNs desde la pantalla de detalle (botón "Validar LPN →").
              </div>
            )}
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
              {lpnsExcel.map((entry) => {
                const validado = lpnsEscaneados.has(entry.lpn)
                return (
                  <div key={entry.lpn} className={`pm-item-card pm-despacho-validado-fila${validado ? '' : ' pm-despacho-lpn-pendiente'}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span className="pm-despacho-validado-codigo" style={{ fontFamily: 'monospace' }}>{entry.lpn}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.totalEmpaque} empaque{entry.totalEmpaque !== 1 ? 's' : ''}</span>
                    </div>
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

      {/* Modal confirmación LPN escaneado (Sodimac fase 2) */}
      {lpnPendiente && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setLpnPendiente(null)}
        >
          <div
            className="modal-box pm-despacho-modal"
            style={{ background: 'var(--bg-card, #1e2229)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', minWidth: '300px', maxWidth: '90vw', width: '360px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">LPN Escaneado</h3>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">LPN</span>
              <span className="pm-despacho-modal-valor" style={{ fontFamily: 'monospace', color: 'var(--accent-green)' }}>{lpnPendiente.lpn}</span>
            </div>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cantidad de empaques</span>
              <span className="pm-despacho-modal-valor" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>{lpnPendiente.totalEmpaque}</span>
            </div>

            {/* Botón Ver detalle */}
            <button
              type="button"
              style={{ width: '100%', marginTop: 'var(--spacing-sm)', padding: '0.5rem 1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setLpnDetalleAbierto((p) => !p)}
            >
              <span>Ver detalle ({lpnPendiente.items.length} código{lpnPendiente.items.length !== 1 ? 's' : ''})</span>
              <span style={{ fontSize: '0.65rem' }}>{lpnDetalleAbierto ? '▲' : '▼'}</span>
            </button>

            {lpnDetalleAbierto && (
              <div style={{ marginTop: 'var(--spacing-xs)', maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                {lpnPendiente.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', borderBottom: idx < lpnPendiente.items.length - 1 ? '1px solid var(--border)' : 'none', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--accent-green)' }}>{it.codigo}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{it.tienda}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{it.cantidad} u.</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pm-confirmar-acciones" style={{ marginTop: 'var(--spacing-md)' }}>
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setLpnPendiente(null)}>
                Cancelar
              </button>
              <button className="btn-primario pm-confirmar-btn" onClick={handleConfirmarLpnSodimac}>
                Confirmar LPN
              </button>
            </div>
          </div>
        </div>
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
