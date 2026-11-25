import { useDashboard } from '../hooks/useDashboard'
import { useOlas } from '../../picking-masivo/hooks/useOlas'

// ── Datos reales — flujo de trabajo ──────────────────────────────────────────
// Los estados de notas_venta se mapean directamente desde los KPIs del dashboard.

// ── Íconos ────────────────────────────────────────────────────────────────────

function IcoBox()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IcoClock()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function IcoTruck()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IcoFlow()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="4" rx="1"/><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="16" y="3" width="6" height="4" rx="1"/><path d="M5 7v4"/><path d="M12 7v4"/><path d="M19 7v4"/><rect x="2" y="11" width="6" height="4" rx="1"/><rect x="9" y="11" width="6" height="4" rx="1"/><rect x="16" y="11" width="6" height="4" rx="1"/></svg> }
function IcoFactory(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8l4-4 4 8 4-8 4 4v8H2z"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
function IcoCalendar(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }

// ── Barra de progreso ─────────────────────────────────────────────────────────

function BarraFlujo({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="tc-flujo-barra-bg">
      <div className="tc-flujo-barra-fill" style={{ width: `${pct}%`, background: color }}/>
    </div>
  )
}


// ── Componente principal ──────────────────────────────────────────────────────

function diasHasta(fechaISO: string): number {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const fecha = new Date(fechaISO + 'T00:00:00')
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
}

function urgenciaColor(dias: number): string {
  if (dias < 0)  return '#ef4444'
  if (dias === 0) return '#f97316'
  if (dias <= 2) return '#fbbf24'
  return '#00A0DF'
}

function urgenciaLabel(dias: number): string {
  if (dias < 0)  return `Vencida hace ${Math.abs(dias)}d`
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  return `En ${dias} días`
}

export function DashboardOperador() {
  const { data: kpis, isLoading } = useDashboard()
  const { data: olasRaw = [], isLoading: olasLoading } = useOlas()
  const nombre   = localStorage.getItem('user_nombre') ?? ''
  const mesActual = new Date().toLocaleString('es-CL', { month: 'long', year: 'numeric' })

  // Flujo de trabajo desde datos reales
  const pendientes   = kpis?.notasPendientes ?? 0
  const enPicking    = 0
  const listasAudit  = kpis?.notasDespacho ?? 0
  const despachadas  = 0

  const totalFlujo = pendientes + enPicking + listasAudit + despachadas

  const flujoItems = [
    { label: 'Pendientes de Picking',   cant: pendientes,  color: '#94a3b8' },
    { label: 'Listas para Despacho',    cant: listasAudit, color: '#fbbf24' },
  ]

  // Olas activas ordenadas por fecha_entrega
  const olasActivas = [...olasRaw]
    .filter(o => o.estado !== 'despachada' && o.estado !== 'cancelada' && o.fecha_entrega)
    .sort((a, b) => a.fecha_entrega.localeCompare(b.fecha_entrega))
    .slice(0, 5)

  return (
    <div className="tc-wrap">

      {/* ── Cabecera ────────────────────────────────────────────────────────── */}
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-header-title-row">
            <span className="tc-header-ico"><IcoFactory /></span>
            <h1 className="tc-titulo">Bienvenido{nombre && `, ${nombre}`}</h1>
          </div>
          <p className="bi-subtitulo">Operador de Bodega · Bodega Central Grantt — {mesActual}</p>
        </div>
      </div>
      <p className="notas-descripcion">Resumen de tu turno en curso. Revisa las notas de venta pendientes de picking y el estado general del flujo de trabajo en bodega.</p>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="bi-kpi-op-row">
        <div className={`bi-kpi-op ${pendientes > 0 ? 'bi-kpi-op--activo' : 'bi-kpi-op--inactivo'}`}>
          <div className="bi-kpi-op-icon"><IcoClock /></div>
          <div className="bi-kpi-op-body">
            <p className="bi-kpi-op-label">NV Pendientes</p>
            <p className="bi-kpi-op-valor">{isLoading ? '—' : pendientes}</p>
            {!isLoading && pendientes === 0 && <p className="bi-kpi-op-sub">Sin trabajo activo</p>}
          </div>
        </div>
        <div className={`bi-kpi-op ${listasAudit > 0 ? 'bi-kpi-op--activo' : 'bi-kpi-op--inactivo'}`}>
          <div className="bi-kpi-op-icon"><IcoTruck /></div>
          <div className="bi-kpi-op-body">
            <p className="bi-kpi-op-label">NV Completas</p>
            <p className="bi-kpi-op-valor">{isLoading ? '—' : listasAudit}</p>
            {!isLoading && listasAudit === 0 && <p className="bi-kpi-op-sub">Sin completadas hoy</p>}
          </div>
        </div>
      </div>

      {/* ── Cuerpo ──────────────────────────────────────────────────────────── */}
      <div className="tc-body">

        {/* ── Columna izquierda ──────────────────────────────────────────── */}
        <div className="tc-col-left">

          {/* Flujo de trabajo */}
          <div className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <h2 className="tc-panel-titulo"><IcoFlow /> Estado del Flujo de Trabajo</h2>
                <p className="tc-panel-sub">
                  {isLoading
                    ? 'Cargando…'
                    : `Distribución en tiempo real — ${totalFlujo} NVs totales`
                  }
                </p>
              </div>
            </div>
            <div className="tc-flujo-list">
              {flujoItems.map(f => {
                const pct = totalFlujo > 0 ? Math.round((f.cant / totalFlujo) * 100) : 0
                return (
                  <div key={f.label} className="tc-flujo-fila">
                    <div className="tc-flujo-label-row">
                      <span className="tc-flujo-dot" style={{ background: f.color }}/>
                      <span className="tc-flujo-label">{f.label}</span>
                      <span className="tc-flujo-cant" style={{ color: f.color }}>
                        {isLoading ? '—' : f.cant} NVs
                      </span>
                      <span className="tc-flujo-pct">{isLoading ? '' : `${pct}%`}</span>
                    </div>
                    <BarraFlujo pct={pct} color={f.color} />
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* ── Columna derecha — Picking Masivo próximo ────────────────────── */}
        <div className="tc-col-right">
          <div className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <h2 className="tc-panel-titulo"><IcoCalendar /> Picking Masivo</h2>
                <p className="tc-panel-sub">Órdenes activas por fecha de entrega</p>
              </div>
            </div>

            {olasLoading ? (
              <p className="tc-panel-empty">Cargando…</p>
            ) : olasActivas.length === 0 ? (
              <p className="tc-panel-empty">Sin órdenes activas</p>
            ) : (
              <div className="tc-pm-list">
                {olasActivas.map(ola => {
                  const dias = diasHasta(ola.fecha_entrega)
                  const color = urgenciaColor(dias)
                  const label = urgenciaLabel(dias)
                  const prov = ola.proveedor.charAt(0).toUpperCase() + ola.proveedor.slice(1)
                  const pct = ola.total_lineas > 0
                    ? Math.round(((ola.estado === 'completada' || ola.estado === 'despachada' ? ola.total_lineas : 0) / ola.total_lineas) * 100)
                    : 0
                  const fechaFmt = ola.fecha_entrega.split('-').reverse().join('/')
                  return (
                    <div key={ola.id} className="tc-pm-fila">
                      <div className="tc-pm-top">
                        <span className="tc-pm-proveedor">{prov}</span>
                        <span className="tc-pm-urgencia" style={{ color, borderColor: color }}>{label}</span>
                      </div>
                      <div className="tc-pm-meta">
                        <span className="tc-pm-fecha">{fechaFmt}</span>
                        <span className="tc-pm-estado">{ola.estado.replace('_', ' ')}</span>
                      </div>
                      <div className="tc-pm-barra-bg">
                        <div className="tc-pm-barra-fill" style={{ width: `${pct}%`, background: color }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
