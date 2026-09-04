import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesionesPicking, useCancelarSesion } from '../hooks/usePickingMasivo'
import { useRealtimeSesiones } from '../hooks/useRealtimePicking'
import type { SesionResumen } from '../services/picking-masivo.api'

// ── Derivar estado visual del admin ───────────────────────────────────────────

type EstadoAdmin = 'libre' | 'en_proceso' | 'completada' | 'despachada' | 'cancelada' | 'validando'

function derivarEstado(s: SesionResumen): EstadoAdmin {
  if (s.estado === 'cancelada')  return 'cancelada'
  if (s.estado === 'despachado') return 'despachada'
  if (s.estado === 'completada') return 'completada'
  if (s.estado === 'validando')  return 'validando'
  if (s.estado === 'activa')     return s.items_completados > 0 ? 'en_proceso' : 'libre'
  return 'libre'
}

const ESTADO_CONFIG: Record<EstadoAdmin, { label: string; color: string; dot: string }> = {
  libre:      { label: 'LIBRE EN COLA', color: 'pm-badge--libre',      dot: '#f59e0b' },
  en_proceso: { label: 'EN PROCESO',    color: 'pm-badge--proceso',    dot: '#22c55e' },
  completada: { label: 'COMPLETADA',    color: 'pm-badge--completada', dot: '#38bdf8' },
  despachada: { label: 'DESPACHADA',    color: 'pm-badge--despachada', dot: '#a78bfa' },
  cancelada:  { label: 'CANCELADA',     color: 'pm-badge--cancelada',  dot: '#f87171' },
  validando:  { label: 'VALIDANDO',     color: 'pm-badge--validando',  dot: '#94a3b8' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return iso.slice(0, 10).split('-').reverse().join('-')
}

function ProgressBar({ pct, estado }: { pct: number; estado: EstadoAdmin }) {
  const fillColor =
    estado === 'completada' || estado === 'despachada' ? '#38bdf8' :
    estado === 'en_proceso' ? '#22c55e' : '#f59e0b'
  return (
    <div className="pm-admin-barra-bg">
      <div
        className="pm-admin-barra-fill"
        style={{ width: `${Math.min(100, pct)}%`, background: fillColor }}
      />
    </div>
  )
}

// ── Tarjeta de sesión (Admin) ─────────────────────────────────────────────────

function OlaCard({
  s,
  onVerDetalle,
  onCancelar,
}: {
  s: SesionResumen
  onVerDetalle: () => void
  onCancelar: () => void
}) {
  const estado  = derivarEstado(s)
  const cfg     = ESTADO_CONFIG[estado]
  const pct     = s.total_items > 0 ? Math.round((s.items_completados / s.total_items) * 100) : 0
  const udsTxt  = `${s.items_completados.toLocaleString('es-CL')} / ${s.total_items.toLocaleString('es-CL')} Uds`
  const puedeEditar = estado === 'libre' || estado === 'validando'

  return (
    <div className={`pm-ola-card pm-ola-card--${estado}`}>

      {/* ── Cabecera ── */}
      <div className="pm-ola-header">
        <div className="pm-ola-header-left">
          <span className="pm-ola-cliente">{s.nombre_cliente ?? s.numero_oc}</span>
          <div className="pm-ola-meta">
            {s.numero_oc_pedido && (
              <>
                <span className="pm-ola-oc">OC: <strong>{s.numero_oc_pedido}</strong></span>
                <span className="pm-ola-sep">|</span>
              </>
            )}
            <span className="pm-ola-fecha-entrega">Entrega: <strong>{s.numero_oc}</strong></span>
            <span className="pm-ola-sep">|</span>
            <span className="pm-ola-fecha">Creada: {fmtFecha(s.creado_en)}</span>
            {s.creado_por_usuario && (
              <>
                <span className="pm-ola-sep">|</span>
                <span className="pm-ola-creador">por {s.creado_por_usuario.nombre}</span>
              </>
            )}
          </div>
        </div>
        <div className={`pm-admin-badge ${cfg.color}`}>
          <span className="pm-admin-badge-dot" style={{ background: cfg.dot }} />
          {cfg.label}
        </div>
      </div>

      {/* ── Divisor ── */}
      <div className="pm-ola-divider" />

      {/* ── Cuerpo ── */}
      <div className="pm-ola-body">

        {/* Progreso */}
        <div className="pm-ola-progreso">
          <div className="pm-ola-progreso-header">
            <span className="pm-ola-uds">{udsTxt}</span>
            <span className="pm-ola-pct">{pct}%</span>
          </div>
          <ProgressBar pct={pct} estado={estado} />
        </div>

        {/* Operadores */}
        <div className="pm-ola-operadores">
          {estado === 'en_proceso' ? null
          : estado === 'libre' || estado === 'validando' ? (
            <span className="pm-ola-esperando">
              👤 Esperando primer operador en bodega
            </span>
          ) : estado === 'completada' ? (
            <span className="pm-ola-completada-txt">
              ✅ Completada{s.completada_en ? ` el ${fmtFecha(s.completada_en)}` : ''}
            </span>
          ) : estado === 'despachada' ? (
            <span className="pm-ola-completada-txt">
              Despachada por {s.nombre_chofer ?? '—'}{s.despachado_en ? ` · ${fmtFecha(s.despachado_en)}` : ''}
            </span>
          ) : (
            <span className="pm-ola-cancelada-txt">🚫 Sesión cancelada</span>
          )}
        </div>

        {/* Acciones */}
        <div className="pm-ola-acciones">
          <button
            className="pm-ola-btn pm-ola-btn--monitoreo"
            onClick={onVerDetalle}
          >
            {estado === 'despachada' || estado === 'cancelada' ? 'Ver detalle' : 'Ver monitoreo'}
          </button>

          {puedeEditar && (
            <>
              <button
                className="pm-ola-btn pm-ola-btn--editar"
                onClick={onVerDetalle}
              >
                ✏️ EDITAR
              </button>
              <button
                className="pm-ola-btn pm-ola-btn--cancelar"
                onClick={(e) => { e.stopPropagation(); onCancelar() }}
              >
                🚫 CANCELAR
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export function PickingMasivoPage() {
  const navigate  = useNavigate()
  const ROL       = localStorage.getItem('user_rol') ?? ''
  const userId    = localStorage.getItem('user_id')  ?? ''
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoAdmin | 'todas'>('todas')
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null)

  const { data, isLoading, isError } = useSesionesPicking()
  const cancelar = useCancelarSesion()
  useRealtimeSesiones()

  const sesiones = data ?? []

  // ── KPIs de resumen ─────────────────────────────────────────────────────────
  const activas     = sesiones.filter(s => s.estado === 'activa' && s.items_completados > 0)
  const libres      = sesiones.filter(s => (s.estado === 'activa' && s.items_completados === 0) || s.estado === 'validando')
  const completadas = sesiones.filter(s => s.estado === 'completada' || s.estado === 'despachado')
  const udsEnPicking = activas.reduce((acc, s) => acc + s.total_items, 0)

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const filtradas = sesiones.filter(s => {
    const q = busqueda.toLowerCase()
    const matchBusq = !q ||
      (s.nombre_cliente ?? '').toLowerCase().includes(q) ||
      s.numero_oc.toLowerCase().includes(q) ||
      (s.numero_oc_pedido ?? '').toLowerCase().includes(q)

    const estado = derivarEstado(s)
    const matchEstado = filtroEstado === 'todas' ||
      estado === filtroEstado ||
      (filtroEstado === 'completada' && estado === 'despachada')

    return matchBusq && matchEstado
  })

  // ── Cancelar sesión ─────────────────────────────────────────────────────────
  function handleCancelar(sesionId: string) {
    cancelar.mutate(sesionId, {
      onSuccess: () => setConfirmCancelar(null),
    })
  }

  // ── Operador: redirigir a su vista ──────────────────────────────────────────
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
            + Nueva Sesión
          </button>
        )}
      </div>

      {/* ── KPIs resumen ── */}
      <div className="pm-admin-kpis">
        <button
          className={`pm-admin-kpi pm-admin-kpi--proceso ${filtroEstado === 'en_proceso' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => setFiltroEstado(f => f === 'en_proceso' ? 'todas' : 'en_proceso')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{activas.length}</span>
            <span className="pm-admin-kpi-label">Sesiones Activas</span>
          </div>
        </button>

<button
          className={`pm-admin-kpi pm-admin-kpi--libre ${filtroEstado === 'libre' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => setFiltroEstado(f => f === 'libre' ? 'todas' : 'libre')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{libres.length}</span>
            <span className="pm-admin-kpi-label">Libre / Pendiente</span>
          </div>
        </button>

        <button
          className={`pm-admin-kpi pm-admin-kpi--completadas ${filtroEstado === 'completada' ? 'pm-admin-kpi--activo' : ''}`}
          onClick={() => setFiltroEstado(f => f === 'completada' ? 'todas' : 'completada')}
        >
          <span className="pm-admin-kpi-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <div>
            <span className="pm-admin-kpi-val">{completadas.length}</span>
            <span className="pm-admin-kpi-label">Completadas</span>
          </div>
        </button>
      </div>

      {/* ── Barra de búsqueda ── */}
      <div className="pm-admin-search-row">
        <div className="pm-admin-search-wrap">
          <span className="pm-admin-search-ico">🔍</span>
          <input
            className="pm-admin-search"
            placeholder="Buscar por OC, cliente o LPN…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="pm-admin-search-clear" onClick={() => setBusqueda('')}>✕</button>
          )}
        </div>
        {filtroEstado !== 'todas' && (
          <button className="pm-admin-filtro-chip" onClick={() => setFiltroEstado('todas')}>
            {ESTADO_CONFIG[filtroEstado].label} ✕
          </button>
        )}
      </div>

      {/* ── Estados de carga ── */}
      {isLoading && <p className="cargando">Cargando sesiones…</p>}
      {isError   && <p className="error-msg">Error al cargar sesiones</p>}

      {/* ── Lista de olas ── */}
      {!isLoading && !isError && (
        <>
          {filtradas.length === 0 && (
            <div className="notas-vacio">
              <p>{busqueda || filtroEstado !== 'todas' ? 'Sin resultados para ese filtro' : 'No hay sesiones de picking masivo'}</p>
            </div>
          )}

          <div className="pm-admin-lista">
            {filtradas.map(s => (
              <OlaCard
                key={s.id}
                s={s}
                onVerDetalle={() => navigate(`/picking-masivo/${s.id}`)}
                onCancelar={() => setConfirmCancelar(s.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Modal confirmar cancelación ── */}
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
