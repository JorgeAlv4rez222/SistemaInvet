import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDetalleNota, useConcluirParcial, useEnviarARevision, useRegistrarPicking } from '../hooks/useNotas'
import { PickingFlow } from '../components/PickingFlow'
import { useConectividad } from '../../../shared/hooks/useConectividad'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { NotaProductoResumen } from '../services/notas.api'

function esSinEscaneo(sku: string) {
  return sku.toUpperCase().startsWith('CG') || sku.toUpperCase().startsWith('SG')
}

function formatearFecha(fecha: string): string {
  return fecha.slice(0, 10).split('-').reverse().join('-')
}

function esTerminado(item: { estado: string; comentarioOperador: string | null; revisadoAdmin: boolean }): boolean {
  return item.revisadoAdmin || item.estado === 'completo' || item.estado === 'sin_stock' || (item.estado === 'parcial' && !!item.comentarioOperador)
}

// ─── Iconos ────────────────────────────────────────────────────────────────
function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
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
function IcoClock({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
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
function IcoScan({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
  )
}
function IcoSend({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
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

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const NOTA_ESTADO_LABEL: Record<string, string> = {
  pendiente:   'Pendiente',
  preparacion: 'En preparación',
  completa:    'Lista para despacho',
  despachada:  'Despachada',
}

// ─── Stepper ──────────────────────────────────────────────────────────────
const PASOS = [
  { key: 'pendiente',   label: 'Creada' },
  { key: 'preparacion', label: 'En Picking' },
  { key: 'completa',    label: 'Lista p/ Despacho' },
  { key: 'despachada',  label: 'Despachada' },
] as const

const ORDEN_ESTADO: Record<string, number> = {
  pendiente: 0, preparacion: 1, completa: 2, despachada: 3,
}

function Stepper({ estadoActual }: { estadoActual: string }) {
  const idx = ORDEN_ESTADO[estadoActual] ?? 0
  return (
    <div className="nd-stepper">
      {PASOS.map((paso, i) => {
        const done   = i < idx
        const active = i === idx
        return (
          <div key={paso.key} className="nd-step-wrap">
            <div className={`nd-step ${done ? 'nd-step--done' : active ? 'nd-step--active' : ''}`}>
              <div className="nd-step-circle">
                {done ? <IcoCheck size={12} /> : <span>{i + 1}</span>}
              </div>
              <span className="nd-step-label">{paso.label}</span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`nd-step-line ${done ? 'nd-step-line--done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────
export function NotaDetallePage() {
  const operadorId          = localStorage.getItem('user_id') ?? ''
  const esAdmin             = ['admin', 'supervisor'].includes(localStorage.getItem('user_rol') ?? '')
  const navigate            = useNavigate()
  const { id: notaId = '' } = useParams<{ id: string }>()
  const { offline }         = useConectividad()
  const { data, isLoading, isError, error, refetch } = useDetalleNota(notaId, operadorId)

  const [itemPicking,       setItemPicking]       = useState<NotaProductoResumen | null>(null)
  const [expandidos,        setExpandidos]        = useState<Set<string>>(new Set())
  const [busquedaProducto,  setBusquedaProducto]  = useState('')
  const [scanInput,         setScanInput]         = useState('')
  const [scanError,         setScanError]         = useState('')
  const [concluirAbierto,   setConcluirAbierto]   = useState<string | null>(null)
  const [concluirTexto,     setConcluirTexto]     = useState('')
  const [concluirError,     setConcluirError]     = useState<string | null>(null)
  const [errorRevision,     setErrorRevision]     = useState<string | null>(null)

  const scanRef            = useRef<HTMLInputElement>(null)
  const registrarPicking   = useRegistrarPicking()
  const concluirParcial    = useConcluirParcial()
  const enviarARevision    = useEnviarARevision()

  // Mantener foco en el scanner cuando no hay modal abierto
  useEffect(() => {
    if (!itemPicking && scanRef.current) {
      scanRef.current.focus()
    }
  }, [itemPicking])

  async function handleMarcarCompleto(item: NotaProductoResumen) {
    try {
      await registrarPicking.mutateAsync({
        usuarioId:      operadorId,
        notaProductoId: item.notaProductoId,
        codigoProducto: item.codigoBarra ?? item.sku,
        cantidad:       item.cantidadSolicitada - item.cantidadDespachada,
      })
      void refetch()
    } catch { /* silencioso */ }
  }

  async function handleEnviarARevision() {
    setErrorRevision(null)
    try {
      await enviarARevision.mutateAsync({ adminId: operadorId, notaId })
      void refetch()
    } catch (e) {
      setErrorRevision(e instanceof ApiResponseError ? e.message : 'Error al enviar a revisión')
    }
  }

  async function handleConfirmarConcluir(notaProductoId: string) {
    if (!concluirTexto.trim()) { setConcluirError('Debes indicar el motivo'); return }
    setConcluirError(null)
    try {
      await concluirParcial.mutateAsync({ usuarioId: operadorId, notaProductoId, comentarioOperador: concluirTexto.trim() })
      setConcluirAbierto(null); setConcluirTexto(''); void refetch()
    } catch (e) {
      setConcluirError(e instanceof ApiResponseError ? e.message : 'Error al concluir el ítem')
    }
  }

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const codigo = scanInput.trim()
    setScanInput('')
    if (!codigo || !data) return
    const normalizar = (c: string) => c.replace(/^0+/, '') // normaliza ceros UPC→EAN
    const codN = normalizar(codigo)
    const producto = data.productos.find((p) =>
      !esTerminado(p) && (
        normalizar(p.codigoBarra ?? '') === codN ||
        normalizar(p.codigoBaRalternativo ?? '') === codN ||
        p.sku === codigo
      )
    )
    if (!producto) {
      setScanError(`Código no encontrado: ${codigo}`)
      setTimeout(() => setScanError(''), 3000)
      return
    }
    setScanError('')
    if (esSinEscaneo(producto.sku)) {
      void handleMarcarCompleto(producto)
    } else {
      setItemPicking(producto)
    }
  }

  // ── Carga / error ────────────────────────────────────────────────────────
  if (isLoading) return <p className="cargando">Cargando nota…</p>

  if (isError) {
    const notaTomada = error instanceof ApiResponseError && error.code === 'CONFLICT_NOTA_TOMADA'
    return (
      <div className="nota-detalle-bloqueada">
        <button className="btn-volver" onClick={() => navigate('/notas')}>
          <IcoBack /> Volver
        </button>
        <div className="nota-bloqueada-aviso">
          <span className="nota-bloqueada-icono">🔒</span>
          <p className="nota-bloqueada-titulo">{notaTomada ? 'Nota en preparación' : 'Nota no encontrada'}</p>
          <p className="nota-bloqueada-desc">{notaTomada ? 'Otro operador está preparando esta nota.' : 'No se pudo cargar la nota de venta.'}</p>
        </div>
      </div>
    )
  }

  if (!data) return <p className="error">Nota no encontrada</p>

  // ── Cálculos globales ────────────────────────────────────────────────────
  const notaCerrada     = data.estado === 'completa' || data.estado === 'despachada'
  const totalSolicitado = data.productos.reduce((s, p) => s + p.cantidadSolicitada, 0)
  const totalDespachado = data.productos.reduce((s, p) => s + p.cantidadDespachada, 0)
  const totalItems      = data.productos.length
  const itemsCompletos  = data.productos.filter(esTerminado).length
  const pctGlobal       = totalSolicitado > 0 ? Math.round((totalDespachado / totalSolicitado) * 100) : 0
  const todosCompletos  = itemsCompletos === totalItems

  const qProducto = busquedaProducto.trim().toLowerCase()
  const productosMostrados = qProducto
    ? data.productos.filter((p) => p.sku.toLowerCase().includes(qProducto) || p.nombre.toLowerCase().includes(qProducto))
    : data.productos

  const pendientes  = productosMostrados.filter((p) => !esTerminado(p))
  const completados = productosMostrados.filter(esTerminado)

  // ── PickingFlow ───────────────────────────────────────────────────────────
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

  // ── Render fila de producto ───────────────────────────────────────────────
  function renderFila(item: NotaProductoResumen) {
    const terminado      = esTerminado(item)
    const parcialCerrado = terminado && item.estado === 'parcial'
    const puedePickear   = !terminado && !offline && !notaCerrada
    const ubicPrincipal  = item.ubicaciones[0] ?? null
    const abierto        = expandidos.has(item.notaProductoId)
    const nombreCorto    = item.nombre.length > 10 ? item.nombre.slice(0, 10) + '…' : item.nombre

    return (
      <div
        key={item.notaProductoId}
        className={`nd-prod-row ${terminado ? 'nd-prod-row--terminado' : 'nd-prod-row--pendiente'}`}
      >
        {/* ── Columna estado dot ── */}
        <div className="nd-prod-dot">
          {terminado && item.estado === 'completo' && (
            <span className="nd-dot nd-dot--ok"><IcoCheck size={11} /></span>
          )}
          {terminado && item.estado === 'sin_stock' && (
            <span className="nd-dot nd-dot--err"><IcoX size={11} /></span>
          )}
          {parcialCerrado && (
            <span className="nd-dot nd-dot--warn"><IcoCheck size={11} /></span>
          )}
          {!terminado && (
            <span className="nd-dot nd-dot--pending" />
          )}
        </div>

        {/* ── Columna ubicación ── */}
        <div className="nd-prod-loc">
          {ubicPrincipal ? (
            <span className="nd-loc-badge">
              <IcoRack size={11} />
              {ubicPrincipal.posicionCodigo ?? '—'}
            </span>
          ) : (
            <span className="nd-loc-badge nd-loc-badge--sin">Sin ubic.</span>
          )}
          {ubicPrincipal && (
            <span className="nd-loc-lote" title={`Lote: ${ubicPrincipal.loteId}`}>
              {formatearFecha(ubicPrincipal.fechaIngreso)}
            </span>
          )}
        </div>

        {/* ── Columna producto ── */}
        <div
          className="nd-prod-info"
          onClick={() => toggleExpandido(item.notaProductoId)}
          style={{ cursor: 'pointer' }}
        >
          <div className="nd-prod-nombre-row">
            <span className="nd-prod-nombre" title={item.nombre}>{nombreCorto}</span>
            <code className="nd-prod-sku-inline">{item.sku}</code>
          </div>
          {item.codigoBarra && (
            <code className="nd-prod-ean">{item.codigoBarra}</code>
          )}
          {abierto && (
            <span className="nd-prod-nombre-completo">{item.nombre}</span>
          )}
          {item.skuEquivalente && (
            <span className="nd-prod-equiv">↔ {item.skuEquivalente}</span>
          )}
          {item.comentarioOperador && (
            <span className="nd-prod-comentario">{item.comentarioOperador}</span>
          )}
        </div>

        {/* ── Columna cantidades ── */}
        <div className="nd-prod-qty">
          <div className="nd-qty-item">
            <span className="nd-qty-label">Solicitado</span>
            <span className="nd-qty-valor">{item.cantidadSolicitada}</span>
          </div>
          {terminado && (
            <>
              <div className="nd-qty-sep" aria-hidden="true">·</div>
              <div className="nd-qty-item">
                <span className="nd-qty-label">Pickeado</span>
                <span className={`nd-qty-valor ${item.cantidadDespachada > 0 ? 'nd-qty-valor--ok' : ''}`}>
                  {item.cantidadDespachada}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Columna acciones ── */}
        <div className="nd-prod-acciones">
          {terminado && item.estado === 'completo' && !item.revisadoAdmin && (
            <span className="nd-prod-badge nd-prod-badge--ok">Completado</span>
          )}
          {terminado && item.estado === 'sin_stock' && (
            <span className="nd-prod-badge nd-prod-badge--err">Sin stock</span>
          )}
          {parcialCerrado && (
            <span className="nd-prod-badge nd-prod-badge--warn">Parcial</span>
          )}
          {item.revisadoAdmin && (
            <span className="nd-prod-badge nd-prod-badge--revisado">Revisado ✓</span>
          )}
          {puedePickear && (
            <div className="nd-prod-btns">
              {item.estado === 'parcial' && !expandidos.has(item.notaProductoId) && (
                <button
                  className="btn-secundario"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => toggleExpandido(item.notaProductoId)}
                >
                  Concluir
                </button>
              )}
              {esSinEscaneo(item.sku) ? (
                <button
                  className="btn-primario"
                  style={{ fontSize: '11px', padding: '5px 12px' }}
                  disabled={registrarPicking.isPending}
                  onClick={() => void handleMarcarCompleto(item)}
                >
                  {registrarPicking.isPending ? '…' : 'Marcar completo'}
                </button>
              ) : (
                <button
                  className="btn-primario"
                  style={{ fontSize: '11px', padding: '5px 12px' }}
                  onClick={() => setItemPicking(item)}
                >
                  Picking
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Panel cierre parcial (expandible) ── */}
        {abierto && item.estado === 'parcial' && (
          <div className="nd-concluir-panel" onClick={(e) => e.stopPropagation()}>
            <span className="nd-concluir-label">Motivo de cierre parcial:</span>
            <textarea
              className="nd-concluir-textarea"
              placeholder="Ej: cliente confirmó recibir solo lo despachado…"
              value={concluirTexto}
              onChange={(e) => setConcluirTexto(e.target.value)}
              autoFocus
            />
            {concluirError && <span className="nd-concluir-error">{concluirError}</span>}
            <div className="nd-concluir-footer">
              <button
                className="btn-secundario"
                style={{ fontSize: '12px' }}
                onClick={() => { setConcluirAbierto(null); setConcluirTexto(''); setConcluirError(null); toggleExpandido(item.notaProductoId) }}
              >
                Cancelar
              </button>
              <button
                className="btn-primario"
                style={{ fontSize: '12px' }}
                disabled={concluirParcial.isPending || !concluirTexto.trim()}
                onClick={() => handleConfirmarConcluir(item.notaProductoId)}
              >
                {concluirParcial.isPending ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render página ─────────────────────────────────────────────────────────
  return (
    <div className="nd-page">

      {/* ── HEADER EJECUTIVO ── */}
      <div className="nd-header">
        <div className="nd-header-top">
          <button className="btn-volver" onClick={() => navigate('/notas')}>
            <IcoBack /> Volver
          </button>
          <div className="nd-header-titulo">
            <h2 className="nd-titulo">NV {data.numeroNota}</h2>
            <span className={`badge badge-${data.estado.replace('_', '-')}`}>
              {NOTA_ESTADO_LABEL[data.estado] ?? data.estado}
            </span>
          </div>
          <div className="nd-header-acciones">
            {!notaCerrada && esAdmin && (
              <button
                className="btn-primario nd-btn-enviar"
                disabled={enviarARevision.isPending || offline || !todosCompletos}
                onClick={handleEnviarARevision}
                title={!todosCompletos ? 'Completa todos los ítems primero' : ''}
              >
                <IcoSend size={13} />
                {enviarARevision.isPending ? 'Enviando…' : 'Enviar a revisión'}
              </button>
            )}
          </div>
        </div>

        {/* Meta strip cliente */}
        <div className="nd-meta-strip">
          <div className="nd-meta-item">
            <IcoUser size={12} />
            <span className="nd-meta-label">Cliente</span>
            <span className="nd-meta-valor">{data.nombreCliente}</span>
          </div>
          {data.rutCliente && (
            <div className="nd-meta-item">
              <IcoDoc size={12} />
              <span className="nd-meta-label">RUT</span>
              <span className="nd-meta-valor">{data.rutCliente}</span>
            </div>
          )}
          {data.numeroOc && (
            <div className="nd-meta-item">
              <IcoDoc size={12} />
              <span className="nd-meta-label">N° OC</span>
              <span className="nd-meta-valor">{data.numeroOc}</span>
            </div>
          )}
          {data.fechaPreparacion && (
            <div className="nd-meta-item">
              <IcoClock size={12} />
              <span className="nd-meta-label">Preparada</span>
              <span className="nd-meta-valor">{fmtFecha(data.fechaPreparacion)}</span>
            </div>
          )}
          {data.fechaDespacho && (
            <div className="nd-meta-item">
              <IcoClock size={12} />
              <span className="nd-meta-label">Despachada</span>
              <span className="nd-meta-valor">{fmtFecha(data.fechaDespacho)}</span>
            </div>
          )}
          {data.comentarioDespacho && (
            <div className="nd-meta-item nd-meta-item--comentario">
              <span className="nd-meta-label">Instrucción</span>
              <span className="nd-meta-valor nd-meta-valor--comentario">{data.comentarioDespacho}</span>
            </div>
          )}
        </div>
      </div>


      {/* ── AVISOS ── */}
      {offline && (
        <div className="nd-aviso nd-aviso--offline">Sin conexión — modo solo lectura.</div>
      )}
      {errorRevision && (
        <div className="nd-aviso nd-aviso--error">{errorRevision}</div>
      )}

      {/* ── BARRA DE PROGRESO GLOBAL ── */}
      <div className="nd-progreso-global">
        <div className="nd-progreso-info">
          <span className="nd-progreso-titulo">Progreso total</span>
          <span className="nd-progreso-fraccion">
            {itemsCompletos}/{totalItems} ítems
          </span>
          <span className={`nd-progreso-pct ${pctGlobal === 100 ? 'nd-progreso-pct--ok' : ''}`}>{pctGlobal}%</span>
        </div>
        <div className="nd-progreso-barra">
          <div
            className={`nd-progreso-fill ${pctGlobal === 100 ? 'nd-progreso-fill--ok' : ''}`}
            style={{ width: `${pctGlobal}%` }}
          />
        </div>
      </div>

      {/* ── SCANNER BAR ── */}
      {!notaCerrada && (
        <div className={`nd-scanner-bar ${scanError ? 'nd-scanner-bar--error' : ''}`}>
          <span className="nd-scanner-icon"><IcoScan size={16} /></span>
          <input
            ref={scanRef}
            type="text"
            className="nd-scanner-input"
            placeholder="ESCÁNER ACTIVO — Pistolear EAN / UPC / SKU aquí y presionar Enter..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            autoComplete="off"
            spellCheck={false}
          />
          {scanError && <span className="nd-scanner-error">{scanError}</span>}
        </div>
      )}

      {/* ── BÚSQUEDA DE PRODUCTO ── */}
      <div className="ing-busqueda" style={{ marginBottom: '12px' }}>
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

      {/* ── TABLA DE PRODUCTOS ── */}
      {qProducto && pendientes.length === 0 && completados.length === 0 && (
        <div className="ing-vacio"><p>Sin resultados para "{busquedaProducto}"</p></div>
      )}

      {/* Cabecera de columnas */}
      {(pendientes.length > 0 || completados.length > 0) && (
        <div className="nd-tabla-header">
          <div className="nd-col-dot" />
          <div className="nd-col-loc">Ubicación</div>
          <div className="nd-col-info">Producto</div>
          <div className="nd-col-qty">Cantidades</div>
          <div className="nd-col-acc">Estado / Acción</div>
        </div>
      )}

      {pendientes.length > 0 && (
        <section className="nd-seccion">
          <div className="nd-seccion-titulo">
            <span className="nd-seccion-dot nd-seccion-dot--pendiente" />
            Pendientes ({pendientes.length})
          </div>
          <div className="nd-productos-lista">
            {pendientes.map((item) => renderFila(item))}
          </div>
        </section>
      )}

      {completados.length > 0 && (
        <section className="nd-seccion">
          <div className="nd-seccion-titulo">
            <span className="nd-seccion-dot nd-seccion-dot--completo" />
            Completados ({completados.length})
          </div>
          <div className="nd-productos-lista nd-productos-lista--completados">
            {completados.map((item) => renderFila(item))}
          </div>
        </section>
      )}

      {/* ── PIE DE TRAZABILIDAD ── */}
      {notaCerrada && (
        <div className="nd-pie-traza">
          <span>
            Nota {data.estado === 'despachada' ? 'despachada' : 'lista para despacho'} —
            {' '}{itemsCompletos} de {totalItems} ítems completados
          </span>
        </div>
      )}
    </div>
  )
}
