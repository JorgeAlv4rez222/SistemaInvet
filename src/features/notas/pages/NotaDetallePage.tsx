import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDetalleNota, useConcluirParcial, useEnviarARevision } from '../hooks/useNotas'
import { PickingFlow } from '../components/PickingFlow'
import { useConectividad } from '../../../shared/hooks/useConectividad'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { NotaProductoResumen } from '../services/notas.api'

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial:   'Parcial',
  completo:  'Completo',
  sin_stock: 'Sin stock',
}

function formatearFecha(fecha: string): string {
  return fecha.slice(0, 10).split('-').reverse().join('-')
}

// Un producto queda cerrado (sin más picking) cuando está completo, sin stock,
// o cuando su despacho parcial ya fue justificado con un comentario del operador
// (a diferencia del estado "parcial" transitorio de una parada multi-lote en curso).
function esTerminado(item: { estado: string; comentarioOperador: string | null }): boolean {
  return item.estado === 'completo' || item.estado === 'sin_stock' || (item.estado === 'parcial' && !!item.comentarioOperador)
}

// ── Íconos ────────────────────────────────────────────────────────────────

function IcoCheck({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IcoX({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function IcoLoader({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>
  )
}
function IcoUser({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IcoDoc({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

function IcoRack({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="5" rx="1"/>
    </svg>
  )
}
function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function IcoChevron({ open, size = 14 }: { open: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
function IcoSearch({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────

function BadgeEstado({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.replace('_', '-')}`}>{ESTADO_LABELS[estado] ?? estado}</span>
}

const NOTA_ESTADO_LABEL: Record<string, string> = {
  pendiente:   'Pendiente',
  preparacion: 'En preparación',
  completa:    'Completa',
  despachada:  'Despachada',
}

// ── Página principal ──────────────────────────────────────────────────────

export function NotaDetallePage() {
  const operadorId              = localStorage.getItem('user_id') ?? ''
  const esAdmin                 = localStorage.getItem('user_rol') === 'admin'
  const navigate                = useNavigate()
  const { id: notaId = '' }     = useParams<{ id: string }>()
  const { offline }             = useConectividad()
  const { data, isLoading, isError, refetch } = useDetalleNota(notaId, operadorId)
  const [itemPicking, setItemPicking]         = useState<NotaProductoResumen | null>(null)
  const [metaAbierto, setMetaAbierto]         = useState(false)
  const [expandidos, setExpandidos]           = useState<Set<string>>(new Set())
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [concluirAbierto, setConcluirAbierto] = useState<string | null>(null)
  const [concluirTexto,   setConcluirTexto]   = useState('')
  const [concluirError,   setConcluirError]   = useState<string | null>(null)
  const [errorRevision,   setErrorRevision]   = useState<string | null>(null)
  const concluirParcial  = useConcluirParcial()
  const enviarARevision  = useEnviarARevision()

  async function handleEnviarARevision() {
    setErrorRevision(null)
    try {
      await enviarARevision.mutateAsync({ adminId: operadorId, notaId })
      void refetch()
    } catch (e) {
      setErrorRevision(e instanceof ApiResponseError ? e.message : 'Error al enviar a revisión')
    }
  }

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleConfirmarConcluir(notaProductoId: string) {
    if (!concluirTexto.trim()) { setConcluirError('Debes indicar el motivo'); return }
    setConcluirError(null)
    try {
      await concluirParcial.mutateAsync({ usuarioId: operadorId, notaProductoId, comentarioOperador: concluirTexto.trim() })
      setConcluirAbierto(null)
      setConcluirTexto('')
      void refetch()
    } catch (e) {
      setConcluirError(e instanceof ApiResponseError ? e.message : 'Error al concluir el ítem')
    }
  }

  if (isLoading) return <p className="cargando">Cargando nota…</p>
  if (isError || !data) return <p className="error">Nota no encontrada</p>

  const notaCerrada  = data.estado === 'completa' || data.estado === 'despachada'

  const qProducto = busquedaProducto.trim().toLowerCase()
  const productosMostrados = qProducto
    ? data.productos.filter((p) => p.sku.toLowerCase().includes(qProducto) || p.nombre.toLowerCase().includes(qProducto))
    : data.productos

  const pendientes  = productosMostrados.filter((p) => !esTerminado(p))
  const completados = productosMostrados.filter(esTerminado)

  function renderFila(item: NotaProductoResumen) {
    const abierto        = expandidos.has(item.notaProductoId)
    const terminado      = esTerminado(item)
    const parcialCerrado = terminado && item.estado === 'parcial'
    const puedePickear   = !terminado && !offline && !notaCerrada
    const itemPct      = item.cantidadSolicitada > 0
      ? Math.round((item.cantidadDespachada / item.cantidadSolicitada) * 100)
      : 0

    return (
      <div key={item.notaProductoId} className="ing-prod-item">
        <div
          className="ing-prod-fila"
          role="button"
          tabIndex={0}
          aria-expanded={abierto}
          onClick={() => toggleExpandido(item.notaProductoId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandido(item.notaProductoId) }
          }}
        >
          <div className="ing-prod-info">
            <span className="ing-prod-nombre">{item.nombre}</span>
            <code className="ing-prod-sku">{item.sku}</code>
          </div>
          <div className="ing-prod-fila-derecha">
            <BadgeEstado estado={item.estado} />
            <span className={`ing-prod-chevron ${abierto ? 'ing-prod-chevron--activo' : ''}`}>
              <IcoChevron open={abierto} size={14} />
            </span>
          </div>
        </div>

        {abierto && (
          <div className="ing-prod-detalle">
            <div className="ing-prod-cantidades">
              <div className="ing-cantidad-item">
                <span className="ing-cantidad-label">Solicitado</span>
                <span className="ing-cantidad-valor">{item.cantidadSolicitada}</span>
              </div>
              <div className="ing-cantidad-sep">·</div>
              <div className="ing-cantidad-item">
                <span className="ing-cantidad-label">Despachado</span>
                <span className={`ing-cantidad-valor ${item.cantidadDespachada > 0 ? 'ing-cantidad-valor--ok' : ''}`}>
                  {item.cantidadDespachada}
                </span>
              </div>
            </div>
            <div className="ing-prod-barra-wrap">
              <div
                className={`ing-prod-barra-fill ${terminado && item.estado === 'completo' ? 'ing-prod-barra-fill--ok' : ''}`}
                style={{ width: terminado && item.estado === 'completo' ? '100%' : `${itemPct}%` }}
              />
            </div>

            {/* Ubicación FIFO */}
            {!terminado && item.ubicaciones.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50" style={{ fontSize: 'var(--font-size-xs)' }}>
                <span className="text-slate-400"><IcoRack size={12} /></span>
                <span className="text-white font-mono font-medium">{item.ubicaciones[0].posicionCodigo}</span>
                <span className="text-slate-500 ml-auto">{formatearFecha(item.ubicaciones[0].fechaIngreso)}</span>
              </div>
            )}

            {/* Sin stock pero hay equivalentes */}
            {!terminado && item.ubicaciones.length === 0 && item.equivalentes.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400" style={{ fontSize: 'var(--font-size-xs)' }}>
                Sin stock — equivalentes: {item.equivalentes.map((e) => e.sku).join(', ')}
              </div>
            )}

            {/* Equivalente badge */}
            {item.skuEquivalente && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 w-fit" style={{ fontSize: 'var(--font-size-xs)' }}>
                ↔ {item.skuEquivalente}
              </div>
            )}

            {/* Comentario */}
            {item.comentarioOperador && (
              <div className="px-3 py-2 rounded-lg bg-slate-700/40 text-slate-400 italic" style={{ fontSize: 'var(--font-size-xs)' }}>
                {item.comentarioOperador}
              </div>
            )}

            {/* Footer acciones */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)' }}>
                {terminado && item.estado === 'completo' && (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <IcoCheck size={13} /> Completado
                  </span>
                )}
                {terminado && item.estado === 'sin_stock' && (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <IcoX size={13} /> Sin stock
                  </span>
                )}
                {parcialCerrado && (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <IcoCheck size={13} /> Cerrado — parcial
                  </span>
                )}
                {!terminado && !puedePickear && !offline && (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <IcoLoader size={13} /> Pendiente
                  </span>
                )}
                {item.revisadoAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <IcoCheck size={11} /> Revisado
                  </span>
                )}
              </div>
              {puedePickear && (
                <div className="flex items-center gap-2">
                  {item.estado === 'parcial' && (
                    <button
                      className="btn-secundario"
                      style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-md)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConcluirError(null)
                        setConcluirTexto('')
                        setConcluirAbierto(item.notaProductoId)
                      }}
                    >
                      Marcar concluido
                    </button>
                  )}
                  <button className="btn-primario ing-btn-ubicar" onClick={(e) => { e.stopPropagation(); setItemPicking(item) }}>
                    Picking
                  </button>
                </div>
              )}
            </div>

            {/* Cierre manual de un parcial — a criterio del operador */}
            {concluirAbierto === item.notaProductoId && (
              <div
                className="flex flex-col gap-2 p-3 rounded-lg bg-slate-900/60 border border-amber-500/20"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-amber-400" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Indica el motivo por el cual das por concluido este ítem sin despachar el resto:
                </span>
                <textarea
                  className="w-full h-16 px-3 py-2 rounded-lg border border-white/10 bg-slate-800 text-slate-200 placeholder:text-slate-500 resize-none"
                  style={{ fontSize: 'var(--font-size-xs)' }}
                  placeholder="Ej: cliente confirmó recibir solo lo despachado…"
                  value={concluirTexto}
                  onChange={(e) => setConcluirTexto(e.target.value)}
                  autoFocus
                />
                {concluirError && <span className="text-red-400" style={{ fontSize: 'var(--font-size-xs)' }}>{concluirError}</span>}
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="btn-secundario"
                    style={{ fontSize: 'var(--font-size-xs)' }}
                    onClick={() => { setConcluirAbierto(null); setConcluirTexto(''); setConcluirError(null) }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-primario"
                    style={{ fontSize: 'var(--font-size-xs)' }}
                    disabled={concluirParcial.isPending || !concluirTexto.trim()}
                    onClick={() => handleConfirmarConcluir(item.notaProductoId)}
                  >
                    {concluirParcial.isPending ? 'Guardando…' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (itemPicking) {
    return (
      <PickingFlow
        item={itemPicking}
        usuarioId={operadorId}
        onCompletado={() => { setItemPicking(null); void refetch() }}
        onCerrar={()     => { setItemPicking(null); void refetch() }}
      />
    )
  }

  return (
    <div className="nd-page">
      {/* ── Header ── */}
      <div className="ing-detalle-header">
        <button className="btn-volver" onClick={() => navigate('/notas')}>
          <IcoBack /> Volver
        </button>
        <h2
          className="ing-detalle-titulo font-bold text-white tracking-tight"
          style={{ fontSize: 'var(--font-size-xl)' }}
        >
          NV en preparación / {data.numeroNota}
        </h2>
        <div className="ing-detalle-estado">
          <span className={`badge badge-${data.estado.replace('_', '-')}`}>
            {NOTA_ESTADO_LABEL[data.estado] ?? data.estado}
          </span>
        </div>
      </div>

      {/* ── Metadata cliente ── */}
      <div className="ing-detalle-meta">
        <div className="ing-meta-item">
          <IcoUser />
          <div>
            <span className="ing-meta-label">Cliente</span>
            <span className="ing-meta-valor">{data.nombreCliente}</span>
          </div>
        </div>
        {data.rutCliente && (
          <div className="ing-meta-item">
            <IcoDoc />
            <div>
              <span className="ing-meta-label">RUT</span>
              <span className="ing-meta-valor">{data.rutCliente}</span>
            </div>
          </div>
        )}
        {data.numeroOc && (
          <div className="ing-meta-item">
            <IcoDoc />
            <div>
              <span className="ing-meta-label">N° OC</span>
              <span className="ing-meta-valor">{data.numeroOc}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Avisos ── */}
      {offline && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700/60 text-slate-400 text-sm mb-3 border border-white/8">
          Sin conexión — modo solo lectura.
        </div>
      )}
      {notaCerrada && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm mb-3 border ${data.estado === 'despachada' ? 'bg-sky-500/10 text-sky-400 border-sky-500/25' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'}`}>
          <IcoCheck size={14} />
          {data.estado === 'despachada' ? 'Despachada' : 'Completada — pendiente revisión Admin'}
        </div>
      )}

      {!notaCerrada && esAdmin && (
        <div className="flex flex-col gap-1 mb-3">
          <button
            className="btn-secundario"
            style={{ alignSelf: 'flex-start' }}
            disabled={enviarARevision.isPending || offline}
            onClick={handleEnviarARevision}
          >
            {enviarARevision.isPending ? 'Enviando…' : 'Enviar a revisión directa'}
          </button>
          {errorRevision && <p className="text-red-400" style={{ fontSize: 'var(--font-size-xs)' }}>{errorRevision}</p>}
        </div>
      )}

      {/* ── Búsqueda de productos por código o nombre ── */}
      <div className="ing-busqueda">
        <span className="ing-busqueda-icono"><IcoSearch /></span>
        <input
          type="search"
          placeholder="Buscar producto por código o nombre…"
          value={busquedaProducto}
          onChange={(e) => setBusquedaProducto(e.target.value)}
          autoComplete="off"
        />
        {busquedaProducto && (
          <button className="ing-busqueda-limpiar" onClick={() => setBusquedaProducto('')}>✕</button>
        )}
      </div>

      {qProducto && pendientes.length === 0 && completados.length === 0 && (
        <div className="ing-vacio">
          <p>Sin resultados para "{busquedaProducto}"</p>
        </div>
      )}

      {/* ── Productos pendientes ── */}
      {pendientes.length > 0 && (
        <section className="ing-seccion">
          <h3 className="ing-seccion-titulo">
            <span className="ing-seccion-dot ing-seccion-dot--pendiente" />
            Pendientes ({pendientes.length})
          </h3>
          <div className="ing-productos-lista">
            {pendientes.map(renderFila)}
          </div>
        </section>
      )}

      {/* ── Productos completados ── */}
      {completados.length > 0 && (
        <section className="ing-seccion">
          <h3 className="ing-seccion-titulo">
            <span className="ing-seccion-dot ing-seccion-dot--completo" />
            Completados ({completados.length})
          </h3>
          <div className="ing-productos-lista">
            {completados.map(renderFila)}
          </div>
        </section>
      )}

    </div>
  )
}
