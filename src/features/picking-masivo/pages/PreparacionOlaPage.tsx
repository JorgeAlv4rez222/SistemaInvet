import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOla, useLineasPreparacion, useEscanearLpnF2 } from '../hooks/useOlas'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'
import type { LineaLpn } from '../services/olas.api'
import { ApiResponseError } from '../../../shared/utils/apiClient'

// ── Íconos ────────────────────────────────────────────────────────────────────

function IcoBack() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IcoCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><polyline points="20 6 9 17 4 12"/></svg>
}
function IcoWarn() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function IcoScan() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="12" x2="17" y2="12.01"/></svg>
}
function IcoStore() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function IcoX() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function IcoCheckBig() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><polyline points="20 6 9 17 4 12"/></svg>
}

// ── Tarjeta flotante LPN ──────────────────────────────────────────────────────

function LpnFloatCard({
  lpn, lineas, olaId, operadorId,
  onClose, onConfirmado,
}: {
  lpn: string
  lineas: LineaLpn[]
  olaId: string
  operadorId: string
  onClose: () => void
  onConfirmado: () => void
}) {
  const escanear   = useEscanearLpnF2(olaId)
  const [carg, setCarg]   = useState(false)
  const [err,  setErr]    = useState<string | null>(null)

  const tienda   = lineas[0]?.tienda ?? '—'
  const orden    = lineas[0]?.ola_ordenes?.numero_orden ?? null
  const yaListo  = lineas.length > 0 && lineas.every(l => l.fase2_escaneado)
  const sufijo   = lpn.slice(-5)

  async function handleConfirmar() {
    setErr(null); setCarg(true)
    try {
      await escanear.mutateAsync({ lpn, usuarioId: operadorId })
      onConfirmado()
    } catch (e) {
      setErr(e instanceof ApiResponseError ? e.message : 'Error al confirmar LPN')
    } finally {
      setCarg(false)
    }
  }

  return (
    <div className="prep-float-backdrop" onClick={onClose}>
      <div className="prep-float-card" onClick={e => e.stopPropagation()}>
        {/* ── Cabecera ── */}
        <div className="prep-float-header">
          <div className="prep-float-lpn-inline">
            <span className="prep-float-lpn-label">LPN:</span>
            <span className="prep-float-lpn-num">{sufijo}</span>
          </div>
          <button className="prep-float-close" onClick={onClose}><IcoX /></button>
        </div>

        {/* ── Tienda ── */}
        <div className="prep-float-row">
          <span className="prep-float-lbl"><IcoStore /> TIENDA DESTINO</span>
          <span className="prep-float-val prep-float-val--big">{tienda}</span>
        </div>

        {/* ── Líneas: código + cantidad en fila ── */}
        {lineas.map(l => (
          <div key={l.id} className="prep-float-cod-qty">
            <div className="prep-float-row prep-float-row--half">
              <span className="prep-float-lbl">CÓDIGO</span>
              <span className="prep-float-val">{l.descripcion}</span>
            </div>
            <div className="prep-float-row prep-float-row--half">
              <span className="prep-float-lbl">CANTIDAD</span>
              <span className="prep-float-val prep-float-val--qty">{l.cantidad_solicitada}</span>
            </div>
          </div>
        ))}

        {err && <div className="cf-error-banner" style={{ margin: '8px 0 0' }}><IcoWarn /> {err}</div>}

        {/* ── Botón ── */}
        {yaListo ? (
          <div className="cf-scan-ok" style={{ fontSize: '0.95rem', padding: '14px' }}>
            <IcoCheckBig /> Este LPN ya fue confirmado
          </div>
        ) : (
          <button
            className="cf-carga-total-btn cf-carga-total-btn--confirm"
            style={{ marginTop: 12 }}
            disabled={carg}
            onClick={handleConfirmar}
          >
            {carg ? 'Guardando…' : 'Confirmar Productos'}
          </button>
        )}
      </div>
    </div>
  )
}

function fmtDt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mi = d.getMinutes().toString().padStart(2, '0')
  return `${dd}-${mm} ${hh}:${mi}`
}

// ── Tarjeta LPN ───────────────────────────────────────────────────────────────

function LpnCard({ lpn, lineas, resaltado }: { lpn: string; lineas: LineaLpn[]; resaltado: boolean }) {
  const escaneado   = lineas.every(l => l.fase2_escaneado)
  const tienda      = lineas[0]?.tienda ?? '—'
  const orden       = lineas[0]?.ola_ordenes?.numero_orden ?? null
  const totalUds    = lineas.reduce((s, l) => s + l.cantidad_solicitada, 0)
  const auditNombre = escaneado ? (lineas[0]?.fase2_por_nombre ?? null) : null
  const auditEn     = escaneado ? (lineas[0]?.fase2_en ?? null) : null

  return (
    <div className={`prep-lpn-card ${escaneado ? 'prep-lpn-card--done' : ''} ${resaltado ? 'prep-lpn-card--highlight' : ''}`}>
      {/* ── Cabecera LPN ── */}
      <div className="prep-lpn-header">
        <div className="prep-lpn-id-wrap">
          <span className="prep-lpn-id">{lpn}</span>
          {orden && <span className="prep-lpn-orden">OC: {orden}</span>}
        </div>
        <div className="prep-lpn-meta">
          {escaneado
            ? <span className="prep-lpn-badge prep-lpn-badge--ok"><IcoCheck /> Preparado</span>
            : <span className="prep-lpn-badge prep-lpn-badge--pend">{lineas.length} línea{lineas.length !== 1 ? 's' : ''} · {totalUds} Uds</span>
          }
        </div>
      </div>

      {/* ── Tienda ── */}
      <div className="prep-lpn-tienda">
        <IcoStore /> {tienda}
      </div>

      {/* ── Auditoría ── */}
      {escaneado && (auditNombre || auditEn) && (
        <div className="ext-audit">
          {auditNombre && <span className="ext-audit-quien">{auditNombre}</span>}
          {auditEn && <span className="ext-audit-cuando">{fmtDt(auditEn)}</span>}
        </div>
      )}

      {/* ── Líneas de producto ── */}
      <div className="prep-lpn-lineas">
        {lineas.map(l => (
          <div key={l.id} className={`prep-linea ${l.fase2_escaneado ? 'prep-linea--done' : ''}`}>
            <span className="prep-linea-desc">{l.descripcion}</span>
            <span className="prep-linea-cant">{l.cantidad_solicitada} Uds</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export function PreparacionOlaPage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const olaId       = id ?? ''
  const operadorId  = localStorage.getItem('user_id') ?? ''

  const { data: ola }                 = useOla(olaId)
  const { data, isLoading, isError }  = useLineasPreparacion(olaId)

  const [scanInput, setScanInput]     = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [filtro, setFiltro]           = useState<'todas' | 'pendientes' | 'listas'>('pendientes')
  const [lpnActivo, setLpnActivo]     = useState<string | null>(null)
  const inputRef                      = useRef<HTMLInputElement>(null)
  const resaltado: string | null      = null

  const lineas = data ?? []

  // Agrupar por LPN
  const porLpn = lineas.reduce<Record<string, LineaLpn[]>>((acc, l) => {
    ;(acc[l.lpn] ??= []).push(l)
    return acc
  }, {})
  const lpns = Object.keys(porLpn).sort()

  const totalLpns     = lpns.length
  const lpnsListos    = lpns.filter(lpn => porLpn[lpn].every(l => l.fase2_escaneado)).length
  const lpnsPendientes = totalLpns - lpnsListos
  const pct           = totalLpns > 0 ? Math.round((lpnsListos / totalLpns) * 100) : 0

  const lpnsFiltrados = lpns.filter(lpn => {
    const done = porLpn[lpn].every(l => l.fase2_escaneado)
    if (filtro === 'pendientes') return !done
    if (filtro === 'listas')    return done
    return true
  })

  const porCodigoBarra = lineas.reduce<Record<string, string>>((acc, l) => {
    if (l.codigo_barra)     acc[l.codigo_barra]     = l.lpn
    if (l.codigo_proveedor) acc[l.codigo_proveedor] = l.lpn
    return acc
  }, {})

  function resolverLpn(valor: string): string | null {
    if (porLpn[valor])         return valor
    if (porCodigoBarra[valor]) return porCodigoBarra[valor]
    const scan = valor.replace(/^0+/, '')
    for (const key of lpns) {
      if (key.replace(/^0+/, '') === scan) return key
    }
    if (valor.length >= 4) {
      const sufijo = valor.slice(-5)
      const matches = lpns.filter(key => key.endsWith(sufijo))
      if (matches.length === 1) return matches[0]
    }
    return null
  }

  function handleEscanear(valor: string) {
    const raw = valor.trim()
    if (!raw) return
    setError(null)
    const lpn = resolverLpn(raw)
    if (!lpn) {
      setError(`LPN no encontrado. Ingresa el número impreso bajo el código de barras.`)
      return
    }
    setLpnActivo(lpn)
    setScanInput('')
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
          <span className="sd-header-nombre">Preparación LPN — {proveedor}</span>
          {ola?.fecha_entrega && (
            <span className="sd-header-meta">Entrega: {ola.fecha_entrega}</span>
          )}
        </div>
      </div>

      {/* ── Barra de progreso ── */}
      <div className="cola-progreso-wrap">
        <div className="cola-progreso-meta">
          <span className="cola-progreso-label">PROGRESO FASE 2</span>
          <span className="cola-progreso-ratio">{lpnsListos} / {totalLpns} LPNs · {pct}%</span>
        </div>
        <div className="cola-progreso-bg">
          <div className="cola-progreso-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Escáner LPN ── */}
      <div className="prep-scanner-wrap">
        <div className="cf-scanner-header">
          <IcoScan />
          <span className="cf-scanner-label">Escanea el LPN</span>
        </div>
        <div className="cf-scanner-input-row">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className={`cf-scanner-input ${error ? 'cf-scanner-input--error' : ''}`}
            placeholder="Pistolear LPN aquí…"
            value={scanInput}
            autoFocus
            autoComplete="off"
            onChange={e => { setScanInput(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleEscanear(scanInput)}
          />
          <BarcodeScanner
            title="Escanear con cámara"
            onDetected={codigo => handleEscanear(codigo)}
          />
        </div>

        <button
          className="cf-btn cf-btn--verify"
          disabled={!scanInput.trim()}
          onClick={() => handleEscanear(scanInput)}
        >
          Ver productos del LPN
        </button>

        {error && <div className="cf-error-banner"><IcoWarn /> {error}</div>}
      </div>

      {/* ── Filtros ── */}
      <div className="sd-toolbar oc-toolbar">
        <div className="sd-filtros">
          {([
            ['pendientes', `Pendientes (${lpnsPendientes})`],
            ['listas',     `Preparados (${lpnsListos})`],
            ['todas',      `Todos (${totalLpns})`],
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

      {/* ── Lista de LPNs ── */}
      {isLoading && <p className="cargando">Cargando LPNs…</p>}
      {isError   && <p className="error-msg">Error al cargar las líneas</p>}

      {!isLoading && !isError && lpnsFiltrados.length === 0 && (
        <div className="sd-vacio">
          {filtro === 'listas' ? 'Aún no hay LPNs preparados' : 'Todos los LPNs están preparados'}
        </div>
      )}

      {!isLoading && !isError && lpnsFiltrados.length > 0 && (
        <div className="prep-lpn-lista">
          {lpnsFiltrados.map(lpn => (
            <LpnCard
              key={lpn}
              lpn={lpn}
              lineas={porLpn[lpn]}
              resaltado={resaltado === lpn}
            />
          ))}
        </div>
      )}

      {/* ── Tarjeta flotante ── */}
      {lpnActivo && porLpn[lpnActivo] && (
        <LpnFloatCard
          lpn={lpnActivo}
          lineas={porLpn[lpnActivo]}
          olaId={olaId}
          operadorId={operadorId}
          onClose={() => { setLpnActivo(null); inputRef.current?.focus() }}
          onConfirmado={() => { setLpnActivo(null); setScanInput(''); inputRef.current?.focus() }}
        />
      )}
    </div>
  )
}
