import { useState, useMemo } from 'react'
import { useMovimientos, useMovimientosPorIngreso, useMovimientosPorNota, useListaOCs, useProductosPorOC, useMovimientosPorOCYProducto } from '../hooks/useHistorial'
import { TIPOS_MOVIMIENTO, TIPO_LABELS } from '../services/historial.api'
import type { MovimientoHistorial, ObtenerMovimientosInput, OCResumen, ProductoEnOC } from '../services/historial.api'
import { useNotas } from '../../notas/hooks/useNotas'
import type { NotaResumen } from '../../notas/services/notas.api'

const LIMITE = 50

// ── Íconos ────────────────────────────────────────────────────────────────

function IconFiltro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function IconHistorial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={48} height={48}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

// ── Colores por tipo de movimiento ────────────────────────────────────────

const TIPO_CONFIG: Record<string, { color: string; bg: string; icono: string }> = {
  ingreso:              { color: '#86efac', bg: 'rgba(34,197,94,0.15)',   icono: '↓' },
  ingreso_parcial:      { color: '#86efac', bg: 'rgba(34,197,94,0.10)',   icono: '↓' },
  salida:               { color: '#fca5a5', bg: 'rgba(239,68,68,0.15)',   icono: '↑' },
  salida_parcial:       { color: '#fca5a5', bg: 'rgba(239,68,68,0.10)',   icono: '↑' },
  traslado_reubicacion: { color: '#93c5fd', bg: 'rgba(59,130,246,0.15)',  icono: '→' },
  traslado_intercambio: { color: '#c4b5fd', bg: 'rgba(139,92,246,0.15)', icono: '⇄' },
  equivalente_usado:    { color: '#fde68a', bg: 'rgba(245,158,11,0.15)',  icono: '≈' },
  cambio_estado_nota:   { color: '#7dd3fc', bg: 'rgba(14,165,233,0.15)',  icono: '✎' },
  despacho:             { color: '#f9a8d4', bg: 'rgba(236,72,153,0.15)', icono: '▶' },
}

function BadgeTipo({ tipo }: { tipo: string }) {
  const cfg = TIPO_CONFIG[tipo] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icono: '•' }
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border border-transparent whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '40' }}
    >
      <span className="text-[12px] leading-none">{cfg.icono}</span>
      {TIPO_LABELS[tipo] ?? tipo}
    </span>
  )
}

// Resalta usuario, SKU y número de nota en el texto del detalle
function resaltarDetalle(texto: string, usuario: string, notaNumero?: string | null): React.ReactNode[] {
  const patrones: { re: RegExp; clase: string }[] = []
  if (usuario)    patrones.push({ re: new RegExp(usuario.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), clase: 'hist-hl-usuario' })
  if (notaNumero) patrones.push({ re: new RegExp(notaNumero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), clase: 'hist-hl-nota' })
  patrones.push({ re: /[A-Z]{2,5}[\/\-][A-Z]{1,5}[A-Z0-9\-\/]*/g, clase: 'hist-hl-sku' })

  const partes: { texto: string; clase?: string }[] = [{ texto }]

  for (const { re, clase } of patrones) {
    const resultado: { texto: string; clase?: string }[] = []
    for (const parte of partes) {
      if (parte.clase) { resultado.push(parte); continue }
      let ultimo = 0
      let m: RegExpExecArray | null
      re.lastIndex = 0
      while ((m = re.exec(parte.texto)) !== null) {
        if (m.index > ultimo) resultado.push({ texto: parte.texto.slice(ultimo, m.index) })
        resultado.push({ texto: m[0], clase })
        ultimo = m.index + m[0].length
      }
      if (ultimo < parte.texto.length) resultado.push({ texto: parte.texto.slice(ultimo) })
    }
    partes.splice(0, partes.length, ...resultado)
  }

  return partes.map((p, i) =>
    p.clase ? <span key={i} className={p.clase}>{p.texto}</span> : p.texto
  )
}

// ── Tarjeta de movimiento ─────────────────────────────────────────────────

function MovimientoCard({
  m,
  onDetalle,
}: {
  m:          MovimientoHistorial
  onDetalle:  ((ctx: DetalleContexto) => void) | null
}) {
  const fecha = m.fecha.slice(0, 16).replace('T', ' ')
  const [dia, hora] = fecha.split(' ')

  return (
    <div className="flex flex-col gap-2 bg-[var(--bg-surface)] rounded-xl px-4 py-3 shadow-sm transition-colors duration-150 hover:bg-[var(--bg-elevated)] tablet:flex-row tablet:items-start tablet:gap-4">
      {/* Columna izquierda: badge + fecha */}
      <div className="flex flex-row items-center justify-between w-full shrink-0 tablet:flex-col tablet:items-start tablet:gap-1.5 tablet:w-auto tablet:min-w-[130px] desktop:min-w-[140px]">
        <BadgeTipo tipo={m.tipo} />
        <div className="flex flex-col gap-px">
          <span className="text-[11px] text-[var(--text-muted)]">{dia}</span>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)] tabular-nums">{hora}</span>
        </div>
      </div>

      {/* Cuerpo: texto + meta */}
      <div className="flex-1 flex flex-col gap-1.5">
        <p className="text-base text-[var(--text-primary)] leading-[1.4]">
          {resaltarDetalle(m.detalle, m.usuario, m.notaNumero)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {m.usuario}
          </span>

          {m.cantidad !== null && (
            <span className="text-[11px] font-bold text-[var(--accent-light)] bg-[rgba(2,132,199,0.15)] px-1.5 py-0.5 rounded">
              {m.cantidad} Und.
            </span>
          )}

          {m.ubicacion && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#86efac] bg-[rgba(34,197,94,0.12)] px-1.5 py-0.5 rounded font-mono">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={11} height={11}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {m.ubicacion}
            </span>
          )}

          {m.importacionCodigo && onDetalle && (
            <button
              className="inline-flex items-center text-[12px] text-[var(--accent-light)] bg-[rgba(2,132,199,0.12)] border border-[rgba(125,211,252,0.25)] rounded px-2.5 py-1.5 min-h-8 cursor-pointer transition-colors hover:bg-[rgba(2,132,199,0.25)]"
              onClick={() => onDetalle({ tipo: 'ingreso', importacionId: m.movimientoId, codigo: m.importacionCodigo! })}
            >
              Importación {m.importacionCodigo}
            </button>
          )}

          {m.notaNumero && m.notaVentaId && onDetalle && (
            <button
              className="inline-flex items-center text-[12px] font-bold text-[#4ade80] bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.3)] rounded px-2.5 py-1.5 min-h-8 cursor-pointer transition-colors hover:bg-[rgba(74,222,128,0.22)]"
              onClick={() => onDetalle({ tipo: 'nota', notaId: m.notaVentaId!, numero: m.notaNumero! })}
            >
              Nota {m.notaNumero}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta agrupada por nota ─────────────────────────────────────────────

const TIPOS_NOTA = new Set(['salida', 'salida_parcial', 'equivalente_usado', 'cambio_estado_nota', 'despacho'])

function NotaGrupoCard({
  numero,
  movimientos,
  onDetalle,
}: {
  numero:      string
  movimientos: MovimientoHistorial[]
  onDetalle:   ((ctx: DetalleContexto) => void) | null
}) {
  const [abierto, setAbierto] = useState(false)

  // Primer movimiento de la nota para tomar usuario y movimientoId
  const primero  = movimientos[0]
  const usuarios = Array.from(new Set(movimientos.map((m) => m.usuario))).join(', ')
  const totalUds = movimientos.reduce((s, m) => s + (m.cantidad ?? 0), 0)

  // Tipos únicos presentes
  const tiposPresentes = Array.from(new Set(movimientos.map((m) => m.tipo)))

  return (
    <div className={`hist-nota-grupo${abierto ? ' abierto' : ''}`}>
      <button className="hist-nota-grupo-header" onClick={() => setAbierto((v) => !v)}>
        <div className="hist-nota-grupo-left">
          <span className="hist-nota-grupo-nv">NV {numero}</span>
          <div className="hist-nota-grupo-badges">
            {tiposPresentes.map((t) => <BadgeTipo key={t} tipo={t} />)}
          </div>
        </div>
        <div className="hist-nota-grupo-right">
          <span className="hist-nota-grupo-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {usuarios}
          </span>
          <span className="hist-nota-grupo-meta">
            {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
            {totalUds > 0 && <> · {totalUds} Und.</>}
          </span>
          {onDetalle && primero.notaVentaId && (
            <button
              className="inline-flex items-center text-[12px] font-bold text-[#4ade80] bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.3)] rounded px-2.5 py-1.5 min-h-8 cursor-pointer transition-colors hover:bg-[rgba(74,222,128,0.22)]"
              onClick={(e) => { e.stopPropagation(); onDetalle({ tipo: 'nota', notaId: primero.notaVentaId!, numero }) }}
            >
              Ver nota
            </button>
          )}
          <span className={`hist-nota-grupo-chevron${abierto ? ' abierto' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </button>

      {abierto && (
        <div className="hist-nota-grupo-items">
          {movimientos.map((m) => (
            <MovimientoCard key={m.movimientoId} m={m} onDetalle={null} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lista de movimientos ──────────────────────────────────────────────────

function ListaMovimientos({
  movimientos,
  onDetalle,
}: {
  movimientos: MovimientoHistorial[]
  onDetalle:   ((ctx: DetalleContexto) => void) | null
}) {
  if (movimientos.length === 0) {
    return <p className="vacio">Sin movimientos en este rango</p>
  }

  function formatearDia(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Agrupar por día, y dentro de cada día agrupar por nota los movimientos asociados
  const diasMap = new Map<string, MovimientoHistorial[]>()
  for (const m of movimientos) {
    const dia = m.fecha.slice(0, 10)
    if (!diasMap.has(dia)) diasMap.set(dia, [])
    diasMap.get(dia)!.push(m)
  }

  return (
    <div className="hist-lista">
      {Array.from(diasMap.entries()).map(([dia, items]) => {
        // Separar: los que pertenecen a una nota y los que no
        const porNota = new Map<string, MovimientoHistorial[]>()
        const sinNota: MovimientoHistorial[] = []

        for (const m of items) {
          if (m.notaNumero && TIPOS_NOTA.has(m.tipo)) {
            if (!porNota.has(m.notaNumero)) porNota.set(m.notaNumero, [])
            porNota.get(m.notaNumero)!.push(m)
          } else {
            sinNota.push(m)
          }
        }

        const totalTarjetas = porNota.size + sinNota.length

        return (
          <div key={dia} className="hist-grupo">
            <div className="hist-grupo-header">
              <IconCalendar />
              <span>{formatearDia(dia)}</span>
              <span className="hist-grupo-count">{totalTarjetas} evento{totalTarjetas !== 1 ? 's' : ''}</span>
            </div>
            <div className="hist-grupo-items">
              {/* Grupos de nota primero */}
              {Array.from(porNota.entries()).map(([numero, mvs]) => (
                <NotaGrupoCard key={numero} numero={numero} movimientos={mvs} onDetalle={onDetalle} />
              ))}
              {/* Movimientos sin nota (ingresos, traslados, etc.) */}
              {sinNota.map((m) => (
                <MovimientoCard key={m.movimientoId} m={m} onDetalle={onDetalle} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Detalle ingreso ───────────────────────────────────────────────────────

type DetalleContexto =
  | { tipo: 'ingreso'; importacionId: string; codigo: string }
  | { tipo: 'nota'; notaId: string; numero: string }
  | null

function DetalleIngreso({ importacionId, onCerrar }: { importacionId: string; onCerrar: () => void }) {
  const { data, isLoading, isError } = useMovimientosPorIngreso(importacionId)
  return (
    <div className="historial-detalle">
      <div className="detalle-header">
        <button className="btn-volver" onClick={onCerrar}>← Volver</button>
        <h3>Historial de importación</h3>
      </div>
      {isLoading && <p className="cargando">Cargando…</p>}
      {isError   && <p className="error">Error al cargar detalle</p>}
      {data && (
        <>
          <div className="detalle-meta">
            <span><strong>{data.importacion}</strong></span>
            <span>OC: {data.numeroOc}</span>
            <span>Fecha: {data.fechaIngreso}</span>
          </div>
          <ListaMovimientos movimientos={data.movimientos} onDetalle={null} />
        </>
      )}
    </div>
  )
}

const ESTADO_NOTA_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  completa:       { label: 'Completa',       color: '#86efac', bg: 'rgba(34,197,94,0.15)'  },
  lista_despacho: { label: 'Lista despacho', color: '#7dd3fc', bg: 'rgba(14,165,233,0.15)' },
}

function DetalleNota({ notaId, onCerrar }: { notaId: string; onCerrar: () => void }) {
  const { data, isLoading, isError, error } = useMovimientosPorNota(notaId)

  // Agrupar movimientos por SKU — excluye eventos sin producto, agrupa equivalentes bajo el SKU original
  const { porSku, equivRevMap } = useMemo(() => {
    const empty = { porSku: [] as [string, MovimientoHistorial[]][], equivRevMap: new Map<string, string>() }
    if (!data) return empty
    try {
      // Tipos sin producto asociado — excluir de las tarjetas de producto
      const TIPOS_SIN_PRODUCTO = new Set(['cambio_estado_nota', 'despacho', 'picking', 'revision_admin'])

      // equivRevMap: skuEquivalente → skuOriginal (para mostrar "Reemplazó a" en la tarjeta del equivalente)
      const equivRevMap = new Map<string, string>()
      for (const m of data.movimientos ?? []) {
        if (m.tipo === 'equivalente_usado' && m.skuEquivalente && m.skuOriginal) {
          equivRevMap.set(m.skuEquivalente, m.skuOriginal)
        }
      }

      const map = new Map<string, MovimientoHistorial[]>()
      for (const m of data.movimientos ?? []) {
        // Saltar movimientos sin ninguna referencia a producto
        if (TIPOS_SIN_PRODUCTO.has(m.tipo)) continue
        if (!m.producto && !m.skuOriginal) continue

        let key: string
        if (m.tipo === 'equivalente_usado') {
          key = m.skuOriginal!  // agrupar bajo el SKU original pedido
        } else {
          key = m.producto ?? m.skuOriginal!
        }

        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(m)
      }
      return { porSku: Array.from(map.entries()), equivRevMap }
    } catch (e) {
      console.error('[DetalleNota] error:', e, data)
      return empty
    }
  }, [data])

  const estadoCfg = data ? (ESTADO_NOTA_CFG[data.estado] ?? { label: data.estado, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }) : null

  return (
    <div className="p-4 flex flex-col gap-4 max-w-3xl">

      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCerrar}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-lg px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors"
        >
          ← Volver
        </button>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Productos de la nota</h3>
      </div>

      {isLoading && <div className="hist-cargando"><span className="spinner" /><span>Cargando…</span></div>}
      {isError   && <p className="error">Error al cargar detalle: {(error as Error)?.message ?? 'desconocido'}</p>}

      {data && estadoCfg && (
        <>
          {/* Meta de la nota */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 flex flex-wrap items-center gap-3 border border-[var(--border-light)]">
            <span className="text-xl font-extrabold text-[var(--text-primary)]">{data.nota}</span>
            <span className="text-sm text-[var(--text-secondary)]">Cliente: <strong>{data.cliente}</strong></span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full border"
              style={{ color: estadoCfg.color, background: estadoCfg.bg, borderColor: estadoCfg.color + '40' }}
            >
              {estadoCfg.label}
            </span>
          </div>

          {/* Despacho */}
          {data.despacho && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] rounded-xl border-l-4 border-[#86efac]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
                <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <span className="text-sm text-[var(--text-secondary)]">
                Despachado por <strong className="text-[var(--text-primary)]">{data.despacho.nombreChofer}</strong>
                <span className="text-[var(--text-muted)]"> · {data.despacho.fechaDespacho?.slice(0, 10) ?? ''}</span>
              </span>
            </div>
          )}

          {/* Tarjetas por producto */}
          {porSku.length === 0 && <p className="vacio">Sin movimientos registrados para esta nota</p>}

          <div className="flex flex-col gap-3">
            {porSku.map(([sku, movs]) => {
              const tiposUnicos   = Array.from(new Set(movs.map(m => m.tipo)))
              const equivalente   = movs.find(m => m.tipo === 'equivalente_usado')
              const salidaParcial = movs.find(m => m.tipo === 'salida_parcial')
              const ubicacion     = movs.find(m => m.ubicacion)?.ubicacion ?? null
              const skuDespachado   = equivalente?.skuEquivalente ?? null        // este SKU reemplazó al pedido
              const skuOriginal     = equivRevMap.get(sku) ?? null               // este SKU fue pedido originalmente
              const tiposBadge      = tiposUnicos.filter(t => t !== 'equivalente_usado')
              const soloEquivalente = tiposUnicos.every(t => t === 'equivalente_usado')

              const totalDespachado = movs
                .filter(m => m.tipo === 'salida' || m.tipo === 'salida_parcial')
                .reduce((s, m) => s + (m.cantidad ?? 0), 0)

              const cantSolicitada = salidaParcial?.cantidadSolicitada ?? totalDespachado
              const diferencia     = cantSolicitada - totalDespachado
              const completo       = diferencia === 0 && totalDespachado > 0

              return (
                <div
                  key={sku}
                  className={`bg-[var(--bg-surface)] rounded-xl p-4 flex flex-col gap-3 shadow-sm border-l-4 ${
                    completo ? 'border-[#86efac]' : diferencia > 0 ? 'border-[#fbbf24]' : 'border-[var(--border-light)]'
                  }`}
                >
                  {/* SKU pedido + equivalente + badges */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-mono text-sm font-bold text-[var(--accent-light)]">{sku}</span>

                      {/* Producto original que fue reemplazado por este equivalente */}
                      {skuOriginal && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[var(--text-muted)]">Reemplazó a</span>
                          <span className="font-mono font-bold text-[#93c5fd] bg-[rgba(147,197,253,0.12)] border border-[rgba(147,197,253,0.25)] px-1.5 py-0.5 rounded">
                            {skuOriginal}
                          </span>
                        </div>
                      )}

                      {/* Producto pedido que no pudo despacharse — se envió este equivalente */}
                      {skuDespachado && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[var(--text-muted)]">Despachado como</span>
                          <span className="font-mono font-bold text-[#fde68a] bg-[rgba(253,230,138,0.12)] border border-[rgba(253,230,138,0.25)] px-1.5 py-0.5 rounded">
                            {skuDespachado}
                          </span>
                          <span className="text-[10px] text-[#fbbf24] font-semibold uppercase tracking-wide">equivalente</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tiposBadge.map(t => <BadgeTipo key={t} tipo={t} />)}
                    </div>
                  </div>

                  {/* Cantidades — se omite si la tarjeta solo tiene el evento equivalente_usado */}
                  {!soloEquivalente && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-[var(--text-muted)]">
                        Solicitado:&nbsp;
                        <strong className="text-[var(--text-primary)]">{cantSolicitada} Und.</strong>
                      </span>
                      <span className="text-[var(--text-muted)]">
                        Despachado:&nbsp;
                        <strong style={{ color: completo ? '#86efac' : diferencia > 0 ? '#fbbf24' : '#86efac' }}>{totalDespachado} Und.</strong>
                      </span>
                      {diferencia > 0 && (
                        <span className="font-bold text-[#f87171]">−{diferencia} Und. pendiente</span>
                      )}
                    </div>
                  )}

                  {/* Chips: ubicación + usuario + comentario */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {ubicacion && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#86efac] bg-[rgba(34,197,94,0.12)] px-1.5 py-0.5 rounded font-mono">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={11} height={11}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        {ubicacion}
                      </span>
                    )}
                    {movs[0] && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={11} height={11}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        {movs[0].usuario}
                      </span>
                    )}
                    {data?.comentariosPorSku[sku] && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#fbbf24] bg-[rgba(251,191,36,0.10)] px-1.5 py-0.5 rounded italic">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={11} height={11}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {data.comentariosPorSku[sku]}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Vista notas ───────────────────────────────────────────────────────────

const ESTADO_NOTA_LABELS: Record<string, string> = {
  pendiente:      'Pendiente',
  completa:       'Completa',
  lista_despacho: 'Lista despacho',
}
const ESTADO_NOTA_COLORS: Record<string, { color: string; bg: string }> = {
  pendiente:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  completa:       { color: '#86efac', bg: 'rgba(34,197,94,0.15)' },
  lista_despacho: { color: '#7dd3fc', bg: 'rgba(14,165,233,0.15)' },
}

function NotaHistorialCard({
  nota,
  onDetalle,
}: {
  nota: NotaResumen
  onDetalle: (notaId: string) => void
}) {
  const cfg = ESTADO_NOTA_COLORS[nota.estado] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
  const fecha = new Date(nota.creadoEn).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div
      className="nota-fila-item"
      role="button"
      tabIndex={0}
      onClick={() => onDetalle(nota.notaId)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDetalle(nota.notaId) } }}
      style={{ cursor: 'pointer' }}
    >
      <div className="nota-fila nota-fila--hist">
        <div className="nota-fila-principal">
          <span className="nota-fila-numero">{nota.numeroNota}</span>
          <span className="nota-fila-cliente">{nota.nombreCliente}</span>
        </div>
        <span className="nota-fila-fecha">{fecha}</span>
        <div className="nota-fila-estado">
          <span
            className="badge"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}
          >
            {ESTADO_NOTA_LABELS[nota.estado] ?? nota.estado}
          </span>
        </div>
      </div>
    </div>
  )
}

function NotasHistorialView({ onDetalle }: { onDetalle: (notaId: string) => void }) {
  const [filtroEstado, setFiltroEstado] = useState('')
  const { data, isLoading, isError } = useNotas(filtroEstado || undefined)
  const notas = data ?? []

  return (
    <div className="hist-notas-view">
      <div className="hist-notas-filtros">
        {(['', 'pendiente', 'completa', 'lista_despacho'] as const).map((e) => (
          <button
            key={e}
            className={`filtro-btn${filtroEstado === e ? ' activo' : ''}`}
            onClick={() => setFiltroEstado(e)}
          >
            {e ? ESTADO_NOTA_LABELS[e] : 'Todas'}
          </button>
        ))}
      </div>

      {isLoading && <div className="hist-cargando"><span className="spinner" /><span>Cargando notas…</span></div>}
      {isError   && <p className="error">Error al cargar notas</p>}

      {!isLoading && !isError && (
        <>
          <p className="notas-conteo">{notas.length} nota{notas.length !== 1 ? 's' : ''}</p>
          {notas.length === 0
            ? <p className="vacio">No hay notas con este estado</p>
            : (
              <div className="notas-lista-panel">
                <div className="notas-lista-scroll">
                  <div className="notas-lista-filas">
                    {notas.map((n) => (
                      <NotaHistorialCard key={n.notaId} nota={n} onDetalle={onDetalle} />
                    ))}
                  </div>
                </div>
              </div>
            )
          }
        </>
      )}
    </div>
  )
}

// ── Vista jerárquica de Ingresos (OC → Productos → Movimientos) ───────────

type IngresoNivel =
  | { nivel: 'lista' }
  | { nivel: 'productos'; oc: OCResumen }
  | { nivel: 'movimientos'; oc: OCResumen; producto: ProductoEnOC }

const ESTADO_OC_CFG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#fbbf24' },
  parcial:   { label: 'Parcial',   color: '#60a5fa' },
  completa:  { label: 'Completa',  color: '#86efac' },
}

const ESTADO_PROD_CFG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#fbbf24' },
  parcial:   { label: 'Parcial',   color: '#60a5fa' },
  completa:  { label: 'Completa',  color: '#86efac' },
}

function IngresosHistorialView() {
  const [nav, setNav]               = useState<IngresoNivel>({ nivel: 'lista' })
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const { data: ocs,        isLoading: cargandoOcs }  = useListaOCs()
  const importacionId = nav.nivel !== 'lista' ? nav.oc.importacionId : null
  const productoId    = nav.nivel === 'movimientos' ? nav.producto.productoId : null

  const { data: productos,   isLoading: cargandoProd } = useProductosPorOC(importacionId)
  const { data: movimientos, isLoading: cargandoMovs } = useMovimientosPorOCYProducto(importacionId, productoId)

  // ── Nivel 1: lista de OCs ──
  if (nav.nivel === 'lista') {
    return (
      <div className="hing-lista">
        <h2 className="hing-titulo">Órdenes de compra</h2>
        {cargandoOcs && <div className="hist-cargando"><span className="spinner" /><span>Cargando OCs…</span></div>}
        {!cargandoOcs && (ocs ?? []).length === 0 && <p className="vacio">No hay importaciones registradas</p>}
        <div className="hing-grid">
          {(ocs ?? []).map((oc) => {
            const cfg = ESTADO_OC_CFG[oc.estado] ?? { label: oc.estado, color: '#94a3b8' }
            return (
              <button key={oc.importacionId} className="hing-card" onClick={() => { setFiltroEstado(''); setNav({ nivel: 'productos', oc }) }}>
                <div className="hing-card-top">
                  <span className="hing-card-codigo">{oc.codigo}</span>
                  <span className="hing-badge" style={{ color: cfg.color, borderColor: cfg.color + '40', background: cfg.color + '18' }}>{cfg.label}</span>
                </div>
                <div className="hing-card-oc">OC #{oc.numeroOc}</div>
                <div className="hing-card-meta">
                  <span>{oc.fechaIngreso?.slice(0, 10)}</span>
                  <span>{oc.totalProductos} producto{oc.totalProductos !== 1 ? 's' : ''}</span>
                </div>
                <div className="hing-card-chevron">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Nivel 2: productos de la OC ──
  if (nav.nivel === 'productos') {
    return (
      <div className="hing-detalle">
        <div className="hing-nav">
          <button className="btn-volver" onClick={() => { setFiltroEstado(''); setNav({ nivel: 'lista' }) }}>← Volver</button>
          <div className="hing-breadcrumb">
            <span className="hing-bc-root" onClick={() => { setFiltroEstado(''); setNav({ nivel: 'lista' }) }}>OCs</span>
            <span className="hing-bc-sep">›</span>
            <span className="hing-bc-actual">{nav.oc.codigo}</span>
          </div>
        </div>
        <div className="hing-oc-meta">
          <strong>{nav.oc.codigo}</strong>
          <span>OC #{nav.oc.numeroOc}</span>
          <span>{nav.oc.fechaIngreso?.slice(0, 10)}</span>
        </div>
        <h3 className="hing-subtitulo">Productos ({nav.oc.totalProductos})</h3>

        {/* Filtro por estado */}
        <div className="hist-notas-filtros" style={{ marginBottom: 12 }}>
          {(['', 'pendiente', 'parcial', 'completa'] as const).map((e) => (
            <button
              key={e}
              className={`filtro-btn${filtroEstado === e ? ' activo' : ''}`}
              style={e && filtroEstado === e ? { borderColor: ESTADO_PROD_CFG[e]?.color, color: ESTADO_PROD_CFG[e]?.color } : {}}
              onClick={() => setFiltroEstado(e)}
            >
              {e ? ESTADO_PROD_CFG[e].label : 'Todos'}
            </button>
          ))}
        </div>

        {cargandoProd && <div className="hist-cargando"><span className="spinner" /><span>Cargando productos…</span></div>}
        <div className="hing-prod-lista">
          {(productos ?? []).filter(p => !filtroEstado || p.estado === filtroEstado).map((prod) => {
            const pct = prod.cantidadEsperada ? Math.round((prod.cantidadRecibida / prod.cantidadEsperada) * 100) : 0
            const estadoColor = prod.estado === 'completa' ? '#86efac' : prod.cantidadRecibida > 0 ? '#fbbf24' : '#f87171'
            return (
              <button key={prod.detalleId} className="hing-prod-card" onClick={() => setNav({ nivel: 'movimientos', oc: nav.oc, producto: prod })}>
                <div className="hing-prod-top">
                  <div className="hing-prod-info">
                    <span className="hing-prod-sku">{prod.sku}</span>
                    <span className="hing-prod-nombre">{prod.nombre}</span>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                <div className="hing-prod-cantidades">
                  <span>Esperado: <strong>{prod.cantidadEsperada}</strong></span>
                  <span>Recibido: <strong style={{ color: estadoColor }}>{prod.cantidadRecibida}</strong></span>
                  <span>{pct}%</span>
                </div>
                <div className="hing-prod-barra-wrap">
                  <div className="hing-prod-barra-fill" style={{ width: `${pct}%`, background: estadoColor }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Nivel 3: movimientos del producto en la OC ──
  return (
    <div className="hing-detalle">
      <div className="hing-nav">
        <button className="btn-volver" onClick={() => setNav({ nivel: 'productos', oc: nav.oc })}>← Volver</button>
        <div className="hing-breadcrumb">
          <span className="hing-bc-root" onClick={() => setNav({ nivel: 'lista' })}>OCs</span>
          <span className="hing-bc-sep">›</span>
          <span className="hing-bc-root" onClick={() => setNav({ nivel: 'productos', oc: nav.oc })}>{nav.oc.codigo}</span>
          <span className="hing-bc-sep">›</span>
          <span className="hing-bc-actual">{nav.producto.sku}</span>
        </div>
      </div>
      <div className="hing-prod-header">
        <span className="hing-prod-sku">{nav.producto.sku}</span>
        <span className="hing-prod-nombre">{nav.producto.nombre}</span>
      </div>
      {cargandoMovs && <div className="hist-cargando"><span className="spinner" /><span>Cargando movimientos…</span></div>}
      {!cargandoMovs && (movimientos ?? []).length === 0 && <p className="vacio">Sin movimientos registrados para este producto en esta OC</p>}
      <div className="hing-movs-lista">
        {(movimientos ?? []).map((m) => (
          <MovimientoCard key={m.movimientoId} m={m} onDetalle={null} />
        ))}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────

type ErrorFiltro = { desde?: string; hasta?: string; rango?: string }

export function HistorialPage() {
  const [vista,      setVista]      = useState<'movimientos' | 'notas' | 'ingresos'>('movimientos')
  const [filtros,    setFiltros]    = useState<ObtenerMovimientosInput | null>(null)
  const [detalle,    setDetalle]    = useState<DetalleContexto>(null)
  const [tipoInput,  setTipoInput]  = useState('')
  const [desdeInput, setDesdeInput] = useState('')
  const [hastaInput, setHastaInput] = useState('')
  const [errores,    setErrores]    = useState<ErrorFiltro>({})

  const { data, isLoading, isError } = useMovimientos(filtros ?? { limite: LIMITE, offset: 0 })

  const total    = data?.total ?? 0
  const offset   = filtros?.offset ?? 0
  const hayMas   = offset + LIMITE < total
  const hayAntes = offset > 0

  function validar(): ErrorFiltro {
    const errs: ErrorFiltro = {}
    const hoy = new Date().toISOString().slice(0, 10)
    if (desdeInput && desdeInput > hoy) errs.desde = 'La fecha "desde" no puede ser futura'
    if (hastaInput && hastaInput > hoy) errs.hasta = 'La fecha "hasta" no puede ser futura'
    if (desdeInput && hastaInput && desdeInput > hastaInput) errs.rango = '"Desde" debe ser anterior o igual a "Hasta"'
    return errs
  }

  function handleBuscar() {
    const errs = validar()
    setErrores(errs)
    if (Object.keys(errs).length > 0) return
    setFiltros({
      tipo:   tipoInput as ObtenerMovimientosInput['tipo'] || undefined,
      desde:  desdeInput || undefined,
      hasta:  hastaInput || undefined,
      limite: LIMITE,
      offset: 0,
    })
  }

  function handleLimpiar() {
    setTipoInput('')
    setDesdeInput('')
    setHastaInput('')
    setErrores({})
    setFiltros(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleBuscar()
  }

  // Detalle vistas
  if (detalle?.tipo === 'ingreso') {
    return <DetalleIngreso importacionId={detalle.importacionId} onCerrar={() => setDetalle(null)} />
  }
  if (detalle?.tipo === 'nota') {
    return <DetalleNota notaId={detalle.notaId} onCerrar={() => setDetalle(null)} />
  }

  const buscado = filtros !== null

  return (
    <div className="historial-page">
      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl p-1 mb-4 w-full tablet:w-fit overflow-hidden">
        {(
          [
            {
              key: 'movimientos',
              label: 'Movimientos',
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
            },
            {
              key: 'ingresos',
              label: 'Ingresos',
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="9.5" y1="11" x2="12" y2="13.5"/><line x1="14.5" y1="11" x2="12" y2="13.5"/>
                </svg>
              ),
            },
            {
              key: 'notas',
              label: 'Nta venta',
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              ),
            },
          ] as { key: typeof vista; label: string; icon: React.ReactNode }[]
        ).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setVista(key)}
            className={`flex-1 shrink-0 tablet:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 tablet:px-4 border-0 rounded-xl text-sm tablet:text-base font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap font-[Inter] ${
              vista === key
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {vista === 'ingresos' && <IngresosHistorialView />}

      {vista === 'notas' && (
        <NotasHistorialView onDetalle={(notaId) => setDetalle({ tipo: 'nota', notaId, numero: '' })} />
      )}

      {vista === 'movimientos' && <>
      <h1 className="historial-titulo">Historial de movimientos</h1>

      {/* Panel de filtros */}
      <div className="hist-filtros-panel">
        <div className="hist-filtros-titulo">
          <IconFiltro />
          <span>Filtros de búsqueda</span>
        </div>

        <div className="hist-filtros-grid">
          <label className="hist-label">
            Tipo de movimiento
            <select value={tipoInput} onChange={(e) => setTipoInput(e.target.value)} onKeyDown={handleKeyDown}>
              <option value="">Todos los tipos</option>
              {TIPOS_MOVIMIENTO.map((t) => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </label>

          <label className={`hist-label${errores.desde ? ' hist-label--error' : ''}`}>
            Desde
            <input
              type="date"
              value={desdeInput}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setDesdeInput(e.target.value); setErrores((p) => ({ ...p, desde: undefined, rango: undefined })) }}
              onKeyDown={handleKeyDown}
            />
            {errores.desde && <span className="hist-error-msg">{errores.desde}</span>}
          </label>

          <label className={`hist-label${errores.hasta ? ' hist-label--error' : ''}`}>
            Hasta
            <input
              type="date"
              value={hastaInput}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setHastaInput(e.target.value); setErrores((p) => ({ ...p, hasta: undefined, rango: undefined })) }}
              onKeyDown={handleKeyDown}
            />
            {errores.hasta && <span className="hist-error-msg">{errores.hasta}</span>}
          </label>
        </div>

        {errores.rango && <p className="hist-error-rango">{errores.rango}</p>}

        <div className="hist-filtros-acciones">
          <button className="btn-primario hist-btn-buscar" onClick={handleBuscar}>
            <IconSearch /> Buscar
          </button>
          {buscado && (
            <button className="btn-secundario" onClick={handleLimpiar}>Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Estado vacío — sin búsqueda aún */}
      {!buscado && (
        <div className="hist-estado-vacio">
          <IconHistorial />
          <p>Aplica un filtro o rango de fecha para ver los movimientos</p>
        </div>
      )}

      {/* Resultados */}
      {buscado && (
        <>
          {isLoading && (
            <div className="hist-cargando">
              <span className="spinner" />
              <span>Buscando movimientos…</span>
            </div>
          )}
          {isError && <p className="error">Error al cargar historial. Intenta nuevamente.</p>}

          {!isLoading && !isError && (
            <>
              <div className="hist-resumen">
                {total === 0
                  ? <span>No se encontraron movimientos con los filtros aplicados</span>
                  : <span><strong>{total}</strong> movimiento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</span>
                }
              </div>

              <ListaMovimientos movimientos={data?.movimientos ?? []} onDetalle={setDetalle} />

              {total > LIMITE && (
                <div className="historial-paginacion">
                  <button
                    className="btn-secundario"
                    disabled={!hayAntes}
                    onClick={() => setFiltros((f) => f ? { ...f, offset: Math.max(0, (f.offset ?? 0) - LIMITE) } : f)}
                  >
                    ← Anterior
                  </button>
                  <span className="paginacion-info">
                    {offset + 1}–{Math.min(offset + LIMITE, total)} de {total}
                  </span>
                  <button
                    className="btn-secundario"
                    disabled={!hayMas}
                    onClick={() => setFiltros((f) => f ? { ...f, offset: (f.offset ?? 0) + LIMITE } : f)}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      </>}
    </div>
  )
}
