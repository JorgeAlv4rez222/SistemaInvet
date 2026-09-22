import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useOla,
  useColaExtraccion,
  useTomarTarea,
  useConfirmarExtraccion,
  useLiberarPropiasExtraccion,
} from '../hooks/useOlas'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { TareaExtraccion } from '../services/olas.api'

// ─── Íconos ───────────────────────────────────────────────────────────────────

function IcoBack() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IcoUnlock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
}
function IcoCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}><polyline points="20 6 9 17 4 12"/></svg>
}
function IcoLock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function IcoPin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={11} height={11}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}

// ─── Tarjeta de tarea ─────────────────────────────────────────────────────────

function TareaCard({
  tarea,
  operadorId,
  olaId,
  tomandoId,
  onTomar,
}: {
  tarea:      TareaExtraccion
  operadorId: string
  olaId:      string
  tomandoId:  string | null
  onTomar:    (tarea: TareaExtraccion) => void
}) {
  const [scanInput, setScanInput]   = useState<string>('')
  const [scanOk, setScanOk]         = useState(false)
  const [cantidad, setCantidad]     = useState<string>('')
  const [error, setError]           = useState<string | null>(null)
  const [confirmando, setConf]      = useState(false)

  const confirmar = useConfirmarExtraccion(olaId)

  const esMia          = tarea.estado === 'bloqueado' && tarea.bloqueado_por === operadorId
  const bloqueadaXOtro = tarea.estado === 'bloqueado' && tarea.bloqueado_por !== operadorId
  const esCompleta     = tarea.estado === 'completado'
  const esLibre        = tarea.estado === 'libre'

  const ruta = tarea.ruta_sugerida ?? []

  function handleScan(valor: string) {
    setScanInput(valor)
    setError(null)
    const ean = tarea.codigo_barra?.trim() ?? ''
    if (valor.trim() === ean) {
      setScanOk(true)
    } else if (valor.length >= ean.length && ean.length > 0) {
      setError(`Código incorrecto. Esperado: ${ean}`)
    }
  }

  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const ean = tarea.codigo_barra?.trim() ?? ''
      if (scanInput.trim() === ean) {
        setScanOk(true)
      } else {
        setError(`Código incorrecto. Esperado: ${ean}`)
      }
    }
  }

  async function handleConfirmar() {
    const cant = parseInt(cantidad, 10)
    if (!Number.isFinite(cant) || cant < 0) { setError('Ingresa una cantidad válida'); return }
    if (cant > tarea.cantidad_total) { setError(`Máximo ${tarea.cantidad_total} unidades`); return }
    setError(null)
    setConf(true)
    try {
      await confirmar.mutateAsync({ tareaId: tarea.id, usuarioId: operadorId, cantidadExtraida: cant })
      setCantidad('')
      setScanOk(false)
      setScanInput('')
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al confirmar')
    } finally {
      setConf(false)
    }
  }

  const cardMod = esCompleta      ? 'sd-item-card--completado'
    : esMia           ? 'sd-item-card--en-progreso'
    : bloqueadaXOtro  ? 'sd-item-card--bloqueado'
    : ''

  return (
    <div className={`sd-item-card ext-tarea-card ${cardMod}`}>

      {/* ── Fila resumen ── */}
      <div className="ext-tarea-fila">

        {/* Descripción + EAN */}
        <div className="sd-item-sku" style={{ flex: 1 }}>
          <span className="sd-item-nombre">{tarea.descripcion}</span>
          {tarea.codigo_barra && (
            <span className="sd-ean-tag" style={{ marginTop: 2 }}>EAN: {tarea.codigo_barra}</span>
          )}
        </div>

        {/* Cantidad total */}
        <div className="oc-item-cant" style={{ minWidth: 60 }}>
          <strong>{tarea.cantidad_total}</strong>
          <span className="oc-item-cant-unit"> Uds</span>
        </div>

        {/* Badge de estado */}
        <div className="sd-item-estado">
          {esCompleta && (
            <span className="sd-badge sd-badge--ok"><IcoCheck /> Completado</span>
          )}
          {bloqueadaXOtro && (
            <span className="sd-badge sd-badge--proceso"><IcoLock /> Bloqueado</span>
          )}
          {esMia && (
            <span className="sd-badge sd-badge--proceso">En proceso</span>
          )}
          {esLibre && (
            <span className="sd-badge sd-badge--libre">Libre</span>
          )}
        </div>

        {/* Acción rápida */}
        {esLibre && (
          <button
            className="sd-accion-btn sd-accion-btn--picking"
            disabled={tomandoId === tarea.id}
            onClick={() => onTomar(tarea)}
          >
            {tomandoId === tarea.id ? 'Tomando…' : 'Tomar'}
          </button>
        )}
      </div>

      {/* ── Ruta FIFO sugerida ── */}
      {ruta.length > 0 && (esMia || esCompleta) && (
        <div className="ext-ruta">
          <span className="ext-ruta-label">Ruta FIFO sugerida</span>
          <div className="ext-ruta-chips">
            {ruta.map((tramo, i) => (
              <span key={i} className={`ext-ruta-chip ${esCompleta ? 'ext-ruta-chip--done' : ''}`}>
                <IcoPin /> {tramo.posicion_codigo}
                <span className="ext-ruta-cant">{tramo.cantidad} u.</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirmar extracción (inline) ── */}
      {esMia && (
        <div className="ext-confirmar">
          {error && <p className="ext-confirmar-error">{error}</p>}

          {/* Paso 1 — Escanear código de barra */}
          {!scanOk && (
            <>
              <p className="ext-confirmar-label" style={{ marginBottom: 4 }}>
                Escanea el código de barra del producto para validar
              </p>
              <div className="ext-confirmar-row">
                <input
                  type="text"
                  className="ing-filtro-select ext-scan-input"
                  placeholder="Escanea el EAN…"
                  value={scanInput}
                  onChange={e => handleScan(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  autoFocus
                  autoComplete="off"
                />
                {tarea.codigo_barra && (
                  <span className="ext-ean-esperado">EAN: {tarea.codigo_barra}</span>
                )}
              </div>
            </>
          )}

          {/* Paso 2 — Ingresar cantidad (solo si scan válido) */}
          {scanOk && (
            <>
              <p className="ext-scan-ok">✓ Producto verificado — ingresa la cantidad extraída</p>
              <div className="ext-confirmar-row">
                <label className="ext-confirmar-label">Cantidad extraída</label>
                <input
                  type="number"
                  className="ing-filtro-select ext-confirmar-input"
                  min={0}
                  max={tarea.cantidad_total}
                  placeholder={String(tarea.cantidad_total)}
                  value={cantidad}
                  onChange={e => { setCantidad(e.target.value); setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmar()}
                  autoFocus
                />
                <button
                  className="btn-primario"
                  disabled={confirmando || !cantidad}
                  onClick={handleConfirmar}
                >
                  {confirmando ? 'Guardando…' : 'Confirmar'}
                </button>
              </div>
              <p className="ext-confirmar-hint">
                Si extrajiste todo, ingresa <strong>{tarea.cantidad_total}</strong>. Si hubo falta de stock, ingresa la cantidad real.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Cantidad extraída (completada) ── */}
      {esCompleta && tarea.cantidad_extraida != null && (
        <div className="ext-extraida">
          Extraído: <strong>{tarea.cantidad_extraida}</strong> de {tarea.cantidad_total} Uds.
          {tarea.cantidad_extraida < tarea.cantidad_total && (
            <span className="ext-extraida-parcial"> (diferencia: {tarea.cantidad_total - tarea.cantidad_extraida})</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function ExtraccionOlaPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const olaId      = id ?? ''
  const operadorId = localStorage.getItem('user_id') ?? ''

  const { data: ola }                  = useOla(olaId)
  const { data, isLoading, isError }   = useColaExtraccion(olaId)
  const tomarTarea                     = useTomarTarea(olaId)
  const liberarPropias                 = useLiberarPropiasExtraccion()

  const [tomandoId, setTomandoId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [filtro, setFiltro]       = useState<'pendientes' | 'mias' | 'completas'>('pendientes')

  const tareas = data ?? []

  const cntPend  = tareas.filter(t => t.estado !== 'completado').length
  const cntMias  = tareas.filter(t => t.estado === 'bloqueado' && t.bloqueado_por === operadorId).length
  const cntComp  = tareas.filter(t => t.estado === 'completado').length
  const total    = tareas.length
  const pct      = total > 0 ? Math.round((cntComp / total) * 100) : 0
  const tengoPropias = cntMias > 0

  const visibles = tareas
    .filter(t => {
      if (filtro === 'pendientes') return t.estado !== 'completado'
      if (filtro === 'mias')      return t.estado === 'bloqueado' && t.bloqueado_por === operadorId
      if (filtro === 'completas') return t.estado === 'completado'
      return true
    })
    .sort((a, b) => {
      // Mis tareas primero, luego libres, luego bloqueadas por otros, luego completadas
      const order = (t: TareaExtraccion) =>
        t.bloqueado_por === operadorId ? 0 : t.estado === 'libre' ? 1 : t.estado === 'bloqueado' ? 2 : 3
      return order(a) - order(b) || a.descripcion.localeCompare(b.descripcion)
    })

  async function handleTomar(tarea: TareaExtraccion) {
    setError(null)
    setTomandoId(tarea.id)
    try {
      await tomarTarea.mutateAsync({ tareaId: tarea.id, usuarioId: operadorId })
      setFiltro('mias')
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'La tarea ya fue tomada por otro operador')
    } finally {
      setTomandoId(null)
    }
  }

  async function handleLiberar() {
    setError(null)
    try {
      await liberarPropias.mutateAsync({ olaId, usuarioId: operadorId })
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al liberar tareas')
    }
  }

  const proveedor = ola ? ola.proveedor.charAt(0).toUpperCase() + ola.proveedor.slice(1) : '…'

  return (
    <div className="sd-page sd-page--operador">

      {/* ── Cabecera ── */}
      <div className="sd-header">
        <button className="sd-volver-btn" onClick={() => navigate(`/picking-masivo/ola/${olaId}`)}>
          <IcoBack /> Volver
        </button>
        <div className="sd-header-title">
          <span className="sd-header-nombre">Extracción — {proveedor}</span>
          {ola?.fecha_entrega && (
            <span className="sd-header-meta">Entrega: {ola.fecha_entrega}</span>
          )}
        </div>
        <div className="sd-header-actions">
          <button
            className="sd-btn sd-btn--secondary"
            disabled={!tengoPropias || liberarPropias.isPending}
            onClick={handleLiberar}
          >
            <IcoUnlock />
            {liberarPropias.isPending ? 'Liberando…' : 'Liberar mis tareas'}
          </button>
        </div>
      </div>

      {/* ── Barra de progreso ── */}
      <div className="cola-progreso-wrap">
        <div className="cola-progreso-meta">
          <span className="cola-progreso-label">PROGRESO FASE 1</span>
          <span className="cola-progreso-ratio">{cntComp} / {total} SKUs · {pct}%</span>
        </div>
        <div className="cola-progreso-bg">
          <div className="cola-progreso-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && <div className="sd-error-banner">{error}</div>}

      {/* ── Filtros ── */}
      <div className="sd-toolbar oc-toolbar">
        <div className="sd-filtros">
          {([
            ['pendientes', `Pendientes (${cntPend})`],
            ['mias',       `Mis tareas (${cntMias})`],
            ['completas',  `Completadas (${cntComp})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`sd-filtro-btn ${filtro === key ? 'sd-filtro-btn--activo' : ''}`}
              onClick={() => setFiltro(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de tareas ── */}
      {isLoading && <p className="cargando">Cargando tareas…</p>}
      {isError   && <p className="error-msg">Error al cargar la cola</p>}
      {!isLoading && !isError && visibles.length === 0 && (
        <div className="sd-vacio">
          {filtro === 'completas' ? 'Aún no hay tareas completadas' : 'No hay tareas pendientes'}
        </div>
      )}
      {!isLoading && !isError && visibles.length > 0 && (
        <div className="sd-items-lista">
          {visibles.map(t => (
            <TareaCard
              key={t.id}
              tarea={t}
              operadorId={operadorId}
              olaId={olaId}
              tomandoId={tomandoId}
              onTomar={handleTomar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
