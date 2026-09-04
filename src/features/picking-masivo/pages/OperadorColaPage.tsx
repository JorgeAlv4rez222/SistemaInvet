import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useColaSubtareas, useLiberarPropias, useSesionPicking, useTomarSubtarea } from '../hooks/usePickingMasivo'
import { useRealtimeSesion } from '../hooks/useRealtimePicking'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { SubtareaResumen } from '../services/picking-masivo.api'

// ── Íconos ────────────────────────────────────────────────────────────────────

function IcoBack() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><polyline points="15 18 9 12 15 6"/></svg>
}
function IcoUnlock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
}
function IcoScan() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="12" x2="17" y2="12.01"/></svg>
}
function IcoPin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IcoLock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function IcoCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><polyline points="20 6 9 17 4 12"/></svg>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePosicion(cod: string) {
  if (!cod || cod === '—') return { codigo: cod, detalle: null }
  const parts = cod.split(/[-/]/)
  return { codigo: cod, detalle: parts.length > 2 ? `Pasillo ${parts[1] ?? ''}` : null }
}

// ── Tarjeta de producto / subtarea ────────────────────────────────────────────

function SubtareaCard({
  sub,
  operadorId,
  sesionId,
  tomandoId,
  rol,
  onTomar,
}: {
  sub: SubtareaResumen
  operadorId: string
  sesionId: string
  tomandoId: string | null
  rol: string
  onTomar: (sub: SubtareaResumen) => void
}) {
  const navigate = useNavigate()

  const esMia          = sub.estado === 'bloqueado' && sub.bloqueado_por === operadorId
  const bloqueadaXOtro = sub.estado === 'bloqueado' && sub.bloqueado_por !== operadorId
  const esParcial      = sub.estado === 'parcial' || sub.estado === 'sin_stock'
  const esCompleta     = sub.estado === 'completado'

  const item = sub.items_picking_masivo
  const desc = item?.descripcion ?? item?.codigo ?? '—'
  const sku  = item?.codigo ?? '—'
  const ean  = item?.codigo_barra ?? null
  const pos  = parsePosicion(sub.posicion_codigo)

  let estadoBadgeClass = 'cola-badge--libre'
  let estadoLabel      = 'LIBRE'
  if (esMia)          { estadoBadgeClass = 'cola-badge--mia';      estadoLabel = 'EN PROCESO (Tú)' }
  if (bloqueadaXOtro) { estadoBadgeClass = 'cola-badge--ocupada';  estadoLabel = 'OCUPADA' }
  if (esParcial)      { estadoBadgeClass = 'cola-badge--parcial';   estadoLabel = 'PARCIAL' }
  if (esCompleta)     { estadoBadgeClass = 'cola-badge--completa';  estadoLabel = 'COMPLETO' }

  let cardMod = ''
  if (bloqueadaXOtro) cardMod = 'cola-card--ocupada'
  if (esCompleta)     cardMod = 'cola-card--completa'
  if (esMia)          cardMod = 'cola-card--mia'
  if (esParcial)      cardMod = 'cola-card--parcial'

  return (
    <div className={`cola-card ${cardMod}`}>

      {/* ── Fila superior: ubicación + badge ── */}
      <div className="cola-card-top">
        <div className="cola-rack-badge">
          <IcoPin />
          <span className="cola-rack-codigo">{pos.codigo !== '—' ? pos.codigo : 'Sin ubicación'}</span>
          {pos.detalle && <span className="cola-rack-detalle">· {pos.detalle}</span>}
        </div>
        <div className={`cola-badge ${estadoBadgeClass}`}>
          {esCompleta && <IcoCheck />}
          {bloqueadaXOtro && <IcoLock />}
          {estadoLabel}
        </div>
      </div>

      {/* ── Descripción + SKU + EAN ── */}
      <div className="cola-card-sku">
        <span className="cola-sku-desc">{desc}</span>
        <div className="cola-sku-codes">
          <span className="cola-sku-tag">SKU: {sku}</span>
          {ean && <span className="cola-ean-tag">{ean}</span>}
        </div>
      </div>

      {/* ── Cantidad + acción ── */}
      <div className="cola-card-bottom">
        <div className="cola-cant-block">
          <span className="cola-cant-label">Cantidad</span>
          <span className="cola-cant-val">
            {esParcial
              ? `${sub.cantidad_despachada ?? 0} / ${sub.cantidad_asignada}`
              : sub.cantidad_asignada}
            <span className="cola-cant-unit"> Uds</span>
          </span>
        </div>

        <div className="cola-acciones">
          {esCompleta ? (
            <div className="cola-btn cola-btn--completa">
              <IcoCheck /> COMPLETADO
            </div>
          ) : esMia ? (
            <button
              className="cola-btn cola-btn--escanear"
              onClick={() => navigate(`/picking-masivo/operador/${sesionId}/confirmar/${sub.id}`)}
            >
              <IcoScan /> ESCANEAR
            </button>
          ) : bloqueadaXOtro ? (
            <div className="cola-ocupada-info">
              <div className="cola-btn cola-btn--bloqueado" aria-disabled="true">
                <IcoLock /> BLOQUEADO
              </div>
              {(rol === 'supervisor' || rol === 'admin') && (
                <span className="cola-ocupada-hint">Supervisor puede liberar</span>
              )}
            </div>
          ) : esParcial ? (
            <button
              className="cola-btn cola-btn--escanear"
              onClick={() => navigate(`/picking-masivo/operador/${sesionId}/confirmar/${sub.id}`)}
            >
              <IcoScan /> EDITAR PARCIAL
            </button>
          ) : (
            <button
              className="cola-btn cola-btn--tomar"
              disabled={tomandoId === sub.id}
              onClick={() => onTomar(sub)}
            >
              {tomandoId === sub.id ? 'Tomando…' : 'TOMAR TAREA'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export function OperadorColaPage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const sesionId    = id ?? null
  const operadorId  = localStorage.getItem('user_id')  ?? ''
  const rol         = localStorage.getItem('user_rol')  ?? ''
  const scannerRef  = useRef<HTMLInputElement>(null)

  const { data, isLoading, isError } = useColaSubtareas(sesionId)
  const { data: sesion }             = useSesionPicking(sesionId)
  useRealtimeSesion(sesionId)
  const tomarSubtarea  = useTomarSubtarea(sesionId ?? '')
  const liberarPropias = useLiberarPropias(sesionId ?? '')

  const [tomandoId, setTomandoId]   = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [filtro, setFiltro]         = useState<'todas' | 'mias' | 'tomadas' | 'parcial' | 'completas'>('todas')
  const [scanner, setScanner]       = useState('')

  const subtareas = data ?? []
  const tengoPropias = subtareas.some(s => s.estado === 'bloqueado' && s.bloqueado_por === operadorId)

  // Foco permanente en el campo escáner
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.activeElement !== scannerRef.current) {
        scannerRef.current?.focus()
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const cntTodas    = subtareas.filter(s => s.estado !== 'completado').length
  const cntMias     = subtareas.filter(s => s.estado === 'bloqueado' && s.bloqueado_por === operadorId).length
  const cntTomadas  = subtareas.filter(s => s.estado === 'bloqueado' && s.bloqueado_por !== operadorId).length
  const cntParcial  = subtareas.filter(s => s.estado === 'parcial' || s.estado === 'sin_stock').length
  const cntCompletas= subtareas.filter(s => s.estado === 'completado').length

  const subtareasFiltradas = subtareas.filter(s => {
    if (filtro === 'todas')     return s.estado !== 'completado'
    if (filtro === 'mias')      return s.estado === 'bloqueado' && s.bloqueado_por === operadorId
    if (filtro === 'tomadas')   return s.estado === 'bloqueado' && s.bloqueado_por !== operadorId
    if (filtro === 'parcial')   return s.estado === 'parcial' || s.estado === 'sin_stock'
    if (filtro === 'completas') return s.estado === 'completado'
    return true
  })

  const termino = scanner.trim().toLowerCase()
  const visibles = (termino
    ? subtareasFiltradas.filter(s =>
        s.items_picking_masivo?.codigo?.toLowerCase().includes(termino) ||
        s.items_picking_masivo?.descripcion?.toLowerCase().includes(termino) ||
        s.items_picking_masivo?.codigo_barra?.toLowerCase().includes(termino)
      )
    : subtareasFiltradas
  ).slice().sort((a, b) => (a.items_picking_masivo?.lpn ?? '').localeCompare(b.items_picking_masivo?.lpn ?? '', undefined, { numeric: true }))

  async function handleTomar(sub: SubtareaResumen) {
    if (!sesionId) return
    setError(null)
    setTomandoId(sub.id)
    try {
      await tomarSubtarea.mutateAsync({ subtareaId: sub.id, usuarioId: operadorId })
      navigate(`/picking-masivo/operador/${sesionId}/confirmar/${sub.id}`)
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'No se pudo tomar la subtarea')
    } finally {
      setTomandoId(null)
    }
  }

  async function handleLiberar() {
    if (!sesionId) return
    setError(null)
    await liberarPropias.mutateAsync({ sesionId, usuarioId: operadorId })
  }

  const pct = sesion && sesion.total_items > 0
    ? Math.round((sesion.items_completados / sesion.total_items) * 100)
    : 0

  const oc      = sesion?.numero_oc_pedido ?? sesion?.numero_oc ?? ''
  const cliente = sesion?.nombre_cliente ?? oc

  return (
    <div className="cola-wrap">

      {/* ── Cabecera ── */}
      <div className="cola-header">
        <div className="cola-header-left">
          <button className="cola-volver-btn" onClick={() => navigate('/picking-masivo/operador')}>
            <IcoBack /> Volver
          </button>
          <div className="cola-header-info">
            <span className="cola-header-titulo">{cliente}</span>
            {oc && <span className="cola-header-oc">OC: <strong>{oc}</strong></span>}
          </div>
        </div>
        <div className="cola-header-right">
          <button
            className="cola-liberar-btn"
            disabled={!tengoPropias || liberarPropias.isPending}
            onClick={handleLiberar}
          >
            <IcoUnlock />
            {liberarPropias.isPending ? 'Liberando…' : 'Liberar mis tareas'}
          </button>
        </div>
      </div>

      {/* ── Barra de progreso ── */}
      {sesion && (
        <div className="cola-progreso-wrap">
          <div className="cola-progreso-meta">
            <span className="cola-progreso-label">PROGRESO DEL LOTE</span>
            <span className="cola-progreso-ratio">
              {sesion.items_completados} / {sesion.total_items} productos · {pct}%
            </span>
          </div>
          <div className="cola-progreso-bg">
            <div className="cola-progreso-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* ── Campo escáner láser ── */}
      <div className="cola-scanner-wrap">
        <div className="cola-scanner-dot" />
        <span className="cola-scanner-label">ESCÁNER ACTIVO</span>
        <input
          ref={scannerRef}
          className="cola-scanner-input"
          placeholder="Pistolear EAN / Código de Barra aquí…"
          value={scanner}
          onChange={e => setScanner(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        {scanner && (
          <button className="cola-scanner-clear" onClick={() => { setScanner(''); scannerRef.current?.focus() }}>✕</button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Filtros ── */}
      <div className="cola-filtros">
        {([
          ['todas',     `Todas (${cntTodas})`],
          ['mias',      `Mis Tareas (${cntMias})`],
          ['tomadas',   `Ocupadas (${cntTomadas})`],
          ['parcial',   `Parcial (${cntParcial})`],
          ['completas', `Completas (${cntCompletas})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`cola-filtro-btn ${filtro === key ? 'cola-filtro-btn--activo' : ''}`}
            onClick={() => setFiltro(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      {isLoading && <p className="cargando">Cargando cola…</p>}
      {isError   && <p className="error-msg">Error al cargar la cola</p>}
      {!isLoading && !isError && visibles.length === 0 && (
        <div className="notas-vacio">
          <p>{scanner ? 'Sin resultados para ese código' : 'Sin tareas para este filtro'}</p>
        </div>
      )}

      {!isLoading && !isError && visibles.length > 0 && (
        <div className="cola-lista">
          {visibles.map(sub => (
            <SubtareaCard
              key={sub.id}
              sub={sub}
              operadorId={operadorId}
              sesionId={sesionId ?? ''}
              tomandoId={tomandoId}
              rol={rol}
              onTomar={handleTomar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
