import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesionesPicking } from '../hooks/usePickingMasivo'
import { useOlas } from '../hooks/useOlas'
import { useRealtimeSesiones } from '../hooks/useRealtimePicking'
import type { SesionResumen } from '../services/picking-masivo.api'
import type { OlaResumen } from '../services/olas.api'

const ROL = () => localStorage.getItem('user_rol') ?? ''

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return iso.slice(0, 10).split('-').reverse().join('-')
}

function IcoBuscar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function IcoUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IcoClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function IcoBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function IcoZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function IcoEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function IcoChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function SesionCard({ s, rol }: { s: SesionResumen; rol: string }) {
  const navigate   = useNavigate()
  const [open, setOpen] = useState(false)
  const pct        = s.total_items > 0 ? Math.round((s.items_completados / s.total_items) * 100) : 0
  const enProceso  = s.items_completados > 0
  const esImperial = (s.nombre_cliente ?? '').trim().toLowerCase().includes('imperial')
  const oc         = s.numero_oc_pedido ?? s.numero_oc
  const fechaEnt   = s.numero_oc
  const fillColor  = enProceso ? '#22c55e' : '#f59e0b'

  return (
    <div className={`ops-card ${enProceso ? 'ops-card--proceso' : 'ops-card--libre'}`}>

      {/* ── Fila principal (siempre visible) ── */}
      <div className="ops-card-row" onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}>

        <div className="ops-card-main">
          <span className="ops-card-cliente">{s.nombre_cliente ?? oc}</span>
          <div className="ops-card-meta">
            {esImperial ? (
              <span className="ops-meta-item ops-meta-item--lg">
                Entrega: <strong>{(() => {
                  const d = new Date(fechaEnt)
                  return isNaN(d.getTime()) ? fechaEnt
                    : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
                })()}</strong>
              </span>
            ) : (
              <>
                <span className="ops-meta-item ops-meta-item--lg">OC: <strong>{oc}</strong></span>
                <span className="ops-meta-sep">·</span>
                <span className="ops-meta-item ops-meta-item--lg">Entrega: <strong>{fmtFecha(fechaEnt)}</strong></span>
              </>
            )}
          </div>
          <div className="ops-progreso-inline">
            <div className="ops-barra-bg">
              <div className="ops-barra-fill" style={{ width: `${pct}%`, background: fillColor }} />
            </div>
            <span className="ops-progreso-inline-txt">
              {s.items_completados}/{s.total_items} Uds · {pct}%
            </span>
          </div>
        </div>

        <div className="ops-card-right">
          <div className="ops-meta-pills-v">
            <div className={`ops-badge ${enProceso ? 'ops-badge--proceso' : 'ops-badge--libre'}`}>
              <span className="ops-badge-dot" />
              EN PROCESO
            </div>
            <span className="ops-meta-pill"><IcoUsers /> {enProceso ? '1 Op. en zona' : 'Sin operador'}</span>
          </div>
          <span className="ops-chevron"><IcoChevron open={open} /></span>
        </div>
      </div>

      {/* ── Panel expandido ── */}
      {open && (
        <>
          <div className="ops-divider" />
          <div className="ops-card-expand">
            <button
              className="ops-btn ops-btn--tomar"
              onClick={e => { e.stopPropagation(); navigate(`/picking-masivo/operador/${s.id}`) }}
            >
              {enProceso ? 'UNIRSE A PICKING' : 'TOMAR SESIÓN'}
            </button>
            {(rol === 'supervisor' || rol === 'admin') && (
              <button
                className="ops-btn ops-btn--auditar"
                onClick={e => { e.stopPropagation(); navigate(`/picking-masivo/${s.id}`) }}
              >
                <IcoEye />
                AUDITAR EN VIVO
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Card de ola wave (Construmart / Imperial) ─────────────────────────────────

function OlaCard({ o, rol }: { o: OlaResumen; rol: string }) {
  const navigate   = useNavigate()
  const [open, setOpen] = useState(false)
  const proveedor  = o.proveedor.charAt(0).toUpperCase() + o.proveedor.slice(1)
  const fase       = o.estado === 'en_preparacion' ? 'Preparación LPN'
    : o.estado === 'completada' ? 'Completada'
    : 'Extracción'
  const completada = o.estado === 'completada'

  return (
    <div className={`ops-card ${completada ? 'ops-card--completada' : 'ops-card--proceso'}`}>
      <div className="ops-card-row" onClick={() => setOpen(v => !v)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(v => !v)}>

        <div className="ops-card-main">
          <span className="ops-card-cliente">{proveedor}</span>
          <div className="ops-card-meta">
            {o.fecha_entrega && (
              <span className="ops-meta-item ops-meta-item--lg">
                Entrega: <strong>{o.fecha_entrega}</strong>
              </span>
            )}
            <span className="ops-meta-sep">·</span>
            <span className="ops-meta-item">Fase: <strong>{fase}</strong></span>
          </div>
          <div className="ops-progreso-inline">
            <div className="ops-barra-bg">
              <div className="ops-barra-fill" style={{ width: '0%', background: '#22c55e' }} />
            </div>
            <span className="ops-progreso-inline-txt">{o.total_lineas} líneas</span>
          </div>
        </div>

        <div className="ops-card-right">
          <div className="ops-meta-pills-v">
            <div className={`ops-badge ${completada ? 'ops-badge--completada' : 'ops-badge--proceso'}`}>
              <span className="ops-badge-dot" />
              {completada ? 'COMPLETADA' : 'EN PROCESO'}
            </div>
          </div>
          <span className="ops-chevron"><IcoChevron open={open} /></span>
        </div>
      </div>

      {open && (
        <>
          <div className="ops-divider" />
          <div className="ops-card-expand">
            <button
              className="ops-btn ops-btn--tomar"
              onClick={e => { e.stopPropagation(); navigate(`/picking-masivo/ola/${o.id}`) }}
            >
              UNIRSE A PICKING
            </button>
            {(rol === 'supervisor' || rol === 'admin') && (
              <button
                className="ops-btn ops-btn--auditar"
                onClick={e => { e.stopPropagation(); navigate(`/picking-masivo/ola/${o.id}`) }}
              >
                <IcoEye />
                VER DETALLE
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export function OperadorSesionesPage() {
  const [busqueda, setBusqueda] = useState('')
  const { data: dataSes,  isLoading: loadSes,  isError: errSes  } = useSesionesPicking('en_proceso')
  const { data: dataOlas, isLoading: loadOlas, isError: errOlas } = useOlas()
  useRealtimeSesiones()

  const rol      = ROL()
  const sesiones = dataSes  ?? []
  const olas     = (dataOlas ?? []).filter(o => o.estado === 'en_extraccion' || o.estado === 'en_preparacion' || o.estado === 'completada')

  const isLoading = loadSes || loadOlas
  const isError   = errSes  || errOlas

  const q = busqueda.toLowerCase()
  const filtSes = !q ? sesiones : sesiones.filter(s =>
    (s.nombre_cliente ?? '').toLowerCase().includes(q) ||
    (s.numero_oc_pedido ?? '').toLowerCase().includes(q) ||
    s.numero_oc.toLowerCase().includes(q)
  )
  const filtOlas = !q ? olas : olas.filter(o =>
    o.proveedor.toLowerCase().includes(q) ||
    (o.fecha_entrega ?? '').includes(q)
  )

  const total = filtSes.length + filtOlas.length

  return (
    <div className="ops-wrap">

      {/* ── Cabecera ── */}
      <div className="ops-header">
        <h1 className="ops-titulo">Sesiones de Picking Masivo</h1>
      </div>

      {/* ── Búsqueda full width ── */}
      <div className="ops-search-full-wrap">
        <span className="ops-search-ico"><IcoBuscar /></span>
        <input
          className="ops-search-full"
          placeholder="Buscar por cliente o LPN…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button className="ops-search-clear" onClick={() => setBusqueda('')}>✕</button>
        )}
      </div>

      {/* ── Estados ── */}
      {isLoading && <p className="cargando">Cargando sesiones…</p>}
      {isError   && <p className="error-msg">Error al cargar sesiones</p>}
      {!isLoading && !isError && total === 0 && (
        <div className="notas-vacio">
          <p>{busqueda ? 'Sin resultados para esa búsqueda' : 'No hay sesiones activas en este momento'}</p>
        </div>
      )}

      {/* ── Lista ── */}
      {!isLoading && !isError && total > 0 && (
        <>
        <h2 className="ops-subtitulo">Listado de Proveedores</h2>
        <div className="ops-lista">
          {filtOlas.map(o => (
            <OlaCard key={o.id} o={o} rol={rol} />
          ))}
          {filtSes.map(s => (
            <SesionCard key={s.id} s={s} rol={rol} />
          ))}
        </div>
        </>
      )}
    </div>
  )
}
