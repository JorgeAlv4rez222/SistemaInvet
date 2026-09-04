import { useState, useEffect } from 'react'
import { useDashboard } from '../hooks/useDashboard'

// ── Datos mock — sustituir con queries reales ─────────────────────────────

const PICKINGS_POR_HORA = [
  { hora: '07:00', cant: 28 },
  { hora: '08:00', cant: 41 },
  { hora: '09:00', cant: 47 },
  { hora: '10:00', cant: 52 },
  { hora: '11:00', cant: 38 },
  { hora: '12:00', cant: 44 },
  { hora: '13:00', cant: 49 },
  { hora: '14:00', cant: 31 },
]

const EQUIPO_MOCK = [
  { nombre: 'Luis Hernández',   avance: 85, ritmo: 52, estado: 'activo'   },
  { nombre: 'Jorge Alvarez',    avance: 72, ritmo: 48, estado: 'auditando' },
  { nombre: 'Ana Martínez',     avance: 60, ritmo: 41, estado: 'pausa'    },
  { nombre: 'Juan Contreras',   avance: 40, ritmo: 28, estado: 'detenido' },
  { nombre: 'María Soto',       avance: 90, ritmo: 55, estado: 'activo'   },
]

const FLUJO_MOCK = [
  { label: 'Pendientes de Asignar', cant: 14, color: '#94a3b8' },
  { label: 'En Picking Activo',     cant: 22, color: '#38bdf8' },
  { label: 'Listas para Auditoría', cant: 18, color: '#fbbf24' },
  { label: 'Despachadas en Camión', cant: 12, color: '#34d399' },
]

const ESTADO_CFG: Record<string, { label: string; color: string; dot: string }> = {
  activo:    { label: 'Picking Activo', color: '#34d399', dot: '#34d399' },
  auditando: { label: 'Auditando',      color: '#38bdf8', dot: '#38bdf8' },
  pausa:     { label: 'Pausa / RACK',   color: '#fbbf24', dot: '#fbbf24' },
  detenido:  { label: 'Detenido',       color: '#f87171', dot: '#f87171' },
}

// ── Íconos ────────────────────────────────────────────────────────────────

function IcoBox()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IcoClock()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function IcoTruck()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IcoAlert()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IcoUsers()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IcoChart()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IcoFlow()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="4" rx="1"/><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="16" y="3" width="6" height="4" rx="1"/><path d="M5 7v4"/><path d="M12 7v4"/><path d="M19 7v4"/><rect x="2" y="11" width="6" height="4" rx="1"/><rect x="9" y="11" width="6" height="4" rx="1"/><rect x="16" y="11" width="6" height="4" rx="1"/></svg> }
function IcoZap()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function IcoFactory(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8l4-4 4 8 4-8 4 4v8H2z"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }

// ── Gráfico de picking por hora (SVG) ─────────────────────────────────────

function GraficoPickingHora() {
  const data  = PICKINGS_POR_HORA
  const maxV  = Math.max(1, ...data.map(d => d.cant))
  const W = 480; const H = 160; const PAD_B = 28; const PAD_L = 32; const PAD_T = 14
  const areaW = W - PAD_L - 8
  const areaH = H - PAD_B - PAD_T
  const barW  = (areaW / data.length) * 0.55
  const gap   = areaW / data.length

  const yGrids = [0, 25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grilla */}
      {yGrids.map(pct => {
        const y = PAD_T + areaH - (pct / 100) * areaH
        return (
          <g key={pct}>
            <line x1={PAD_L} y1={y} x2={W - 4} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth={0.8}/>
            <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize={7} fill="rgba(148,163,184,0.5)">
              {Math.round(maxV * pct / 100)}
            </text>
          </g>
        )
      })}

      {/* Barras */}
      {data.map((d, i) => {
        const alt = Math.max(3, (d.cant / maxV) * areaH)
        const x   = PAD_L + i * gap + (gap - barW) / 2
        const y   = PAD_T + areaH - alt
        const isLast = i === data.length - 1
        return (
          <g key={d.hora}>
            <title>{d.hora}: {d.cant} pickings</title>
            <rect x={x} y={y} width={barW} height={alt} rx={3}
              fill={isLast ? 'rgba(56,189,248,0.5)' : '#0ea5e9'}
              opacity={isLast ? 0.7 : 1}
            />
            {/* Valor encima */}
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={7.5} fontWeight="700" fill="rgba(148,163,184,0.85)">
              {d.cant}
            </text>
            {/* Etiqueta hora */}
            <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize={7.5} fill="rgba(148,163,184,0.6)">
              {d.hora}
            </text>
          </g>
        )
      })}

      {/* Línea promedio */}
      {(() => {
        const avg = data.reduce((s, d) => s + d.cant, 0) / data.length
        const yAvg = PAD_T + areaH - (avg / maxV) * areaH
        return (
          <g>
            <line x1={PAD_L} y1={yAvg} x2={W - 4} y2={yAvg}
              stroke="rgba(251,191,36,0.5)" strokeWidth={1} strokeDasharray="4 3"/>
            <text x={W - 5} y={yAvg - 3} textAnchor="end" fontSize={7} fill="rgba(251,191,36,0.7)">
              prom.
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

// ── Barra de progreso de avance ───────────────────────────────────────────

function BarraAvance({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="tc-avance-bg">
      <div className="tc-avance-fill" style={{ width: `${pct}%`, background: color }}/>
    </div>
  )
}

// ── Reloj en tiempo real ──────────────────────────────────────────────────

function RelojTurno() {
  const [hora, setHora] = useState(() =>
    new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(() => {
      setHora(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tc-reloj">{hora}</span>
}

// ── Componente principal ──────────────────────────────────────────────────

export function DashboardOperador() {
  const { data: kpis } = useDashboard()

  const totalFlujo = FLUJO_MOCK.reduce((s, f) => s + f.cant, 0)

  return (
    <div className="tc-wrap">

      {/* ── Cabecera Torre de Control ─────────────────────────────────── */}
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-header-title-row">
            <span className="tc-header-ico"><IcoFactory /></span>
            <h1 className="tc-titulo">Torre de Control — Producción Bodega</h1>
          </div>
          <div className="tc-header-badges">
            <span className="tc-badge-turno">Turno Mañana</span>
            <span className="tc-badge-operadores">
              <span className="tc-dot-verde"/>
              {EQUIPO_MOCK.filter(e => e.estado === 'activo' || e.estado === 'auditando').length} Operadores Activos
            </span>
            <span className="tc-badge-rt">
              <IcoZap /> Actualización en tiempo real
            </span>
          </div>
        </div>
        <RelojTurno />
      </div>

      {/* ── KPIs producción ───────────────────────────────────────────── */}
      <div className="tc-kpi-row">

        <div className="tc-kpi-card tc-kpi-ok">
          <div className="tc-kpi-ico"><IcoBox /></div>
          <div className="tc-kpi-body">
            <p className="tc-kpi-label">Ritmo de Picking (UPH)</p>
            <p className="tc-kpi-valor">342 <span className="tc-kpi-unit">Uds/Hora</span></p>
            <p className="tc-kpi-delta tc-delta-green">▲ +8% sobre la meta</p>
          </div>
        </div>

        <div className="tc-kpi-card tc-kpi-info">
          <div className="tc-kpi-ico"><IcoClock /></div>
          <div className="tc-kpi-body">
            <p className="tc-kpi-label">Tiempo Ciclo Promedio</p>
            <p className="tc-kpi-valor">8.4 <span className="tc-kpi-unit">min/pedido</span></p>
            <p className="tc-kpi-delta tc-delta-blue">🎯 Target: 10.0 min</p>
          </div>
        </div>

        <div className="tc-kpi-card tc-kpi-neutral">
          <div className="tc-kpi-ico"><IcoTruck /></div>
          <div className="tc-kpi-body">
            <p className="tc-kpi-label">Bultos Listos para Salida</p>
            <p className="tc-kpi-valor">{kpis?.notasDespacho ?? 128} <span className="tc-kpi-unit">Bultos</span></p>
            <p className="tc-kpi-delta tc-delta-muted">📦 12 Pallets armados</p>
          </div>
        </div>

        <div className="tc-kpi-card tc-kpi-alerta">
          <div className="tc-kpi-ico"><IcoAlert /></div>
          <div className="tc-kpi-body">
            <p className="tc-kpi-label">Incidencias y Quiebres</p>
            <p className="tc-kpi-valor">2 <span className="tc-kpi-unit">SKUs sin stock</span></p>
            <p className="tc-kpi-delta tc-delta-red">🔴 Requieren reabastecer</p>
          </div>
        </div>

      </div>

      {/* ── Cuerpo 55/45 ─────────────────────────────────────────────── */}
      <div className="tc-body">

        {/* ── Columna izquierda ──────────────────────────────────────── */}
        <div className="tc-col-left">

          {/* Gráfico picking por hora */}
          <div className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <h2 className="tc-panel-titulo"><IcoChart /> Ritmo de Preparación por Hora</h2>
                <p className="tc-panel-sub">Pickings completados — turno actual hora a hora</p>
              </div>
              <span className="tc-badge-live">EN VIVO</span>
            </div>
            <GraficoPickingHora />
          </div>

          {/* Flujo de trabajo */}
          <div className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <h2 className="tc-panel-titulo"><IcoFlow /> Estado del Flujo de Trabajo</h2>
                <p className="tc-panel-sub">Distribución en tiempo real — {totalFlujo} NVs totales</p>
              </div>
            </div>
            <div className="tc-flujo-list">
              {FLUJO_MOCK.map(f => {
                const pct = Math.round((f.cant / totalFlujo) * 100)
                return (
                  <div key={f.label} className="tc-flujo-fila">
                    <div className="tc-flujo-label-row">
                      <span className="tc-flujo-dot" style={{ background: f.color }}/>
                      <span className="tc-flujo-label">{f.label}</span>
                      <span className="tc-flujo-cant" style={{ color: f.color }}>{f.cant} NVs</span>
                      <span className="tc-flujo-pct">{pct}%</span>
                    </div>
                    <div className="tc-flujo-barra-bg">
                      <div className="tc-flujo-barra-fill" style={{ width: `${pct}%`, background: f.color }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* ── Columna derecha ────────────────────────────────────────── */}
        <div className="tc-col-right">

          {/* Tabla productividad equipo */}
          <div className="tc-panel tc-panel-full">
            <div className="tc-panel-header">
              <div>
                <h2 className="tc-panel-titulo"><IcoUsers /> Productividad del Equipo</h2>
                <p className="tc-panel-sub">Avance de cuota y ritmo — turno en curso</p>
              </div>
            </div>
            <div className="tc-equipo-list">
              {EQUIPO_MOCK.map((op, i) => {
                const cfg = ESTADO_CFG[op.estado]
                return (
                  <div key={op.nombre} className="tc-equipo-fila">
                    <span className="tc-equipo-rank">{i + 1}</span>
                    <div className="tc-equipo-info">
                      <span className="tc-equipo-nombre">{op.nombre}</span>
                      <BarraAvance pct={op.avance} color={cfg.dot} />
                    </div>
                    <span className="tc-equipo-ritmo">{op.ritmo} <span className="tc-equipo-unit">L/h</span></span>
                    <span className="tc-equipo-avance-pct" style={{ color: cfg.dot }}>{op.avance}%</span>
                    <span className="tc-estado-badge" style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: `${cfg.color}12` }}>
                      <span className="tc-estado-dot" style={{ background: cfg.dot }}/>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
