import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesionesPicking, useCancelarSesion } from '../hooks/usePickingMasivo'
import { useRealtimeSesiones } from '../hooks/useRealtimePicking'
import type { SesionResumen } from '../services/picking-masivo.api'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoAdmin = 'libre' | 'en_proceso' | 'completada' | 'despachada' | 'cancelada' | 'validando'
type FiltroEstado = EstadoAdmin | 'todas'

function derivarEstado(s: SesionResumen): EstadoAdmin {
  if (s.estado === 'cancelada')  return 'cancelada'
  if (s.estado === 'despachado') return 'despachada'
  if (s.estado === 'completada') return 'completada'
  if (s.estado === 'validando')  return 'validando'
  if (s.estado === 'activa')     return s.items_completados > 0 ? 'en_proceso' : 'libre'
  return 'libre'
}

const ESTADO_CFG: Record<EstadoAdmin, { label: string; cls: string; dot: string }> = {
  libre:      { label: 'LIBRE EN COLA', cls: 'pm-badge--libre',      dot: '#f59e0b' },
  en_proceso: { label: 'EN PROCESO',    cls: 'pm-badge--proceso',    dot: '#22c55e' },
  completada: { label: 'COMPLETADA',    cls: 'pm-badge--completada', dot: '#38bdf8' },
  despachada: { label: 'DESPACHADA',    cls: 'pm-badge--despachada', dot: '#a78bfa' },
  cancelada:  { label: 'CANCELADA',     cls: 'pm-badge--cancelada',  dot: '#f87171' },
  validando:  { label: 'VALIDANDO',     cls: 'pm-badge--validando',  dot: '#94a3b8' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// numero_oc guarda la fecha de entrega en formato "DD-MM-YYYY"
function parseFechaEntrega(ddmmyyyy: string): Date | null {
  const [d, m, y] = ddmmyyyy.split('-')
  if (!d || !m || !y) return null
  return new Date(Number(y), Number(m) - 1, Number(d))
}

function hoyStr() {
  const h = new Date()
  return `${String(h.getDate()).padStart(2, '0')}-${String(h.getMonth() + 1).padStart(2, '0')}-${h.getFullYear()}`
}

function urgenciaBadge(ddmmyyyy: string): { label: string; cls: string } | null {
  const entrega = parseFechaEntrega(ddmmyyyy)
  if (!entrega) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const man = new Date(hoy); man.setDate(man.getDate() + 1)
  entrega.setHours(0, 0, 0, 0)
  if (entrega.getTime() === hoy.getTime()) return { label: 'HOY',    cls: 'pm-urgencia--hoy' }
  if (entrega.getTime() === man.getTime()) return { label: 'MAÑANA', cls: 'pm-urgencia--manana' }
  if (entrega < hoy) return { label: 'VENCIDA', cls: 'pm-urgencia--vencida' }
  return null
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return iso.slice(0, 10).split('-').reverse().join('-')
}

// ── Barra de progreso ─────────────────────────────────────────────────────────

function ProgressBar({ pct, alerta }: { pct: number; alerta: boolean }) {
  const color = alerta ? '#f59e0b' : pct === 100 ? '#38bdf8' : '#22c55e'
  return (
    <div className="pm-t-barra-bg">
      <div className="pm-t-barra-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

// ── Menú contextual ───────────────────────────────────────────────────────────

function MenuContextual({ onCancelar }: { onCancelar: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="pm-t-menu-wrap" ref={ref}>
      <button className="pm-t-btn pm-t-btn--gear" onClick={() => setOpen(o => !o)} title="Más opciones">
        ⚙
      </button>
      {open && (
        <div className="pm-t-menu-dropdown">
          <button
            className="pm-t-menu-item pm-t-menu-item--danger"
            onClick={() => { setOpen(false); onCancelar() }}
          >
            🚫 Cancelar sesión
          </button>
        </div>
      )}
    </div>
  )
}

// ── Fila de sesión ────────────────────────────────────────────────────────────

function OlaFila({
  s,
  onMonitorear,
  onCancelar,
}: {
  s: SesionResumen
  onMonitorear: () => void
  onCancelar: () => void
}) {
  const estado    = derivarEstado(s)
  const cfg       = ESTADO_CFG[estado]
  const pct       = s.total_items > 0 ? Math.round((s.items_completados / s.total_items) * 100) : 0
  const udsTxt    = `${s.items_completados.toLocaleString('es-CL')} / ${s.total_items.toLocaleString('es-CL')} Uds`
  const badge     = urgenciaBadge(s.numero_oc)
  const esHoy     = badge?.label === 'HOY'
  const alerta    = esHoy && pct < 50
  const cancelable = estado === 'libre' || estado === 'validando' || estado === 'en_proceso'
  const accionLabel = estado === 'despachada' || estado === 'cancelada' ? 'Ver detalle' : 'Ver monitoreo'

  return (
    <tr className={`pm-t-fila pm-t-fila--${estado}`}>

      {/* Identificación */}
      <td className="pm-t-td pm-t-td--id">
        <span className="pm-t-cliente">{s.nombre_cliente ?? '—'}</span>
        {s.numero_oc_pedido && (
          <span className="pm-t-oc">OC {s.numero_oc_pedido}</span>
        )}
      </td>

      {/* Progreso */}
      <td className="pm-t-td pm-t-td--prog">
        <div className="pm-t-prog-wrap">
          <div className="pm-t-prog-header">
            <span className="pm-t-uds">{udsTxt}</span>
            <span className={`pm-t-pct${alerta ? ' pm-t-pct--alerta' : ''}`}>{pct}%</span>
          </div>
          <ProgressBar pct={pct} alerta={alerta} />
        </div>
      </td>

      {/* Entrega */}
      <td className="pm-t-td pm-t-td--entrega">
        <span className="pm-t-fecha-entrega">{s.numero_oc}</span>
        {badge && (
          <span className={`pm-t-urgencia ${badge.cls}`}>{badge.label}</span>
        )}
      </td>

      {/* Creación */}
      <td className="pm-t-td pm-t-td--creacion">
        <span className="pm-t-fecha-creacion">{fmtFecha(s.creado_en)}</span>
        {s.creado_por_usuario && (
          <span className="pm-t-creador">{s.creado_por_usuario.nombre}</span>
        )}
      </td>

      {/* Estado */}
      <td className="pm-t-td pm-t-td--estado">
        <span className={`pm-admin-badge ${cfg.cls}`}>
          <span className="pm-admin-badge-dot" style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
      </td>

      {/* Acciones */}
      <td className="pm-t-td pm-t-td--acciones">
        <div className="pm-t-acciones">
          <button className="pm-t-btn pm-t-btn--monitor" onClick={onMonitorear} title={accionLabel}>
            👁 {accionLabel}
          </button>
          {cancelable && (
            <MenuContextual onCancelar={onCancelar} />
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export function PickingMasivoPage() {
  const navigate  = useNavigate()
  const ROL       = localStorage.getItem('user_rol') ?? ''
  const [busqueda, setBusqueda]     = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null)

  const { data, isLoading, isError } = useSesionesPicking()
  const cancelar = useCancelarSesion()
  useRealtimeSesiones()

  const sesiones = data ?? []

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const enProceso   = sesiones.filter(s => s.estado === 'activa' && s.items_completados > 0)
  const libres      = sesiones.filter(s => (s.estado === 'activa' && s.items_completados === 0) || s.estado === 'validando')
  const completadas = sesiones.filter(s => s.estado === 'completada' || s.estado === 'despachado')

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtradas = sesiones.filter(s => {
    const q = busqueda.toLowerCase()
    const matchBusq = !q ||
      (s.nombre_cliente ?? '').toLowerCase().includes(q) ||
      s.numero_oc.toLowerCase().includes(q) ||
      (s.numero_oc_pedido ?? '').toLowerCase().includes(q)

    const matchFecha = !filtroFecha || (() => {
      const [y, m, d] = filtroFecha.split('-')
      return s.numero_oc === `${d}-${m}-${y}`
    })()

    const estado = derivarEstado(s)
    const matchEstado = filtroEstado === 'todas' ||
      estado === filtroEstado ||
      (filtroEstado === 'completada' && estado === 'despachada')

    return matchBusq && matchFecha && matchEstado
  })

  function handleCancelar(sesionId: string) {
    cancelar.mutate(sesionId, { onSuccess: () => setConfirmCancelar(null) })
  }

  function toggleFiltro(f: FiltroEstado) {
    setFiltroEstado(cur => cur === f ? 'todas' : f)
  }

  // Vista operador
  if (ROL === 'operador') {
    return (
      <div className="notas-page">
        <div className="notas-vacio">
          <p>Ve a <button className="btn-link" onClick={() => navigate('/picking-masivo/operador')}>Sesiones disponibles</button></p>
        </div>
      </div>
    )
  }

  return (
    <div className="pm-admin-wrap">

      {/* ── Cabecera ── */}
      <div className="pm-admin-top">
        <h1 className="pm-admin-titulo">Gestión de Picking Masivo</h1>
        {ROL === 'admin' && (
          <button className="btn-primario pm-admin-nueva-btn" onClick={() => navigate('/picking-masivo/nueva')}>
            ➕ Nueva Sesión
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="pm-admin-kpis">
        <button
          className={`pm-admin-kpi pm-admin-kpi--proceso ${filtroEstado === 'en_proceso' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => toggleFiltro('en_proceso')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{enProceso.length}</span>
            <span className="pm-admin-kpi-label">🔵 En Proceso</span>
          </div>
        </button>

        <button
          className={`pm-admin-kpi pm-admin-kpi--libre ${filtroEstado === 'libre' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => toggleFiltro('libre')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{libres.length}</span>
            <span className="pm-admin-kpi-label">🟡 Pendientes / Libres</span>
          </div>
        </button>

        <button
          className={`pm-admin-kpi pm-admin-kpi--completadas ${filtroEstado === 'completada' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => toggleFiltro('completada')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{completadas.length}</span>
            <span className="pm-admin-kpi-label">🟣 Completadas</span>
          </div>
        </button>

        <button
          className={`pm-admin-kpi ${filtroEstado === 'todas' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => setFiltroEstado('todas')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{sesiones.length}</span>
            <span className="pm-admin-kpi-label">⚪ Todas</span>
          </div>
        </button>
      </div>

      {/* ── Búsqueda y fecha ── */}
      <div className="pm-admin-search-row">
        <div className="pm-admin-search-wrap">
          <span className="pm-admin-search-ico">🔍</span>
          <input
            className="pm-admin-search"
            placeholder="Buscar por Cliente, N° OC o LPN…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="pm-admin-search-clear" onClick={() => setBusqueda('')}>✕</button>
          )}
        </div>

        <div className="pm-t-fecha-wrap">
          <label className="pm-t-fecha-label">Fecha entrega</label>
          <input
            type="date"
            className="pm-t-fecha-input"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
          />
          {filtroFecha && (
            <button className="pm-admin-search-clear pm-t-fecha-clear" onClick={() => setFiltroFecha('')}>✕</button>
          )}
        </div>

        {filtroEstado !== 'todas' && (
          <button className="pm-admin-filtro-chip" onClick={() => setFiltroEstado('todas')}>
            {ESTADO_CFG[filtroEstado as EstadoAdmin].label} ✕
          </button>
        )}
      </div>

      {/* ── Carga / error ── */}
      {isLoading && <p className="cargando">Cargando sesiones…</p>}
      {isError   && <p className="error-msg">Error al cargar sesiones</p>}

      {/* ── Tabla ── */}
      {!isLoading && !isError && (
        filtradas.length === 0 ? (
          <div className="notas-vacio">
            <p>{busqueda || filtroFecha || filtroEstado !== 'todas' ? 'Sin resultados para ese filtro' : 'No hay sesiones de picking masivo'}</p>
          </div>
        ) : (
          <div className="pm-t-tabla-wrap">
            <table className="pm-t-tabla">
              <thead>
                <tr className="pm-t-thead-tr">
                  <th className="pm-t-th pm-t-th--id">Cliente / OC</th>
                  <th className="pm-t-th pm-t-th--prog">Progreso</th>
                  <th className="pm-t-th pm-t-th--entrega">Entrega</th>
                  <th className="pm-t-th pm-t-th--creacion">Creación</th>
                  <th className="pm-t-th pm-t-th--estado">Estado</th>
                  <th className="pm-t-th pm-t-th--acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(s => (
                  <OlaFila
                    key={s.id}
                    s={s}
                    onMonitorear={() => navigate(`/picking-masivo/${s.id}`)}
                    onCancelar={() => setConfirmCancelar(s.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Modal cancelar ── */}
      {confirmCancelar && (
        <div className="modal-overlay" onClick={() => setConfirmCancelar(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-titulo">¿Cancelar sesión?</h2>
            <p className="modal-desc">Esta acción no se puede deshacer. Las subtareas en progreso quedarán liberadas.</p>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setConfirmCancelar(null)}>Volver</button>
              <button
                className="btn-peligro"
                disabled={cancelar.isPending}
                onClick={() => handleCancelar(confirmCancelar)}
              >
                {cancelar.isPending ? 'Cancelando…' : 'Sí, cancelar sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
