import { useState, useEffect, useRef } from 'react'
import { useProduccion } from '../hooks/useProduccion'
import { TIPOS_TAREA, type TipoTarea } from '../api/produccionClient'
import type { RegistroProduccion } from '../api/produccionClient'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'

// ── Helpers ────────────────────────────────────────────────────────────────────
function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function duracionMin(inicio: string, fin: string): number {
  return Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
}

function cumplimientoPct(logradas: number | null, meta: number): number {
  if (!logradas || meta === 0) return 0
  return Math.round((logradas / meta) * 100)
}

function useTimer(inicio: string | null): string {
  const [, setTick] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!inicio) return
    ref.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [inicio])
  if (!inicio) return '00:00'
  const seg = Math.floor((Date.now() - new Date(inicio).getTime()) / 1000)
  const m = Math.floor(seg / 60).toString().padStart(2, '0')
  const s = (seg % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Icono escanear ─────────────────────────────────────────────────────────────
const IcoScan = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12" strokeWidth={2.2}/>
    <line x1="12" y1="7" x2="12" y2="17" strokeWidth={2.2}/>
  </svg>
)

// ── Formulario nueva tarea ─────────────────────────────────────────────────────
type Sugerencia = { sku: string; nombre: string }

function FormIniciar({ onIniciar }: { onIniciar: (p: { tipoTarea: TipoTarea; sku: string; unidadesMeta: number }) => Promise<void> }) {
  const [tipo,  setTipo]  = useState<TipoTarea>('etiquetado')
  const [sku,   setSku]   = useState('')
  const [meta,  setMeta]  = useState('')
  const [carg,  setCarg]  = useState(false)
  const [err,   setErr]   = useState<string | null>(null)
  const [sugs,  setSugs]  = useState<Sugerencia[]>([])
  const [showSugs, setShowSugs] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSugs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSkuChange(val: string) {
    setSku(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = val.trim()
    if (term.length < 2) { setSugs([]); setShowSugs(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('auth_token') ?? ''
        const res = await fetch(`/api/productos?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const raw = await res.json()
        const arr: Array<{ sku: string; nombre: string }> = Array.isArray(raw) ? raw : (raw.productos ?? raw.items ?? [])
        const lista: Sugerencia[] = arr.slice(0, 8).map(p => ({ sku: p.sku, nombre: p.nombre }))
        setSugs(lista)
        setShowSugs(lista.length > 0)
      } catch { /* silencioso */ }
    }, 300)
  }

  function seleccionarSku(s: Sugerencia) {
    setSku(s.sku)
    setShowSugs(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const unidadesMeta = parseInt(meta, 10)
    if (!sku.trim() || !unidadesMeta || unidadesMeta <= 0) return
    setCarg(true); setErr(null)
    try {
      await onIniciar({ tipoTarea: tipo, sku: sku.trim().toUpperCase(), unidadesMeta })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al iniciar tarea')
    } finally {
      setCarg(false)
    }
  }

  return (
    <form className="ep-card" onSubmit={handleSubmit}>
      <h2 className="ep-card-title">Nueva tarea</h2>

      <div className="ep-field">
        <label className="ep-label">Tipo de tarea</label>
        <select className="ep-select" value={tipo} onChange={e => setTipo(e.target.value as TipoTarea)}>
          {TIPOS_TAREA.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="ep-field">
        <label className="ep-label">Producto / SKU</label>
        <div className="ep-sku-wrap" ref={wrapRef}>
          <div className="ep-input-scan-row">
            <input
              className="ep-input ep-input--sku"
              type="text"
              placeholder="Ej: 0452"
              value={sku}
              onChange={e => handleSkuChange(e.target.value)}
              onFocus={() => { if (sugs.length > 0) setShowSugs(true) }}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <div className="ep-scan-btn-wrap">
              <BarcodeScanner onDetected={val => { setSku(val); setShowSugs(false) }} title="Escanear código" />
            </div>
          </div>
          {showSugs && (
            <ul className="ep-sugs">
              {sugs.map(s => (
                <li key={s.sku} className="ep-sug-item" onMouseDown={() => seleccionarSku(s)}>
                  <span className="ep-sug-sku">{s.sku}</span>
                  <span className="ep-sug-nombre">{s.nombre}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="ep-field">
        <label className="ep-label">Unidades meta</label>
        <input
          className="ep-input"
          type="number"
          min={1}
          placeholder="Ej: 100"
          value={meta}
          onChange={e => setMeta(e.target.value)}
          inputMode="numeric"
        />
      </div>

      {err && <p className="ep-error">{err}</p>}

      <button className="ep-btn-primary" type="submit" disabled={carg || !sku.trim() || !meta}>
        {carg ? 'Iniciando…' : 'Iniciar tarea'}
      </button>
    </form>
  )
}

// ── Tarjeta tarea activa ───────────────────────────────────────────────────────
function TareaActivaCard({ tarea, onCerrar }: { tarea: RegistroProduccion; onCerrar: (p: { unidadesLogradas: number; observaciones: string }) => Promise<void> }) {
  const [logradas, setLogradas] = useState('')
  const [obs,      setObs]      = useState('')
  const [carg,     setCarg]     = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const timer    = useTimer(tarea.hora_inicio)
  const tipoLabel = TIPOS_TAREA.find(t => t.value === tarea.tipo_tarea)?.label ?? tarea.tipo_tarea

  async function handleCerrar(e: React.FormEvent) {
    e.preventDefault()
    const unidadesLogradas = parseInt(logradas, 10)
    if (isNaN(unidadesLogradas) || unidadesLogradas < 0) return
    setCarg(true); setErr(null)
    try { await onCerrar({ unidadesLogradas, observaciones: obs }) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Error al cerrar tarea') }
    finally { setCarg(false) }
  }

  return (
    <div className="ep-activa-card">
      <div className="ep-activa-top">
        <span className="ep-badge-curso">EN CURSO</span>
        <span className="ep-timer">{timer}</span>
      </div>

      <div className="ep-activa-info">
        <div className="ep-info-row"><span className="ep-info-lbl">Tarea</span><span className="ep-info-val">{tipoLabel}</span></div>
        <div className="ep-info-row"><span className="ep-info-lbl">SKU</span><span className="ep-info-val ep-info-sku">{tarea.sku}</span></div>
        <div className="ep-info-row"><span className="ep-info-lbl">Inicio</span><span className="ep-info-val">{horaLocal(tarea.hora_inicio)}</span></div>
        <div className="ep-info-row"><span className="ep-info-lbl">Meta</span><span className="ep-info-val">{tarea.unidades_meta} Uds</span></div>
      </div>

      <form className="ep-cierre-form" onSubmit={handleCerrar}>
        <div className="ep-field">
          <label className="ep-label">Unidades logradas</label>
          <input className="ep-input ep-input--big" type="number" min={0} placeholder="0"
            value={logradas} onChange={e => setLogradas(e.target.value)} inputMode="numeric" />
        </div>
        <div className="ep-field">
          <label className="ep-label">Observaciones</label>
          <textarea className="ep-textarea" placeholder="Tipo de tarea, incidencias…"
            rows={3} value={obs} onChange={e => setObs(e.target.value)} />
        </div>
        {err && <p className="ep-error">{err}</p>}
        <button className="ep-btn-cerrar" type="submit" disabled={carg || logradas === ''}>
          {carg ? 'Guardando…' : 'Cerrar tarea'}
        </button>
      </form>
    </div>
  )
}

// ── Fila historial ─────────────────────────────────────────────────────────────
function RegistroRow({ r }: { r: RegistroProduccion }) {
  const pct   = cumplimientoPct(r.unidades_logradas, r.unidades_meta)
  const dur   = r.hora_fin ? duracionMin(r.hora_inicio, r.hora_fin) : null
  const color = pct >= 100 ? 'ep-pct--ok' : pct >= 80 ? 'ep-pct--warn' : 'ep-pct--low'
  const tipoLabel = TIPOS_TAREA.find(t => t.value === r.tipo_tarea)?.label ?? r.tipo_tarea

  return (
    <div className="ep-reg-row">
      <div className="ep-reg-top">
        <span className="ep-reg-sku">{r.sku}</span>
        <span className={`ep-reg-pct ${color}`}>{pct}%</span>
      </div>
      <div className="ep-reg-mid">
        <span className="ep-reg-tipo">{tipoLabel}</span>
        <span className="ep-reg-uds">{r.unidades_logradas ?? 0} / {r.unidades_meta} Uds</span>
      </div>
      <div className="ep-reg-hora">
        {horaLocal(r.hora_inicio)}{r.hora_fin ? ` → ${horaLocal(r.hora_fin)}` : ''}
        {dur !== null ? ` · ${dur} min` : ''}
      </div>
      {r.observaciones && <div className="ep-reg-obs">{r.observaciones}</div>}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export function ProduccionPage() {
  const usuarioId = localStorage.getItem('user_id') ?? ''
  const nombre    = localStorage.getItem('user_nombre') ?? ''

  const { tareaActiva, registros, cargando, error, iniciar, cerrar } = useProduccion(usuarioId)

  const totalHoy    = registros.length
  const totalUds    = registros.reduce((s, r) => s + (r.unidades_logradas ?? 0), 0)
  const pctPromedio = totalHoy > 0
    ? Math.round(registros.reduce((s, r) => s + cumplimientoPct(r.unidades_logradas, r.unidades_meta), 0) / totalHoy)
    : null

  const fechaTexto = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase())

  if (cargando) return <div className="ep-page"><p className="ep-loading">Cargando…</p></div>

  return (
    <div className="ep-page">
      {/* Título de sección */}
      <div className="ep-header">
        <h1 className="ep-titulo">Control de Producción</h1>
        <p className="ep-subtitulo">{fechaTexto} · {nombre}</p>
      </div>

      {error && <p className="ep-error ep-error--banner">{error}</p>}

      {/* Resumen del día */}
      {totalHoy > 0 && (
        <div className="ep-resumen">
          <div className="ep-stat"><span className="ep-stat-val">{totalHoy}</span><span className="ep-stat-lbl">Tareas</span></div>
          <div className="ep-stat"><span className="ep-stat-val">{totalUds.toLocaleString('es-CL')}</span><span className="ep-stat-lbl">Unidades</span></div>
          {pctPromedio !== null && (
            <div className="ep-stat">
              <span className={`ep-stat-val ${pctPromedio >= 100 ? 'ep-pct--ok' : pctPromedio >= 80 ? 'ep-pct--warn' : 'ep-pct--low'}`}>{pctPromedio}%</span>
              <span className="ep-stat-lbl">Cumplimiento</span>
            </div>
          )}
        </div>
      )}

      {/* Tarea activa o formulario */}
      {tareaActiva
        ? <TareaActivaCard tarea={tareaActiva} onCerrar={cerrar} />
        : <FormIniciar onIniciar={iniciar} />
      }

      {/* Historial del día */}
      {registros.length > 0 && (
        <section className="ep-historial">
          <h3 className="ep-historial-titulo">Registros de hoy</h3>
          {registros.map(r => <RegistroRow key={r.id} r={r} />)}
        </section>
      )}
    </div>
  )
}
