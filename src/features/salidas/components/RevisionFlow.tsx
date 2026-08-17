import { useState, useRef, useEffect } from 'react'
import { useValidarProducto } from '../hooks/useSalidas'
import { useCambiarEstadoNota } from '../../notas/hooks/useNotas'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'
import { ApiResponseError } from '../../../shared/utils/apiClient'

export type ItemRevision = {
  notaProductoId:     string
  sku:                string
  nombre:             string
  codigoBarra:        string
  cantidadSolicitada: number
  cantidadDespachada: number
  revisadoAdmin:      boolean
  estado:             string
  skuEquivalente:     string | null
}

type Paso =
  | { tipo: 'lista' }
  | { tipo: 'escanear_producto'; item: ItemRevision }
  | { tipo: 'ingresar_cantidad'; item: ItemRevision; codigoEscaneado: string }
  | { tipo: 'resultado'; coincide: boolean; mensaje: string; todosRevisados: boolean }

// ── Íconos ────────────────────────────────────────────────────────────────

function IcoCheck({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="20 6 9 17 4 12"/>
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
function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="15 18 9 12 15 6"/>
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
function IcoChevron({ open, size = 14 }: { open: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

const ESTADO_ITEM_LABEL: Record<string, string> = {
  revisado:  'Revisado',
  sin_stock: 'Sin stock',
  pendiente: 'Pendiente',
}

function BadgeItem({ estado }: { estado: 'revisado' | 'sin_stock' | 'pendiente' }) {
  const clase = estado === 'revisado' ? 'badge-completo' : estado === 'sin_stock' ? 'badge-sin-stock' : 'badge-pendiente'
  return <span className={`badge ${clase}`}>{ESTADO_ITEM_LABEL[estado]}</span>
}

// ── Modal chofer ─────────────────────────────────────────────────────────

type ModalChoferProps = {
  notaId:   string
  adminId:  string
  onCerrar: () => void
}

function ModalChofer({ notaId, adminId, onCerrar }: ModalChoferProps) {
  const [nombreChofer, setNombreChofer] = useState('')
  const [error, setError]               = useState<string | null>(null)
  const cambiarEstado = useCambiarEstadoNota()

  async function handleConfirmar() {
    setError(null)
    try {
      await cambiarEstado.mutateAsync({ adminId, notaId, nuevoEstado: 'lista_despacho', nombreChofer })
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al marcar para despacho')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-4">Marcar lista para despacho</h3>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Nombre del chofer <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={nombreChofer}
          onChange={(e) => setNombreChofer(e.target.value)}
          placeholder="Ej: Juan Pérez"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && nombreChofer.trim() && handleConfirmar()}
          className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-white/10 text-white text-sm mb-4 focus:outline-none focus:border-sky-500"
        />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
            onClick={onCerrar}
            disabled={cambiarEstado.isPending}
          >
            Cancelar
          </button>
          <button
            className="flex-1 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            disabled={cambiarEstado.isPending || !nombreChofer.trim()}
            onClick={handleConfirmar}
          >
            {cambiarEstado.isPending ? 'Procesando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  notaId:        string
  numeroNota:    string
  nombreCliente: string
  rutCliente?:   string | null
  numeroOc?:     string | null
  adminId:       string
  items:         ItemRevision[]
  offline:       boolean
  onCerrar:      () => void
}

export function RevisionFlow({ notaId, numeroNota, nombreCliente, rutCliente, numeroOc, adminId, items, offline, onCerrar }: Props) {
  const rolUsuario = localStorage.getItem('user_rol') ?? ''
  const esAdmin    = rolUsuario === 'admin'

  const [paso, setPaso]             = useState<Paso>({ tipo: 'lista' })
  const [cantidad, setCantidad]     = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [revisadoEnSesion, setRevisadoEnSesion] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // Todos revisados: incluye todos los ítems (sin_stock también requieren revisión manual)
  const todosRevisados = revisadoEnSesion ||
    items.every((i) => i.revisadoAdmin)
  const [mostrarModalChofer, setMostrarModalChofer] = useState(false)
  const scanRef    = useRef<HTMLInputElement>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)

  const validar = useValidarProducto()

  useEffect(() => {
    if (paso.tipo === 'escanear_producto') scanRef.current?.focus()
    if (paso.tipo === 'ingresar_cantidad') cantidadRef.current?.focus()
  }, [paso])

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSeleccionarItem(item: ItemRevision) {
    if (item.revisadoAdmin) return
    setError(null)
    setCantidad('')
    setComentario('')
    // Productos CG no requieren escaneo de código de barras
    if (item.sku.startsWith('CG')) {
      setPaso({ tipo: 'ingresar_cantidad', item, codigoEscaneado: '' })
    } else {
      setPaso({ tipo: 'escanear_producto', item })
    }
  }

  function handleEscanearProducto(codigo: string) {
    if (!codigo.trim() || paso.tipo !== 'escanear_producto') return
    if (paso.item.codigoBarra && codigo.trim() !== paso.item.codigoBarra) {
      setError(`Producto incorrecto. Escanea ${paso.item.skuEquivalente ?? paso.item.sku}`)
      return
    }
    setPaso({ tipo: 'ingresar_cantidad', item: paso.item, codigoEscaneado: codigo.trim() })
    setError(null)
  }

  async function handleConfirmarCantidad() {
    if (paso.tipo !== 'ingresar_cantidad') return
    const cant = parseInt(cantidad, 10)
    if (!cant || cant <= 0) { setError('Ingresa una cantidad válida'); return }

    setError(null)
    try {
      const resultado = await validar.mutateAsync({
        adminId,
        notaProductoId:    paso.item.notaProductoId,
        codigoProducto:    paso.codigoEscaneado,
        cantidadIngresada: cant,
        comentario:        comentario.trim() || undefined,
      })

      if (resultado.todosRevisados) setRevisadoEnSesion(true)

      setPaso({ tipo: 'resultado', coincide: resultado.coincide, mensaje: resultado.mensaje, todosRevisados: resultado.todosRevisados })
    } catch (e) {
      const msg = e instanceof ApiResponseError ? e.message : 'Error al validar'
      setError(msg)
      if (e instanceof ApiResponseError && e.code === 'INVALID_PRODUCTO') {
        setPaso({ tipo: 'escanear_producto', item: paso.item })
        if (scanRef.current) scanRef.current.value = ''
        scanRef.current?.focus()
      }
    }
  }

  const qProducto = busquedaProducto.trim().toLowerCase()
  const itemsMostrados = qProducto
    ? items.filter((i) => i.sku.toLowerCase().includes(qProducto) || i.nombre.toLowerCase().includes(qProducto))
    : items

  const pendientes  = itemsMostrados.filter((i) => !i.revisadoAdmin)
  const completados = itemsMostrados.filter((i) => i.revisadoAdmin)

  function renderFila(item: ItemRevision) {
    const abierto    = expandidos.has(item.notaProductoId)
    const esSinStock = item.estado === 'sin_stock'
    const revisado   = item.revisadoAdmin
    const estadoItem: 'revisado' | 'sin_stock' | 'pendiente' = revisado ? 'revisado' : 'pendiente'
    const puedeRevisar = !revisado && !offline

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
            <code className="ing-prod-sku">{item.skuEquivalente ?? item.sku}</code>
          </div>
          <div className="ing-prod-fila-derecha">
            <BadgeItem estado={estadoItem} />
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
              {item.cantidadDespachada > 0 && (
                <div className="ing-cantidad-item">
                  <span className="ing-cantidad-label">Despachado</span>
                  <span className="ing-cantidad-valor">{item.cantidadDespachada}</span>
                </div>
              )}
            </div>

            {item.skuEquivalente && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 w-fit" style={{ fontSize: 'var(--font-size-xs)' }}>
                ↔ Equivalente de {item.sku}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)' }}>
                {revisado && (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <IcoCheck size={13} /> Revisado
                  </span>
                )}
                {esSinStock && !revisado && (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    Sin stock
                  </span>
                )}
              </div>
              {puedeRevisar && (
                <button className="btn-primario ing-btn-ubicar" onClick={(e) => { e.stopPropagation(); handleSeleccionarItem(item) }}>
                  Revisar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="nd-page">
      {mostrarModalChofer && (
        <ModalChofer
          notaId={notaId}
          adminId={adminId}
          onCerrar={() => { setMostrarModalChofer(false); onCerrar() }}
        />
      )}

      {/* ── Header ── */}
      <div className="ing-detalle-header">
        <button className="btn-volver" onClick={onCerrar}>
          <IcoBack /> Volver
        </button>
        <h2
          className="ing-detalle-titulo font-bold text-white tracking-tight"
          style={{ fontSize: 'var(--font-size-xl)' }}
        >
          NV para despacho / {numeroNota}
        </h2>
        <div className="ing-detalle-estado">
          <span className={`badge ${todosRevisados ? 'badge-completa' : 'badge-pendiente'}`}>
            {items.filter((i) => i.revisadoAdmin).length}/{items.length} revisados
          </span>
        </div>
      </div>

      {/* ── Metadata cliente ── */}
      <div className="ing-detalle-meta">
        <div className="ing-meta-item">
          <IcoUser />
          <div>
            <span className="ing-meta-label">Cliente</span>
            <span className="ing-meta-valor">{nombreCliente}</span>
          </div>
        </div>
        {rutCliente && (
          <div className="ing-meta-item">
            <IcoDoc />
            <div>
              <span className="ing-meta-label">RUT</span>
              <span className="ing-meta-valor">{rutCliente}</span>
            </div>
          </div>
        )}
        {numeroOc && (
          <div className="ing-meta-item">
            <IcoDoc />
            <div>
              <span className="ing-meta-label">N° OC</span>
              <span className="ing-meta-valor">{numeroOc}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Avisos ── */}
      {offline && (
        <div className="aviso-offline">Sin conexión — modo solo lectura.</div>
      )}
      {error && <div className="error-banner">{error}</div>}

      {/* LISTA DE ÍTEMS */}
      {paso.tipo === 'lista' && (
        <>
          {todosRevisados && esAdmin && (
            <div className="todos-revisados-aviso">
              ✓ Todos los productos revisados
              <button
                className="btn-primario btn-despacho"
                disabled={offline}
                onClick={() => setMostrarModalChofer(true)}
              >
                Lista para despacho
              </button>
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
        </>
      )}

      {/* ESCANEAR PRODUCTO */}
      {paso.tipo === 'escanear_producto' && (
        <div className="paso">
          <p>Revisando: <strong>{paso.item.skuEquivalente ?? paso.item.sku}</strong> — {paso.item.nombre}</p>
          {paso.item.skuEquivalente && (
            <p style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
              ⇔ Equivalente de {paso.item.sku}
            </p>
          )}
          <p>Cantidad despachada: <strong>{paso.item.cantidadDespachada}</strong></p>
          <p className="paso-instruccion">Escanea el código de barras del producto</p>
          <div className="input-con-camara">
            <input
              ref={scanRef}
              type="text"
              placeholder="Código de barras…"
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && handleEscanearProducto(e.currentTarget.value)}
            />
            <BarcodeScanner
              onDetected={(codigo) => {
                if (scanRef.current) scanRef.current.value = codigo
                handleEscanearProducto(codigo)
              }}
              title="Escanear producto"
            />
          </div>
          <div className="paso-acciones">
            <button className="btn-secundario" onClick={() => { setPaso({ tipo: 'lista' }); setError(null) }}>
              ← Volver
            </button>
            {!paso.item.codigoBarra && (
              <button
                className="btn-secundario"
                onClick={() => { setPaso({ tipo: 'ingresar_cantidad', item: paso.item, codigoEscaneado: '' }); setError(null) }}
              >
                Ingresar cantidad sin código
              </button>
            )}
            <button className="btn-primario" onClick={() => handleEscanearProducto(scanRef.current?.value ?? '')}>
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* INGRESAR CANTIDAD */}
      {paso.tipo === 'ingresar_cantidad' && (
        <div className="paso">
          <p>Producto: <strong>{paso.item.skuEquivalente ?? paso.item.sku}</strong> — {paso.item.nombre}</p>
          <p>Cantidad solicitada: <strong>{paso.item.cantidadSolicitada}</strong>
            {paso.item.cantidadDespachada > 0 && <> · Despachado: <strong>{paso.item.cantidadDespachada}</strong></>}
          </p>
          <label>
            Cantidad física contada
            <input
              ref={cantidadRef}
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => { setCantidad(e.target.value); setComentario('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmarCantidad()}
            />
          </label>

          {(() => {
            const cant = parseInt(cantidad, 10)
            const ref  = paso.item.cantidadSolicitada
            if (!isNaN(cant) && cant > 0 && cant < ref) {
              return (
                <label>
                  Motivo de la diferencia <span style={{ color: 'var(--danger)' }}>*</span>
                  <textarea
                    rows={2}
                    placeholder="Ej: faltante en bodega, producto dañado…"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </label>
              )
            }
            return null
          })()}

          <div className="paso-acciones">
            <button
              className="btn-secundario"
              onClick={() => { setPaso({ tipo: 'escanear_producto', item: paso.item }); setError(null) }}
            >
              ← Volver
            </button>
            <button
              className="btn-primario"
              disabled={validar.isPending || !cantidad}
              onClick={handleConfirmarCantidad}
            >
              {validar.isPending ? 'Validando…' : 'Confirmar cantidad'}
            </button>
          </div>
        </div>
      )}

      {/* RESULTADO */}
      {paso.tipo === 'resultado' && (
        <div className="paso resultado">
          <div className={paso.coincide ? 'resultado-ok' : 'resultado-error'}>
            <span className="icono">{paso.coincide ? '✓' : '✗'}</span>
            {/* Regla 4: mensaje rojo si no coincide */}
            <p className={paso.coincide ? '' : 'texto-error'}>{paso.mensaje}</p>
          </div>
          {paso.todosRevisados && esAdmin && (
            <div className="todos-revisados-aviso">
              ✓ Todos los productos revisados — puedes marcar la nota para despacho
              <button
                className="btn-primario btn-despacho"
                disabled={offline}
                onClick={() => { setPaso({ tipo: 'lista' }); setMostrarModalChofer(true) }}
              >
                Lista para despacho
              </button>
            </div>
          )}
          <button className="btn-primario" onClick={() => { setPaso({ tipo: 'lista' }); setError(null) }}>
            Volver a la lista
          </button>
        </div>
      )}
    </div>
  )
}
