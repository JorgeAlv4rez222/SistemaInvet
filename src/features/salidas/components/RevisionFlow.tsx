import { useState, useRef, useEffect } from 'react'
import { useValidarProducto } from '../hooks/useSalidas'
import { useCambiarEstadoNota, useAnularNota } from '../../notas/hooks/useNotas'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import { onlyNumbersKeyDown, onlyNumbersPaste } from '../../../shared/utils/numericInput'

export type ItemRevision = {
  notaProductoId:          string
  sku:                     string
  nombre:                  string
  codigoBarra:             string
  codigoBarraAlternativo:  string | null
  cantidadSolicitada:      number
  cantidadDespachada:      number
  revisadoAdmin:           boolean
  estado:                  string
  skuEquivalente:          string | null
}

type Paso =
  | { tipo: 'lista' }
  | { tipo: 'escanear_producto'; item: ItemRevision }
  | { tipo: 'codigo_validado'; item: ItemRevision; codigoEscaneado: string }
  | { tipo: 'ingresar_cantidad'; item: ItemRevision; codigoEscaneado: string }
  | { tipo: 'resultado'; mensaje: string; todosRevisados: boolean }

// ── Íconos ────────────────────────────────────────────────────────────────

function IcoCheck({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IcoUser({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IcoDoc({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}
function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function IcoScan({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
  )
}
function IcoClock({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function IcoTruck({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}

function IcoBuilding({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18"/><path d="M9 21V9"/><rect x="12" y="13" width="3" height="3"/><rect x="12" y="17" width="3" height="4"/>
    </svg>
  )
}
function IcoCalendar({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IcoBarcode({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M3 5v14"/><path d="M6 5v14"/><path d="M9 5v14"/><path d="M12 5v14"/><path d="M15 5v14"/><path d="M18 5v14"/><path d="M21 5v14"/>
      <rect x="2" y="4" width="20" height="16" rx="1" strokeWidth={1} strokeDasharray="0"/>
    </svg>
  )
}
function IcoSearch({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function IcoAlert({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

// ── Stepper de auditoría ──────────────────────────────────────────────────

const PASOS_AUDIT = [
  { key: 'picking',   label: 'Picking' },
  { key: 'revision',  label: 'En Revisión' },
  { key: 'despacho',  label: 'Despachada' },
] as const

function StepperAudit({ estadoNota }: { estadoNota: 'completa' | 'revisada' | 'despachada' }) {
  const activo = estadoNota === 'despachada' ? 2 : 1
  return (
    <div className="nd-stepper">
      {PASOS_AUDIT.map((p, i) => {
        const hecho  = i < activo
        const esteEs = i === activo
        return (
          <div key={p.key} className="nd-step-wrap">
            {i > 0 && <div className={`nd-step-line ${hecho ? 'nd-step-line--done' : ''}`} />}
            <div className={`nd-step ${hecho ? 'nd-step--done' : esteEs ? 'nd-step--active' : ''}`}>
              <div className="nd-step-circle">
                {hecho ? <IcoCheck size={10} /> : i + 1}
              </div>
              <span className="nd-step-label">{p.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal chofer ──────────────────────────────────────────────────────────

type ModalChoferProps = {
  notaId:   string
  adminId:  string
  onCerrar: () => void
}

const CHOFERES = ['Darhyng Olea', 'Javier Arancibia', 'Jorge Alvarez', 'Gustavo Bunster', 'Cliente Retira']

function ModalChofer({ notaId, adminId, onCerrar }: ModalChoferProps) {
  const [nombreChofer, setNombreChofer] = useState('')
  const [error, setError]               = useState<string | null>(null)
  const cambiarEstado = useCambiarEstadoNota()

  async function handleConfirmar() {
    setError(null)
    try {
      await cambiarEstado.mutateAsync({ adminId, notaId, nuevoEstado: 'despachada', nombreChofer })
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al marcar para despacho')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-1">Marcar lista para despacho</h3>
        <p className="text-xs text-slate-400 mb-4">Selecciona el chofer</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {CHOFERES.map((chofer) => (
            <button
              key={chofer}
              type="button"
              onClick={() => setNombreChofer(chofer)}
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '8px',
                border: nombreChofer === chofer ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                background: nombreChofer === chofer ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                color: nombreChofer === chofer ? '#38bdf8' : '#e2e8f0',
                fontWeight: nombreChofer === chofer ? 700 : 400,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              {chofer}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
            onClick={onCerrar}
            disabled={cambiarEstado.isPending}
          >
            Cancelar
          </button>
          <button
            className="flex-1 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            disabled={cambiarEstado.isPending || !nombreChofer.trim()}
            onClick={handleConfirmar}
          >
            {cambiarEstado.isPending ? 'Procesando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal anular NV ───────────────────────────────────────────────────────

type ModalAnularProps = {
  notaId:    string
  adminId:   string
  onCerrar:  () => void
  onAnulada: () => void
}

function ModalAnular({ notaId, adminId, onCerrar, onAnulada }: ModalAnularProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const anular = useAnularNota()

  async function handleAnular() {
    setError(null)
    if (!motivo.trim()) { setError('Ingresa un motivo para la anulación'); return }
    try {
      await anular.mutateAsync({ adminId, notaId, motivo: motivo.trim() })
      onAnulada()
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al anular la nota')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-1">Anular Nota de Venta</h3>
        <p className="text-xs text-slate-400 mb-4">Esta acción es irreversible. Ingresa el motivo de anulación.</p>
        <textarea
          className="rv-anular-textarea"
          rows={4}
          placeholder="Motivo de anulación…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          autoFocus
        />
        {error && <p className="text-red-400 text-xs mb-3 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
            onClick={onCerrar}
            disabled={anular.isPending}
          >
            Cancelar
          </button>
          <button
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            disabled={anular.isPending || !motivo.trim()}
            onClick={handleAnular}
          >
            {anular.isPending ? 'Anulando…' : 'Confirmar anulación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d    = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const h    = d.getHours()
  const min  = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = String(h % 12 || 12).padStart(2, '0')
  return `${dd}-${mm}-${yyyy} // ${h12}:${min} ${ampm}`
}

interface Props {
  notaId:              string
  numeroNota:          string
  nombreCliente:       string
  rutCliente?:         string | null
  numeroOc?:           string | null
  comentarioDespacho?: string | null
  adminId:             string
  items:               ItemRevision[]
  estadoNota:          'completa' | 'revisada' | 'despachada'
  nombreChofer:        string | null
  fechaPreparacion?:   string | null
  fechaDespacho?:      string | null
  tieneDev?:           boolean
  devolucion?:         { items: { sku: string; nombre: string; cantidad: number }[] } | null
  offline:             boolean
  onCerrar:            () => void
}

// ── Componente principal ──────────────────────────────────────────────────

export function RevisionFlow({
  notaId, numeroNota, nombreCliente, rutCliente, numeroOc,
  comentarioDespacho, adminId, items, estadoNota, nombreChofer,
  fechaPreparacion, fechaDespacho, tieneDev, devolucion, offline, onCerrar,
}: Props) {
  const yaDespachada = estadoNota === 'despachada'
  const rolUsuario   = localStorage.getItem('user_rol') ?? ''
  const esAdmin      = rolUsuario === 'admin' || rolUsuario === 'supervisor'

  const [paso, setPaso]           = useState<Paso>({ tipo: 'lista' })
  const [cantidad, setCantidad]   = useState('')
  const [scanInput, setScanInput] = useState('')
  const [scanError, setScanError] = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [revisadoEnSesion, setRevisadoEnSesion] = useState(false)
  const [mostrarModalChofer, setMostrarModalChofer] = useState(false)
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false)
  const [expandidos, setExpandidos]   = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda]       = useState('')
  const [escaneadosOk, setEscaneadosOk]         = useState<Set<string>>(new Set())
  const [itemEscaneando, setItemEscaneando]     = useState<string | null>(null)
  const [scanErrorInline, setScanErrorInline]   = useState('')
  const [confirmandoId, setConfirmandoId]       = useState<string | null>(null)
  const [cantidadesEdit, setCantidadesEdit]     = useState<Record<string, string>>({})
  const [destacadoId, setDestacadoId]           = useState<string | null>(null)

  function toggleExpandido(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const scanRef     = useRef<HTMLInputElement>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)
  const validar     = useValidarProducto()

  const totalItems     = items.length
  const itemsRevisados = items.filter((i) => i.revisadoAdmin).length
  const todosRevisados = revisadoEnSesion || (items.length > 0 && items.every((i) => i.revisadoAdmin))
  const pctGlobal      = totalItems > 0 ? Math.round((itemsRevisados / totalItems) * 100) : 0

  useEffect(() => {
    if (paso.tipo === 'escanear_producto') scanRef.current?.focus()
    if (paso.tipo === 'ingresar_cantidad') cantidadRef.current?.focus()
  }, [paso])

  function handleSeleccionarItem(item: ItemRevision) {
    if (item.revisadoAdmin) return
    setError(null)
    setCantidad('')
    setScanInput('')
    setScanError('')
    setPaso({ tipo: 'escanear_producto', item })
  }

  function handleEscanearProducto(codigo: string) {
    if (!codigo.trim() || paso.tipo !== 'escanear_producto') return
    const normalizar = (s: string) => s.replace(/^0+/, '')
    const escaneado  = normalizar(codigo.trim())
    const cbEsperado = paso.item.codigoBarra
    const cbOk  = cbEsperado ? normalizar(cbEsperado) === escaneado : true
    const altOk = paso.item.codigoBarraAlternativo ? normalizar(paso.item.codigoBarraAlternativo) === escaneado : false
    if (cbEsperado && !cbOk && !altOk) {
      const skuEsperado = paso.item.skuEquivalente ?? paso.item.sku
      setScanError(`Producto incorrecto. Escanea el código de: ${skuEsperado}`)
      setScanInput('')
      setTimeout(() => setScanError(''), 4000)
      scanRef.current?.focus()
      return
    }
    setScanError('')
    setScanInput('')
    setCantidad('')
    setError(null)
    setPaso({ tipo: 'codigo_validado', item: paso.item, codigoEscaneado: codigo.trim() })
  }

  async function handleConfirmarCantidad() {
    if (paso.tipo !== 'ingresar_cantidad') return
    const cant = parseInt(cantidad, 10)
    if (isNaN(cant) || cant <= 0) { setError('Ingresa una cantidad válida'); return }
    if (cant !== paso.item.cantidadDespachada) { setError('Cantidad no coincide con lo despachado'); return }
    setError(null)
    try {
      const resultado = await validar.mutateAsync({
        adminId,
        notaProductoId:    paso.item.notaProductoId,
        codigoProducto:    paso.codigoEscaneado,
        cantidadIngresada: cant,
      })
      if (resultado.todosRevisados) setRevisadoEnSesion(true)
      setPaso({ tipo: 'resultado', mensaje: resultado.mensaje, todosRevisados: resultado.todosRevisados })
    } catch (e) {
      const msg = e instanceof ApiResponseError ? e.message : 'Error al validar'
      setError(msg)
      if (e instanceof ApiResponseError && e.code === 'INVALID_PRODUCTO') {
        setPaso({ tipo: 'escanear_producto', item: paso.item })
        setScanInput('')
        scanRef.current?.focus()
      }
    }
  }

  // ── Inline scan (desde lista) ────────────────────────────────────────────

  function abrirScannerInline(item: ItemRevision) {
    setScanErrorInline('')
    setItemEscaneando(item.notaProductoId)
  }

  function handleScanInline(codigo: string) {
    if (!itemEscaneando) return
    const item = items.find(i => i.notaProductoId === itemEscaneando)
    if (!item) return
    const normalizar = (s: string) => s.replace(/^0+/, '')
    const escaneado  = normalizar(codigo.trim())
    const cbEsperado = item.codigoBarra
    const cbOk  = cbEsperado ? normalizar(cbEsperado) === escaneado : true
    const altOk = item.codigoBarraAlternativo ? normalizar(item.codigoBarraAlternativo) === escaneado : false
    if (cbEsperado && !cbOk && !altOk) {
      setScanErrorInline(`Código incorrecto. Escanea: ${item.skuEquivalente ?? item.sku}`)
      setTimeout(() => setScanErrorInline(''), 4000)
      return
    }
    setEscaneadosOk(prev => new Set(prev).add(itemEscaneando))
    setCantidadesEdit(prev => ({ ...prev, [itemEscaneando]: String(item.cantidadDespachada) }))
    setItemEscaneando(null)
    setScanErrorInline('')
  }

  async function handleConfirmarItem(item: ItemRevision) {
    if (!escaneadosOk.has(item.notaProductoId)) return
    const cantStr = cantidadesEdit[item.notaProductoId] ?? String(item.cantidadDespachada)
    const cant    = parseInt(cantStr, 10)
    if (isNaN(cant) || cant <= 0) { setError('Ingresa una cantidad válida'); return }
    setConfirmandoId(item.notaProductoId)
    setError(null)
    try {
      const resultado = await validar.mutateAsync({
        adminId,
        notaProductoId:    item.notaProductoId,
        codigoProducto:    item.codigoBarra || item.sku,
        cantidadIngresada: cant,
      })
      if (resultado.todosRevisados) setRevisadoEnSesion(true)
      setEscaneadosOk(prev => { const n = new Set(prev); n.delete(item.notaProductoId); return n })
      setCantidadesEdit(prev => { const n = { ...prev }; delete n[item.notaProductoId]; return n })
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al validar')
    } finally {
      setConfirmandoId(null)
    }
  }

  function handleScanBusqueda(codigo: string) {
    if (!codigo.trim()) return
    const normalizar = (s: string) => s.replace(/^0+/, '').toLowerCase()
    const cod = normalizar(codigo)
    const encontrado = items.find(i =>
      normalizar(i.codigoBarra ?? '') === cod ||
      normalizar(i.codigoBarraAlternativo ?? '') === cod ||
      normalizar(i.sku) === cod ||
      normalizar(i.skuEquivalente ?? '') === cod
    )
    if (!encontrado) return
    setBusqueda('')
    setDestacadoId(encontrado.notaProductoId)
    setTimeout(() => {
      document.getElementById(`rv2-item-${encontrado.notaProductoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setTimeout(() => setDestacadoId(null), 2500)
  }

  const pendientes  = items.filter((i) => !i.revisadoAdmin)
  const completados = items.filter((i) => i.revisadoAdmin)

  // ── Fila de producto — 3 columnas responsive ────────────────────────────

  function renderFila(item: ItemRevision) {
    const revisado      = item.revisadoAdmin
    const esSinStock    = item.estado === 'sin_stock'
    const puedeRevisar  = !revisado && !esSinStock && !offline && !yaDespachada
    const expandido     = expandidos.has(item.notaProductoId)
    const scanOk        = escaneadosOk.has(item.notaProductoId)
    const confirmando   = confirmandoId === item.notaProductoId

    const estadoLabel = revisado ? 'Revisado' : esSinStock ? 'Sin stock' : 'Pendiente'
    const estadoCls   = revisado ? 'rv2-estado--revisado' : esSinStock ? 'rv2-estado--sinstock' : 'rv2-estado--pendiente'

    const esDestacado = destacadoId === item.notaProductoId
    return (
      <div
        key={item.notaProductoId}
        id={`rv2-item-${item.notaProductoId}`}
        className={`rv2-item ${revisado ? 'rv2-item--revisado' : esSinStock ? 'rv2-item--sinstock' : ''} ${scanOk ? 'rv2-item--scanok' : ''} ${esDestacado ? 'rv2-item--destacado' : ''}`}
      >

        {/* Fila principal */}
        <div className="rv2-item-main">

          {/* Col 1 — Botón barcode */}
          <button
            className={`rv2-col-barcode-btn ${scanOk ? 'rv2-col-barcode-btn--ok' : ''} ${revisado ? 'rv2-col-barcode-btn--revisado' : ''}`}
            onClick={(e) => { e.stopPropagation(); if (puedeRevisar) abrirScannerInline(item) }}
            disabled={!puedeRevisar}
            title={puedeRevisar ? 'Escanear código de barras' : undefined}
          >
            <IcoBarcode size={28} />
            {scanOk && <span className="rv2-scan-check"><IcoCheck size={10} /></span>}
          </button>

          {/* Col 2 — Info (clickable para expandir) */}
          <div
            className="rv2-col-info"
            onClick={() => toggleExpandido(item.notaProductoId)}
            style={{ cursor: 'pointer' }}
          >
            <div className="rv2-sku-row">
              <code className="rv2-sku">{item.skuEquivalente ?? item.sku}</code>
              {expandido && <span className="rv2-expand-hint">▲</span>}
              {!expandido && <span className="rv2-expand-hint">▼</span>}
            </div>
            <span className="rv2-nombre">{item.nombre}</span>
            {item.skuEquivalente && (
              <div className="rv2-equiv">
                <span className="rv2-equiv-row">
                  <span className="rv2-equiv-label">Original</span>
                  <code className="rv2-equiv-code">{item.sku}</code>
                </span>
                <span className="rv2-equiv-row">
                  <span className="rv2-equiv-dot" />
                  <span className="rv2-equiv-label">Equivalente</span>
                  <code className="rv2-equiv-code rv2-equiv-code--activo">{item.skuEquivalente}</code>
                </span>
              </div>
            )}
          </div>

          {/* Col 3 — Qty + acción */}
          <div className="rv2-col-right">
            {scanOk ? (
              <div className="rv2-qty-edit-block">
                <label className="rv2-qty-edit-label">Cantidad</label>
                <input
                  className="rv2-qty-edit-input"
                  type="number"
                  min={1}
                  value={cantidadesEdit[item.notaProductoId] ?? item.cantidadDespachada}
                  onChange={e => setCantidadesEdit(prev => ({ ...prev, [item.notaProductoId]: e.target.value }))}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            ) : (
              <div className="rv2-qty-block">
                <span className={`rv2-qty-valor ${revisado ? 'rv2-qty-valor--ok' : ''}`}>
                  {item.cantidadDespachada}
                </span>
              </div>
            )}
            {puedeRevisar && (
              <button
                className="rv2-btn-revisar"
                disabled={!scanOk || confirmando}
                onClick={() => handleConfirmarItem(item)}
              >
                {confirmando ? '…' : <><IcoCheck size={11} /> Confirmar</>}
              </button>
            )}
          </div>
        </div>

        {/* Fila expandida — barcode texto + ubicación */}
        {expandido && (
          <div className="rv2-item-expand">
            <div className="rv2-expand-field">
              <span className="rv2-expand-label">Código de barras</span>
              <code className="rv2-expand-val">{item.codigoBarra || '—'}</code>
              {item.codigoBarra && (
                <button
                  className="rv2-copy-btn"
                  title="Copiar código"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(item.codigoBarra).catch(() => {
                      const el = document.createElement('textarea')
                      el.value = item.codigoBarra
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand('copy')
                      document.body.removeChild(el)
                    })
                    const btn = e.currentTarget
                    btn.classList.add('rv2-copy-btn--copied')
                    setTimeout(() => btn.classList.remove('rv2-copy-btn--copied'), 1500)
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              )}
            </div>
            {scanOk && (
              <div className="rv2-expand-field rv2-expand-field--ok">
                <IcoCheck size={12} />
                <span className="rv2-expand-label">Código escaneado y validado</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="nd-page">
      {mostrarModalChofer && (
        <ModalChofer
          notaId={notaId}
          adminId={adminId}
          onCerrar={() => { setMostrarModalChofer(false); onCerrar() }}
        />
      )}
      {mostrarModalAnular && (
        <ModalAnular
          notaId={notaId}
          adminId={adminId}
          onCerrar={() => setMostrarModalAnular(false)}
          onAnulada={() => { setMostrarModalAnular(false); onCerrar() }}
        />
      )}

      {/* ── Header ejecutivo ── */}
      <div className="nd-header">
        <div className="rv2-header-top-row">
          <button
            className="btn-volver"
            onClick={() => {
              if (paso.tipo === 'lista') { onCerrar() }
              else { setPaso({ tipo: 'lista' }); setError(null); setScanError(''); setScanInput('') }
            }}
          >
            <IcoBack size={16} /> Volver
          </button>
          <div className="rv2-header-centro">
            <h2 className="rv2-nv-titulo">NV {numeroNota}</h2>
            <span className={`badge ${yaDespachada ? 'badge-despachada' : estadoNota === 'revisada' ? 'badge-revisada' : 'badge-preparacion'}`}>
              {yaDespachada ? 'Despachada' : estadoNota === 'revisada' ? 'Revisada' : 'En Revisión'}
            </span>
          </div>
          <div className="rv2-header-derecha">
            {!yaDespachada && todosRevisados && esAdmin && (
              <button
                className="nd-btn-enviar"
                disabled={offline}
                onClick={() => setMostrarModalChofer(true)}
              >
                <IcoTruck size={14} /> Lista para despacho
              </button>
            )}
          </div>
        </div>

        {/* Meta strip */}
        {yaDespachada ? (
          /* ── Diseño corporativo 3 columnas (solo despachadas) ── */
          <div className="rv-desp-meta">
            {/* Col 1: Cliente */}
            <div className="rv-desp-col">
              <div className="rv-desp-col-ico"><IcoBuilding size={15} /></div>
              <div className="rv-desp-col-data">
                <span className="rv-desp-main">{nombreCliente}</span>
                {rutCliente && <span className="rv-desp-sub">RUT {rutCliente}</span>}
                {numeroOc   && <span className="rv-desp-sub">OC {numeroOc}</span>}
              </div>
            </div>
            <div className="rv-desp-sep" />
            {/* Col 2: Chofer */}
            <div className="rv-desp-col">
              <div className="rv-desp-col-ico"><IcoTruck size={15} /></div>
              <div className="rv-desp-col-data">
                <span className="rv-desp-sub-label">Chofer</span>
                <span className="rv-desp-main">{nombreChofer ?? 'Sin asignar'}</span>
              </div>
            </div>
            <div className="rv-desp-sep" />
            {/* Col 3: Fechas */}
            <div className="rv-desp-col">
              <div className="rv-desp-col-ico"><IcoCalendar size={15} /></div>
              <div className="rv-desp-col-data">
                <span className="rv-desp-fecha-row">
                  <span className="rv-desp-sub-label">Preparada</span>
                  <span className="rv-desp-sub">{fmtFecha(fechaPreparacion)}</span>
                </span>
                <span className="rv-desp-fecha-row">
                  <span className="rv-desp-sub-label">Despachada</span>
                  <span className="rv-desp-sub">{fmtFecha(fechaDespacho)}</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ── Tira horizontal estilo despachada (en revisión) ── */
          <div className="rv-desp-meta rv2-meta-strip">
            <div className="rv-desp-col">
              <div className="rv-desp-col-ico"><IcoBuilding size={15} /></div>
              <div className="rv-desp-col-data">
                <span className="rv-desp-main">{nombreCliente}</span>
                {rutCliente && <span className="rv-desp-sub">RUT {rutCliente}</span>}
                {numeroOc   && <span className="rv-desp-sub">OC {numeroOc}</span>}
              </div>
            </div>
            <div className="rv-desp-sep" />
            <div className="rv-desp-col">
              <div className="rv-desp-col-ico"><IcoClock size={15} /></div>
              <div className="rv-desp-col-data">
                <span className="rv-desp-sub-label">Preparación</span>
                {fechaPreparacion
                  ? <span className="rv-desp-main">{fmtFecha(fechaPreparacion)}</span>
                  : <span className="rv-desp-sub">—</span>
                }
                <div className="rv2-meta-progress" style={{ marginTop: 6 }}>
                  <div className="rv2-meta-progress-bar" style={{ width: `${pctGlobal}%` }} />
                </div>
                <span className="rv2-meta-progress-label">{itemsRevisados}/{totalItems} revisados</span>
              </div>
            </div>
            {paso.tipo === 'lista' && esAdmin && (
              <>
                <div className="rv-desp-sep" />
                <div className="rv-desp-col" style={{ justifyContent: 'center' }}>
                  <button
                    className="rv2-btn-anular"
                    disabled={offline}
                    onClick={() => setMostrarModalAnular(true)}
                  >
                    <IcoAlert size={13} /> Anular NV
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>


      {/* ── Avisos ── */}
      {offline && <div className="nd-aviso nd-aviso--offline">Sin conexión — modo solo lectura.</div>}
      {error   && <div className="nd-aviso nd-aviso--error">{error}</div>}

      {/* Anular NV movido al header */}

      {/* ── Banner devolución registrada ── */}
      {tieneDev && (
        <div className="rv-dev-banner">
          <div className="rv-dev-banner-header">
            <span className="rv-dev-banner-ico">↩</span>
            <span className="rv-dev-banner-titulo">Devolución registrada</span>
          </div>
          {devolucion?.items?.length ? (
            <table className="rv-dev-tabla">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {devolucion.items.map((it, i) => (
                  <tr key={i}>
                    <td><span className="rv-dev-sku">{it.sku}</span></td>
                    <td>{it.nombre}</td>
                    <td className="rv-dev-cant">{it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )}


      {/* ══ VISTA LISTA ════════════════════════════════════════════════════ */}
      {/* ── Modal scanner inline ── */}
      {itemEscaneando && (() => {
        const item = items.find(i => i.notaProductoId === itemEscaneando)
        if (!item) return null
        return (
          <div className="rv2-scan-overlay" onClick={() => setItemEscaneando(null)}>
            <div className="rv2-scan-modal" onClick={e => e.stopPropagation()}>
              <div className="rv2-scan-modal-header">
                <div>
                  <code className="rv2-sku">{item.skuEquivalente ?? item.sku}</code>
                  <p className="rv2-scan-modal-nombre">{item.nombre}</p>
                </div>
                <button className="rv2-scan-modal-cerrar" onClick={() => setItemEscaneando(null)}>✕</button>
              </div>
              <div className={`nd-scanner-bar ${scanErrorInline ? 'nd-scanner-bar--error' : ''}`} style={{ margin: '8px 0 0' }}>
                <span className="nd-scanner-icon"><IcoScan size={18} /></span>
                <input
                  id="rv2-scan-input"
                  className="nd-scanner-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Escanea el código de barras…"
                  autoComplete="off"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScanInline((e.target as HTMLInputElement).value)
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }}
                />
                <BarcodeScanner
                  onDetected={(codigo) => handleScanInline(codigo)}
                  title="Escanear producto"
                />
              </div>
              {scanErrorInline && <p className="nd-scanner-error">{scanErrorInline}</p>}
              <button
                className="rv2-scan-modal-confirmar"
                onClick={() => {
                  const inp = document.getElementById('rv2-scan-input') as HTMLInputElement | null
                  if (inp?.value) { handleScanInline(inp.value); inp.value = '' }
                }}
              >
                <IcoCheck size={14} /> Confirmar
              </button>
            </div>
          </div>
        )
      })()}

      {paso.tipo === 'lista' && (
        <>
          {comentarioDespacho && (
            <div className="nd-aviso" style={{ borderColor: 'var(--color-blue-500)', background: 'color-mix(in srgb, var(--color-blue-500) 10%, transparent)' }}>
              <strong>Comentario:</strong> {comentarioDespacho}
            </div>
          )}

          {/* ── Barra de búsqueda ── */}
          <div className="rv2-search-bar">
            <span className="rv2-search-ico"><IcoSearch size={15} /></span>
            <input
              className="rv2-search-input"
              type="text"
              placeholder="Buscar por SKU, descripción o código de barras…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="rv2-search-clear" onClick={() => setBusqueda('')}>✕</button>
            )}
            <BarcodeScanner
              onDetected={(codigo) => handleScanBusqueda(codigo)}
              title="Buscar producto por código"
            />
          </div>

          {/* ── Lista de productos ── */}
          {(() => {
            const q = busqueda.toLowerCase().trim()
            const filtrar = (arr: ItemRevision[]) =>
              q ? arr.filter(i =>
                i.sku.toLowerCase().includes(q) ||
                i.nombre.toLowerCase().includes(q) ||
                (i.codigoBarra?.toLowerCase().includes(q) ?? false) ||
                (i.skuEquivalente?.toLowerCase().includes(q) ?? false)
              ) : arr
            const pendFiltrados = filtrar(pendientes)
            const compFiltrados = filtrar(completados)
            return (
              <div className="rv2-lista">
                <div className="rv2-lista-header">
                  <span className="rv2-lista-header-cantidad">Cantidad</span>
                </div>
                {pendFiltrados.length > 0 && (
                  <section>
                    <h3 className="rv2-seccion-titulo">
                      Pendientes <span className="rv2-seccion-badge">{pendFiltrados.length}</span>
                    </h3>
                    {pendFiltrados.map(renderFila)}
                  </section>
                )}
                {compFiltrados.length > 0 && (
                  <section>
                    <h3 className="rv2-seccion-titulo rv2-seccion-titulo--ok">
                      Revisados <span className="rv2-seccion-badge rv2-seccion-badge--ok">{compFiltrados.length}</span>
                    </h3>
                    {compFiltrados.map(renderFila)}
                  </section>
                )}
                {q && pendFiltrados.length === 0 && compFiltrados.length === 0 && (
                  <div className="rv2-sin-resultados">Sin resultados para "{busqueda}"</div>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* ══ ESCANEAR PRODUCTO ══════════════════════════════════════════════ */}
      {paso.tipo === 'escanear_producto' && (
        <div className="rv-scan-paso">
          <div className="rv-scan-producto-info">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <code className="nd-prod-sku-inline" style={{ flexShrink: 0 }}>{paso.item.skuEquivalente ?? paso.item.sku}</code>
              <span className="nd-prod-nombre" style={{ fontSize: 'var(--font-size-base)' }}>{paso.item.nombre}</span>
            </div>
            {paso.item.skuEquivalente ? (
              <div className="rv-equiv-despacho">
                <span className="rv-equiv-row"><span className="rv-equiv-etiqueta">Producto original:</span><code className="rv-equiv-codigo">{paso.item.sku}</code></span>
                <span className="rv-equiv-row rv-equiv-row--activo"><span className="rv-equiv-etiqueta">Equivalente asignado:</span><code className="rv-equiv-codigo rv-equiv-codigo--activo">{paso.item.skuEquivalente}</code></span>
                {paso.item.codigoBarra && <code className="nd-prod-ean" style={{ marginTop: '4px' }}>{paso.item.codigoBarra}</code>}
              </div>
            ) : (
              <div className="nd-prod-codes">
                {paso.item.codigoBarra && <code className="nd-prod-ean">{paso.item.codigoBarra}</code>}
              </div>
            )}
          </div>

          <div className={`nd-scanner-bar ${scanError ? 'nd-scanner-bar--error' : ''}`}>
            <span className="nd-scanner-icon"><IcoScan size={18} /></span>
            <input
              ref={scanRef}
              className="nd-scanner-input"
              type="text"
              inputMode="numeric"
              placeholder="Escanea el código de barras del producto…"
              autoComplete="off"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleEscanearProducto(scanInput); e.preventDefault() }
              }}
            />
            <BarcodeScanner
              onDetected={(codigo) => { setScanInput(codigo); handleEscanearProducto(codigo) }}
              title="Escanear producto"
            />
          </div>
          {scanError && <p className="nd-scanner-error">{scanError}</p>}

          <div className="rv-paso-acciones">
            <button className="btn-secundario" onClick={() => { setPaso({ tipo: 'lista' }); setError(null); setScanError('') }}>
              ← Volver
            </button>
            <button className="btn-primario" onClick={() => handleEscanearProducto(scanInput)}>
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* ══ CÓDIGO VALIDADO ════════════════════════════════════════════════ */}
      {paso.tipo === 'codigo_validado' && (
        <div className="rv-scan-paso">
          <div style={{ borderLeft: '4px solid #22c55e', borderTop: '1px solid rgba(34,197,94,0.4)', borderRight: '1px solid rgba(34,197,94,0.4)', borderBottom: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.15)', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#4ade80', fontWeight: 700, fontSize: '1rem' }}>
            <IcoCheck size={20} /> Producto validado correctamente
          </div>
          <div className="rv-scan-producto-info">
            <span className="nd-prod-nombre">{paso.item.nombre}</span>
            <code className="nd-prod-sku">{paso.item.skuEquivalente ?? paso.item.sku}</code>
          </div>
          <div className="rv-paso-acciones">
            <button className="btn-secundario" onClick={() => { setPaso({ tipo: 'escanear_producto', item: paso.item }); setError(null) }}>
              ← Volver
            </button>
            <button
              className="btn-primario"
              onClick={() => setPaso({ tipo: 'ingresar_cantidad', item: paso.item, codigoEscaneado: paso.codigoEscaneado })}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* ══ INGRESAR CANTIDAD ══════════════════════════════════════════════ */}
      {paso.tipo === 'ingresar_cantidad' && (
        <div className="rv-scan-paso">
          <div className="rv-scan-producto-info">
            <span className="nd-prod-nombre">{paso.item.nombre}</span>
            <code className="nd-prod-sku">{paso.item.skuEquivalente ?? paso.item.sku}</code>
          </div>

          <div className="rv-cantidad-panel">
            <div className="rv-cantidad-referencia">
              <span className="nd-qty-label">Cantidad despachada registrada</span>
              <strong className="nd-qty-valor" style={{ fontSize: 'var(--font-size-xl)' }}>{paso.item.cantidadDespachada}</strong>
            </div>
            <label className="rv-cantidad-label">
              <span className="nd-qty-label">Cantidad física contada</span>
              <input
                ref={cantidadRef}
                className="rv-cantidad-input"
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                onKeyDown={(e) => { onlyNumbersKeyDown(e); if (e.key === 'Enter') void handleConfirmarCantidad() }}
                onPaste={onlyNumbersPaste}
              />
            </label>
          </div>

          <div className="rv-paso-acciones">
            <button
              className="btn-secundario"
              onClick={() => { setPaso({ tipo: 'escanear_producto', item: paso.item }); setError(null) }}
            >
              ← Volver
            </button>
            <button
              className="btn-primario"
              disabled={validar.isPending || !cantidad}
              onClick={() => void handleConfirmarCantidad()}
            >
              {validar.isPending ? 'Validando…' : 'Confirmar cantidad'}
            </button>
          </div>
        </div>
      )}

      {/* ══ RESULTADO ══════════════════════════════════════════════════════ */}
      {paso.tipo === 'resultado' && (
        <div className="rv-scan-paso">
          <div className="nd-aviso" style={{ borderColor: 'var(--color-green-500)', background: 'color-mix(in srgb, var(--color-green-500) 10%, transparent)', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <IcoCheck size={18} /> {paso.todosRevisados ? '¡Todos los productos revisados!' : 'Producto validado'}
            </div>
            <p style={{ margin: 0, opacity: 0.85 }}>{paso.mensaje}</p>
          </div>
          {paso.todosRevisados && esAdmin && (
            <button
              className="nd-btn-enviar"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              disabled={offline}
              onClick={() => setMostrarModalChofer(true)}
            >
              <IcoTruck size={14} /> Lista para despacho
            </button>
          )}
          <button className="btn-secundario" style={{ marginTop: '0.5rem' }} onClick={() => { setPaso({ tipo: 'lista' }); setError(null) }}>
            ← Volver a la lista
          </button>
        </div>
      )}
    </div>
  )
}
