import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { produccionClient, TIPOS_TAREA, type RegistroProduccion } from '../api/produccionClient'

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function duracionMin(inicio: string, fin: string | null): number | null {
  if (!fin) return null
  return Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
}

function cumplimientoPct(logradas: number | null, meta: number): number {
  if (!logradas || meta === 0) return 0
  return Math.round((logradas / meta) * 100)
}

type Filtros = {
  fechaDesde: string
  fechaHasta: string
  sku:        string
}

function ResumenStats({ registros }: { registros: RegistroProduccion[] }) {
  const completados = registros.filter(r => r.hora_fin !== null)
  const totalUds    = completados.reduce((s, r) => s + (r.unidades_logradas ?? 0), 0)
  const totalMeta   = completados.reduce((s, r) => s + r.unidades_meta, 0)
  const pctGlobal   = totalMeta > 0 ? Math.round((totalUds / totalMeta) * 100) : null

  // Agrupar por SKU para el potencial dashboard
  const porSku = new Map<string, { meta: number; logradas: number; tareas: number }>()
  for (const r of completados) {
    const e = porSku.get(r.sku) ?? { meta: 0, logradas: 0, tareas: 0 }
    e.meta     += r.unidades_meta
    e.logradas += r.unidades_logradas ?? 0
    e.tareas   += 1
    porSku.set(r.sku, e)
  }
  const topSkus = Array.from(porSku.entries())
    .sort((a, b) => b[1].logradas - a[1].logradas)
    .slice(0, 5)

  return (
    <div className="pa-resumen-wrap">
      {/* KPIs globales */}
      <div className="pa-kpis">
        <div className="pa-kpi">
          <span className="pa-kpi-val">{registros.length}</span>
          <span className="pa-kpi-lbl">Tareas registradas</span>
        </div>
        <div className="pa-kpi">
          <span className="pa-kpi-val">{completados.length}</span>
          <span className="pa-kpi-lbl">Completadas</span>
        </div>
        <div className="pa-kpi">
          <span className="pa-kpi-val">{totalUds.toLocaleString('es-CL')}</span>
          <span className="pa-kpi-lbl">Unidades logradas</span>
        </div>
        <div className="pa-kpi">
          <span className="pa-kpi-val">{totalMeta.toLocaleString('es-CL')}</span>
          <span className="pa-kpi-lbl">Unidades meta</span>
        </div>
        {pctGlobal !== null && (
          <div className="pa-kpi">
            <span className={`pa-kpi-val ${pctGlobal >= 100 ? 'prod-pct--ok' : pctGlobal >= 80 ? 'prod-pct--warn' : 'prod-pct--low'}`}>
              {pctGlobal}%
            </span>
            <span className="pa-kpi-lbl">Cumplimiento global</span>
          </div>
        )}
      </div>

      {/* Top SKUs */}
      {topSkus.length > 0 && (
        <div className="pa-top-skus">
          <h3 className="pa-section-title">Top productos por unidades</h3>
          <div className="pa-sku-list">
            {topSkus.map(([sku, stats]) => {
              const pct = stats.meta > 0 ? Math.round((stats.logradas / stats.meta) * 100) : 0
              const barW = Math.min(pct, 100)
              return (
                <div key={sku} className="pa-sku-row">
                  <div className="pa-sku-row-top">
                    <span className="pa-sku-code">{sku}</span>
                    <span className="pa-sku-uds">{stats.logradas.toLocaleString('es-CL')} Uds</span>
                    <span className={`pa-sku-pct ${pct >= 100 ? 'prod-pct--ok' : pct >= 80 ? 'prod-pct--warn' : 'prod-pct--low'}`}>{pct}%</span>
                  </div>
                  <div className="pa-bar-bg">
                    <div className="pa-bar-fill" style={{ width: `${barW}%`, background: pct >= 100 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function exportarExcel(registros: RegistroProduccion[], filtros: Filtros) {
  const tipoLabel = (t: string) => TIPOS_TAREA.find(x => x.value === t)?.label ?? t

  const filas = registros.map(r => {
    const pct = cumplimientoPct(r.unidades_logradas, r.unidades_meta)
    const dur = duracionMin(r.hora_inicio, r.hora_fin)
    return {
      'Fecha':            fechaLocal(r.hora_inicio),
      'Hora Inicio':      horaLocal(r.hora_inicio),
      'Hora Fin':         r.hora_fin ? horaLocal(r.hora_fin) : '',
      'Duración (min)':   dur ?? '',
      'Operador':         r.usuario_nombre ?? '',
      'SKU':              r.sku,
      'Tipo de Tarea':    tipoLabel(r.tipo_tarea),
      'Unidades Meta':    r.unidades_meta,
      'Unidades Logradas':r.unidades_logradas ?? '',
      '% Cumplimiento':   r.hora_fin ? `${pct}%` : '',
      'Observaciones':    r.observaciones ?? '',
    }
  })

  const ws  = XLSX.utils.json_to_sheet(filas)
  const wb  = XLSX.utils.book_new()

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 20 }, { wch: 16 }, { wch: 20 },
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 30 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Produccion')

  const skuTag  = filtros.sku ? `_${filtros.sku}` : ''
  const nombre  = `produccion${skuTag}_${filtros.fechaDesde}_${filtros.fechaHasta}.xlsx`
  XLSX.writeFile(wb, nombre)
}

export function ProduccionAdminPage() {
  const [filtros, setFiltros] = useState<Filtros>({ fechaDesde: fechaHoy(), fechaHasta: fechaHoy(), sku: '' })
  const [skuInput, setSkuInput] = useState('')
  const [registros, setRegistros]   = useState<RegistroProduccion[]>([])
  const [cargando,  setCargando]    = useState(false)
  const [error,     setError]       = useState<string | null>(null)

  const cargar = useCallback(async (f: Filtros) => {
    setCargando(true); setError(null)
    try {
      const data = await produccionClient.obtenerRegistros({
        fechaDesde: f.fechaDesde,
        fechaHasta: f.fechaHasta,
        sku:        f.sku || undefined,
      })
      setRegistros(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar(filtros) }, []) // eslint-disable-line

  function aplicar() {
    const nuevo = { ...filtros, sku: skuInput.trim().toUpperCase() }
    setFiltros(nuevo)
    cargar(nuevo)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') aplicar()
  }

  const tipoLabel = (t: string) => TIPOS_TAREA.find(x => x.value === t)?.label ?? t

  return (
    <div className="pa-page">
      <div className="pa-header">
        <h1 className="pa-titulo">Control de Producción</h1>
        <p className="pa-subtitulo">Vista administrador</p>
      </div>
      <p className="notas-descripcion">Seguimiento de tareas productivas. Registra tiempos, unidades logradas y metas para medir el rendimiento de cada turno.</p>

      {/* Filtros */}
      <div className="pa-filtros">
        <div className="pa-filtro-group">
          <label className="prod-label">Desde</label>
          <input
            type="date"
            className="prod-input pa-input-fecha"
            value={filtros.fechaDesde}
            onChange={e => setFiltros(f => ({ ...f, fechaDesde: e.target.value }))}
          />
        </div>
        <div className="pa-filtro-group">
          <label className="prod-label">Hasta</label>
          <input
            type="date"
            className="prod-input pa-input-fecha"
            value={filtros.fechaHasta}
            onChange={e => setFiltros(f => ({ ...f, fechaHasta: e.target.value }))}
          />
        </div>
        <div className="pa-filtro-group pa-filtro-sku">
          <label className="prod-label">SKU / Código</label>
          <input
            type="text"
            className="prod-input"
            placeholder="Filtrar por SKU…"
            value={skuInput}
            onChange={e => setSkuInput(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>
        <button className="prod-btn-primary pa-btn-buscar" onClick={aplicar} disabled={cargando}>
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error && <p className="prod-error prod-error--banner">{error}</p>}

      {/* Resumen / KPIs */}
      {!cargando && registros.length > 0 && <ResumenStats registros={registros} />}

      {/* Tabla detalle */}
      {!cargando && registros.length === 0 && (
        <p className="pa-empty">No hay registros para los filtros seleccionados.</p>
      )}

      {registros.length > 0 && (
        <div className="pa-tabla-wrap">
          <div className="pa-tabla-header">
            <h3 className="pa-section-title">Detalle de registros ({registros.length})</h3>
            <button className="pa-btn-excel" onClick={() => exportarExcel(registros, filtros)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/>
              </svg>
              Exportar Excel
            </button>
          </div>
          <div className="pa-tabla-scroll">
            <table className="pa-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Min</th>
                  <th>Operador</th>
                  <th>SKU</th>
                  <th>Tipo</th>
                  <th>Meta</th>
                  <th>Logradas</th>
                  <th>%</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => {
                  const pct = cumplimientoPct(r.unidades_logradas, r.unidades_meta)
                  const dur = duracionMin(r.hora_inicio, r.hora_fin)
                  return (
                    <tr key={r.id}>
                      <td>{fechaLocal(r.hora_inicio)}</td>
                      <td className="pa-td-mono">{horaLocal(r.hora_inicio)}</td>
                      <td className="pa-td-mono">{r.hora_fin ? horaLocal(r.hora_fin) : '—'}</td>
                      <td className="pa-td-mono">{dur !== null ? dur : '—'}</td>
                      <td>{r.usuario_nombre ?? '—'}</td>
                      <td className="pa-td-sku">{r.sku}</td>
                      <td>{tipoLabel(r.tipo_tarea)}</td>
                      <td className="pa-td-num">{r.unidades_meta}</td>
                      <td className="pa-td-num">{r.unidades_logradas ?? '—'}</td>
                      <td className={`pa-td-num ${pct >= 100 ? 'prod-pct--ok' : pct >= 80 ? 'prod-pct--warn' : r.hora_fin ? 'prod-pct--low' : ''}`}>
                        {r.hora_fin ? `${pct}%` : '—'}
                      </td>
                      <td className="pa-td-obs">{r.observaciones ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
