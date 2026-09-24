import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard, useDespachosMensuales, useDespachosSemana, useDespachosDia } from '../hooks/useDashboard'
import type { DiaDespacho } from '../hooks/useDashboard'

// ── Tipos ─────────────────────────────────────────────────────────────────

type Periodo = 'mes' | 'trimestre' | 'semestre' | 'anio'

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'mes',       label: 'Este Mes'          },
  { key: 'trimestre', label: 'Último Trimestre'  },
  { key: 'semestre',  label: 'Último Semestre'   },
  { key: 'anio',      label: 'Este Año'           },
]

// ── Datos mock — sustituir con queries reales ──────────────────────────────


const ACTIVIDAD_MOCK = [
  { hora: '15:42', texto: '@jorge_alvarez completó auditoría NV-128762',          tipo: 'ok'    },
  { hora: '15:10', texto: '@operador_luis inició picking NV-128770',               tipo: 'info'  },
  { hora: '14:30', texto: 'Ingreso de stock 45 uds SKU: BO-PLPE27B-N',            tipo: 'stock' },
  { hora: '12:15', texto: 'Etiqueta Rack B-N3 generada',                          tipo: 'label' },
  { hora: '11:48', texto: '@operador_carlos finalizó traslado Rack A → Rack B',   tipo: 'ok'    },
  { hora: '10:20', texto: 'Alerta: SKU TK-3382 bajo mínimo de reorden',           tipo: 'warn'  },
]

const ACCIONES_RAPIDAS = [
  { label: 'Cargar Nota PDF',      emoji: '➕', ruta: '/ingresos'              },
  { label: 'Imprimir Etiquetas',   emoji: '🏷️', ruta: '/etiquetas'             },
  { label: 'Picking Masivo LPN',   emoji: '📦', ruta: '/picking-masivo'        },
  { label: 'Registrar Traslado',   emoji: '🔄', ruta: '/traslados'             },
]

const ZONAS_BODEGA = [
  { nombre: 'ZONA RACK A (Alta Rotación)', pct: 94, alerta: true  },
  { nombre: 'ZONA RACK B (General)',       pct: 75, alerta: false },
  { nombre: 'ZONA PISO (Recepciones)',     pct: 60, alerta: false },
  { nombre: 'MEZANINE (Temporada)',        pct: 48, alerta: false },
]

const ALERTAS_MOCK = [
  { tipo: 'warning', texto: '3 SKUs con stock crítico (cerca del punto de reorden)' },
  { tipo: 'info',    texto: '14 SKUs sin movimiento (>90 días sin salida)' },
  { tipo: 'warning', texto: '2 proveedores con demoras de entrega >45 min' },
]

// ── Íconos compactos ──────────────────────────────────────────────────────

function IcoBox()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IcoImport()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg> }
function IcoAlertTri(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IcoTarget()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> }
function IcoClock()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function IcoCheck()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }
function IcoTruck()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IcoWarehouse(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg> }
function IcoAlert()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IcoExport()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function IcoChart()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IcoActivity(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function IcoZap()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }

// ── Card KPI operacional (fila superior, interactiva) ─────────────────────

function KpiOp({
  icon, label, valor, sub, alerta, onClick,
}: {
  icon:    React.ReactNode
  label:   string
  valor:   number | string
  sub?:    string
  alerta?: boolean
  onClick?: () => void
}) {
  return (
    <button
      className={`bi-kpi-op ${alerta ? 'bi-kpi-op--alerta' : valor === 0 || valor === '0' ? 'bi-kpi-op--inactivo' : 'bi-kpi-op--activo'}`}
      onClick={onClick}
      type="button"
    >
      <div className="bi-kpi-op-icon">{icon}</div>
      <div className="bi-kpi-op-body">
        <p className="bi-kpi-op-label">{label}</p>
        <p className="bi-kpi-op-valor">{valor}</p>
        {sub && <p className="bi-kpi-op-sub">{sub}</p>}
      </div>
      {alerta && <span className="bi-kpi-op-badge">!</span>}
    </button>
  )
}

// ── Card KPI ejecutivo ────────────────────────────────────────────────────

function KpiExec({
  icon, label, valor, unidad, delta, deltaLabel, colorDelta,
}: {
  icon:       React.ReactNode
  label:      string
  valor:      string
  unidad?:    string
  delta?:     string
  deltaLabel?:string
  colorDelta?:'green' | 'blue' | 'amber' | 'red'
}) {
  const deltaColors: Record<string, string> = {
    green: 'text-emerald-400 bg-emerald-500/10',
    blue:  'text-sky-400 bg-sky-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red:   'text-red-400 bg-red-500/10',
  }
  return (
    <div className="bi-kpi-card">
      <div className="bi-kpi-icon">{icon}</div>
      <div className="bi-kpi-label">{label}</div>
      <div className="bi-kpi-valor">
        {valor}
        {unidad && <span className="bi-kpi-unidad">{unidad}</span>}
      </div>
      {delta && (
        <div className={`bi-kpi-delta ${deltaColors[colorDelta ?? 'green']}`}>
          {delta}
          {deltaLabel && <span className="bi-kpi-delta-label">{deltaLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ── Gráfico barras diarias (SVG) ──────────────────────────────────────────

function GraficoDiario({ data, diaActivo, onClickDia }: { data: DiaDespacho[]; diaActivo: string | null; onClickDia: (dia: string) => void }) {
  if (data.length === 0) return <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Cargando…</div>
  const maxV  = Math.max(1, ...data.map(d => d.cant))
  const W = 340; const H = 110; const PAD_B = 24; const PAD_L = 28
  const areaW = W - PAD_L; const areaH = H - PAD_B - 8
  const barW  = (areaW / data.length) * 0.5
  const gap   = areaW / data.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" style={{ cursor: 'pointer' }}>
      {[0, 50, 100].map(pct => {
        const y = 8 + areaH - (pct / 100) * areaH
        return (
          <g key={pct}>
            <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="rgba(148,163,184,0.1)" strokeWidth={0.8}/>
            <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize={7} fill="rgba(148,163,184,0.5)">
              {Math.round(maxV * pct / 100)}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const activo = diaActivo === d.dia
        const alt = Math.max(3, (d.cant / maxV) * areaH)
        const x   = PAD_L + i * gap + (gap - barW) / 2
        const y   = 8 + areaH - alt
        return (
          <g key={d.dia} onClick={() => d.cant > 0 && onClickDia(d.dia)} style={{ cursor: d.cant > 0 ? 'pointer' : 'default' }}>
            <title>{d.label}: {d.cant} despachos — {d.cant > 0 ? 'click para ver detalle' : ''}</title>
            <rect x={x} y={y} width={barW} height={alt} rx={3} fill={activo ? '#38bdf8' : '#0ea5e9'} opacity={activo ? 1 : 0.75}/>
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={7} fill="rgba(148,163,184,0.7)">{d.cant}</text>
            <text x={x + barW / 2} y={H - 8}  textAnchor="middle" fontSize={8} fill={activo ? 'var(--text-primary)' : 'rgba(148,163,184,0.6)'} fontWeight={activo ? 700 : 400}>{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Barra de ocupación ────────────────────────────────────────────────────

function BarraOcupacion({ nombre, pct, alerta }: { nombre: string; pct: number; alerta: boolean }) {
  const color = alerta ? '#f87171' : pct > 70 ? '#fb923c' : '#34d399'
  return (
    <div className="bi-zona">
      <div className="bi-zona-header">
        <span className="bi-zona-nombre">{nombre}</span>
        <span className="bi-zona-pct" style={{ color }}>
          {pct}% {alerta && '🔴'}
        </span>
      </div>
      <div className="bi-zona-barra-bg">
        <div
          className="bi-zona-barra-fill"
          style={{ width: `${pct}%`, background: color }}
        />
        {/* Línea de 80% */}
        <div className="bi-zona-limite" />
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────

export function DashboardBI() {
  const navigate = useNavigate()
  const [periodo, setPeriodo]       = useState<Periodo>('mes')
  const [dropOpen, setDropOpen]     = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  const { data: kpis, isLoading: kpisLoading } = useDashboard()
  useDespachosMensuales({})
  const { data: semanaData } = useDespachosSemana()
  const { data: notasDia, isLoading: cargandoDia } = useDespachosDia(diaSeleccionado)

  const mesActual    = new Date().toLocaleString('es-CL', { month: 'long', year: 'numeric' })
  const periodoLabel = PERIODOS.find(p => p.key === periodo)?.label ?? ''

  function toggleDia(dia: string) {
    setDiaSeleccionado(prev => prev === dia ? null : dia)
  }

  function labelFecha(dia: string) {
    const d = new Date(`${dia}T12:00:00`)
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div className="bi-wrap">

      {/* ── Cabecera BI ─────────────────────────────────────────────────── */}
      <div className="bi-header">
        <div className="bi-header-left">
          <h1 className="bi-titulo">
            <span className="bi-titulo-ico"><IcoChart /></span>
            Dashboard de Gestión Logística
          </h1>
          <p className="bi-subtitulo">Bodega Central Grantt — {mesActual}</p>
        </div>
        <div className="bi-header-actions">
          {/* Selector período */}
          <div className="bi-periodo-wrap">
            <button
              className="bi-periodo-btn"
              onClick={() => setDropOpen(o => !o)}
            >
              {periodoLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {dropOpen && (
              <div className="bi-periodo-menu">
                {PERIODOS.map(p => (
                  <button
                    key={p.key}
                    className={`bi-periodo-item ${periodo === p.key ? 'active' : ''}`}
                    onClick={() => { setPeriodo(p.key); setDropOpen(false) }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Exportar */}
        </div>
      </div>

      {/* ── Fila KPIs operacionales (estado en tiempo real) ──────────────── */}
      <div className="bi-kpi-op-row">
        <KpiOp
          icon={<IcoBox />}
          label="NV en preparación"
          valor={kpisLoading ? '—' : kpis?.notasPendientes ?? 0}
          sub={!kpisLoading && !kpis?.notasPendientes ? 'Sin trabajo activo' : undefined}
          onClick={() => navigate('/notas')}
        />
        <KpiOp
          icon={<IcoImport />}
          label="Imp. en tránsito"
          valor={kpisLoading ? '—' : kpis?.ocPendientes ?? 0}
          sub={!kpisLoading && !kpis?.ocPendientes ? 'Sin importaciones' : undefined}
          onClick={() => navigate('/ingresos')}
        />
        <KpiOp
          icon={<IcoTruck />}
          label="NV por revisar"
          valor={kpisLoading ? '—' : kpis?.notasDespacho ?? 0}
          sub={!kpisLoading && (kpis?.notasDespacho ?? 0) > 0 ? '¡Requiere atención!' : 'Sin pendientes'}
          alerta={!kpisLoading && (kpis?.notasDespacho ?? 0) > 0}
          onClick={() => navigate('/salidas')}
        />
      </div>

      {/* ── Cuerpo principal 60/40 ───────────────────────────────────────── */}
      <div className="bi-body">

        {/* ── Columna izquierda (60%) ─────────────────────────────────── */}
        <div className="bi-col-left">

          {/* Tarjeta: Despachos de la semana */}
          <div className="bi-panel">
            <div className="bi-panel-header">
              <div>
                <h2 className="bi-panel-titulo"><IcoTruck /> Despachos de la Semana</h2>
                <p className="bi-panel-sub">Click en una barra para ver el detalle del día</p>
              </div>
              {diaSeleccionado && (
                <button className="bi-dia-cerrar" onClick={() => setDiaSeleccionado(null)}>✕</button>
              )}
            </div>
            <GraficoDiario data={semanaData?.dias ?? []} diaActivo={diaSeleccionado} onClickDia={toggleDia} />

            {/* Panel detalle notas del día */}
            {diaSeleccionado && (
              <div className="bi-dia-detalle">
                <p className="bi-dia-detalle-titulo">
                  {labelFecha(diaSeleccionado)}
                  <span className="bi-dia-detalle-count">
                    {cargandoDia ? '…' : `${notasDia?.length ?? 0} NV`}
                  </span>
                </p>
                {cargandoDia && <p className="bi-dia-detalle-loading">Cargando…</p>}
                {!cargandoDia && notasDia?.length === 0 && (
                  <p className="bi-dia-detalle-vacio">Sin notas despachadas ese día</p>
                )}
                {!cargandoDia && (notasDia ?? []).map(n => {
                  const ruta = n.tipo === 'nv' ? `/notas/${n.id}` : n.tipo === 'sesion' ? `/picking-masivo/${n.id}` : `/picking-masivo/ola/${n.id}`
                  const tipoBadge = n.tipo === 'nv' ? 'NV' : n.tipo === 'sesion' ? 'PM' : 'OLA'
                  const badgeColor = n.tipo === 'nv' ? '#34d399' : n.tipo === 'sesion' ? '#f59e0b' : '#a78bfa'
                  return (
                    <button key={n.id} className="bi-dia-nota-row" onClick={() => navigate(ruta)}>
                      <span className="bi-dia-nota-tipo" style={{ color: badgeColor }}>{tipoBadge}</span>
                      <span className="bi-dia-nota-num">{n.referencia}</span>
                      <span className="bi-dia-nota-cliente">{n.nombreCliente}</span>
                      <span className="bi-dia-nota-hora">
                        {new Date(n.fechaDespacho).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Columna derecha (40%) ───────────────────────────────────── */}
        <div className="bi-col-right">

          {/* Actividad reciente */}
          <div className="bi-panel">
            <div className="bi-panel-header">
              <div>
                <h2 className="bi-panel-titulo"><IcoActivity /> Actividad Reciente</h2>
                <p className="bi-panel-sub">Auditoría del turno en curso</p>
              </div>
            </div>
            <div className="bi-actividad-list">
              {(biData?.actividadReciente ?? []).length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                  {biData ? 'Sin actividad reciente' : 'Cargando…'}
                </p>
              )}
              {(biData?.actividadReciente ?? []).map((ev, i) => (
                <div key={i} className={`bi-actividad-item bi-act-${ev.tipo}`}>
                  <span className="bi-act-hora">{ev.hora}</span>
                  <span className="bi-act-dot"/>
                  <span className="bi-act-texto">{ev.texto}</span>
                </div>
              ))}
            </div>
          </div>


        </div>
      </div>

      {/* ── Fila KPIs ejecutivos ─────────────────────────────────────────── */}
      <div className="bi-kpi-row">
        <KpiExec
          icon={<IcoTruck />}
          label="Pedidos Despachados"
          valor={biData ? biData.despachados7dias.toLocaleString('es-CL') : '—'}
          delta=""
          deltaLabel="últimos 7 días"
          colorDelta="green"
        />
      </div>
    </div>
  )
}
