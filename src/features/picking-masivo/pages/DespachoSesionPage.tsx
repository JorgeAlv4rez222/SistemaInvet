import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSesionPicking, useBuscarLpn, useValidarLpn, useDespacharSesion } from '../hooks/usePickingMasivo'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import { BarcodeScanner } from '../../../shared/components/BarcodeScanner'

type ItemPendiente = {
  itemId:         string
  codigo:         string
  descripcion:    string
  cantidadPedida: number
  tienda:         string | null
  lpn:            string
}

type ItemValidado = ItemPendiente

export function DespachoSesionPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const sesionId   = id ?? ''
  const adminId    = localStorage.getItem('user_id') ?? ''

  const { data: sesion, isLoading } = useSesionPicking(sesionId || null)
  const buscarLpn     = useBuscarLpn()
  const validarLpn    = useValidarLpn(sesionId)
  const despacharSesion = useDespacharSesion()

  const [lpnInput, setLpnInput]               = useState('')
  const [itemPendiente, setItemPendiente]     = useState<ItemPendiente | null>(null)
  const [validados, setValidados]             = useState<ItemValidado[]>([])
  const [inicializado, setInicializado]       = useState(false)
  const [detalleLpn, setDetalleLpn]           = useState<ItemValidado | null>(null)
  const [errorLpn, setErrorLpn]               = useState<string | null>(null)
  const [mostrarChofer, setMostrarChofer]     = useState(false)
  const [nombreChofer, setNombreChofer]       = useState('')
  const [errorDespacho, setErrorDespacho]     = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Inicializar validados desde la BD al cargar la sesión
  useEffect(() => {
    if (!sesion || inicializado) return
    const items = (sesion as any).items as Array<{
      id: string; codigo: string; descripcion: string
      cantidad_pedida: number; tienda: string | null
      lpn: string | null; lpn_validado: boolean
    }>
    if (!items) return
    const yaValidados = items
      .filter((i) => i.lpn_validado && i.lpn)
      .map((i) => ({
        itemId:         i.id,
        codigo:         i.codigo,
        descripcion:    i.descripcion,
        cantidadPedida: i.cantidad_pedida,
        tienda:         i.tienda ?? null,
        lpn:            i.lpn!,
      }))
    setValidados(yaValidados)
    setInicializado(true)
  }, [sesion, inicializado])

  async function handleBuscar(lpn: string) {
    const lpnTrimmed = lpn.trim()
    if (!lpnTrimmed) return
    setErrorLpn(null)
    try {
      const res = await buscarLpn.mutateAsync({ sesionId, lpn: lpnTrimmed })
      setItemPendiente({ ...res, lpn: lpnTrimmed })
      setLpnInput('')
    } catch (e) {
      setErrorLpn(e instanceof ApiResponseError ? e.message : 'LPN no encontrado en esta sesión')
      setLpnInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function handleConfirmar() {
    if (!itemPendiente) return
    try {
      await validarLpn.mutateAsync({ sesionId, lpn: itemPendiente.lpn })
      setValidados((prev) =>
        prev.some((v) => v.itemId === itemPendiente.itemId)
          ? prev
          : [itemPendiente, ...prev]
      )
      setItemPendiente(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (e) {
      setErrorLpn(e instanceof ApiResponseError ? e.message : 'Error al confirmar el LPN')
      setItemPendiente(null)
    }
  }

  async function handleDespachar() {
    if (!nombreChofer.trim()) return
    setErrorDespacho(null)
    try {
      await despacharSesion.mutateAsync({ sesionId, usuarioId: adminId, nombreChofer: nombreChofer.trim() })
      navigate('/picking-masivo')
    } catch (e) {
      setErrorDespacho(e instanceof ApiResponseError ? e.message : 'Error al despachar')
    }
  }

  if (isLoading) return <div className="notas-page"><p className="cargando">Cargando…</p></div>
  if (!sesion)   return <div className="notas-page"><p className="error">Sesión no encontrada</p></div>

  if (sesion.estado !== 'completada' && sesion.estado !== 'despachado') {
    return (
      <div className="notas-page">
        <p className="error">La sesión debe estar completada para iniciar el despacho</p>
        <button className="btn-secundario" onClick={() => navigate('/picking-masivo')}>Volver</button>
      </div>
    )
  }

  const totalItems     = sesion.total_items
  const totalValidados = validados.length
  const todosValidados = totalValidados >= totalItems

  return (
    <div className="notas-page pm-despacho-page">
      <div className="pm-despacho-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>← Volver</button>
        <div className="pm-despacho-titulo-wrap" style={{ fontSize: '1.75rem' }}>
          <span className="pm-despacho-titulo-cliente">{sesion.nombre_cliente ?? sesion.numero_oc}</span>
          <span className="pm-despacho-titulo-sep">—</span>
          <span className="pm-despacho-titulo-label">Validación de Carga</span>
        </div>
      </div>


      {/* Escáner LPN */}
      {sesion.estado === 'completada' && (
        <div className="pm-despacho-scanner-card">
          <label className="pm-confirmar-label">
            Escanear LPN
            <div className="pm-confirmar-barcode-row">
              <input
                ref={inputRef}
                type="text"
                className={`pm-confirmar-input ${errorLpn ? 'pm-confirmar-input--error' : ''}`}
                placeholder="Escanea o ingresa el LPN…"
                value={lpnInput}
                onChange={(e) => { setLpnInput(e.target.value); setErrorLpn(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscar(lpnInput)}
                autoFocus
                autoComplete="off"
              />
              <BarcodeScanner
                title="Escanear con cámara"
                onDetected={(lpn) => handleBuscar(lpn)}
              />
            </div>
          </label>
          {errorLpn && <p className="pm-confirmar-barcode-error">{errorLpn}</p>}
          <button
            className="btn-primario pm-despacho-scan-btn"
            disabled={!lpnInput.trim() || buscarLpn.isPending}
            onClick={() => handleBuscar(lpnInput)}
          >
            {buscarLpn.isPending ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      )}



      {/* Lista de validados */}
      {validados.length > 0 && (
        <div className="pm-despacho-validados-card">
          <div className="pm-despacho-validados-header">
            <p className="pm-despacho-validados-titulo">Productos Validados ({validados.length})</p>
            <span className="pm-despacho-validados-ratio">{totalValidados}/{totalItems}</span>
          </div>
          <div className="pm-items-lista">
            {validados.map((v) => (
              <div
                key={v.itemId}
                className="pm-item-card pm-despacho-validado-fila pm-despacho-validado-fila--click"
                onClick={() => setDetalleLpn(v)}
              >
                <div className="pm-despacho-validado-info">
                  <span className="pm-despacho-validado-codigo">{v.codigo}</span>
                  {v.tienda && <span className="pm-despacho-validado-tienda">{v.tienda}</span>}
                </div>
                <span className="pm-despacho-validado-cant">{v.cantidadPedida}</span>
                <span className="pm-despacho-validado-check">✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sesion.estado === 'despachado' && (
        <div className="pm-despacho-completado">OC despachada</div>
      )}

      {/* Botón despachar */}
      {todosValidados && sesion.estado === 'completada' && !mostrarChofer && (
        <button className="btn-primario pm-despacho-despachar-btn" onClick={() => setMostrarChofer(true)}>
          Despachar OC
        </button>
      )}

      {/* Modal detalle LPN validado */}
      {detalleLpn && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setDetalleLpn(null)}
        >
          <div
            className="modal-box"
            style={{ background: 'var(--bg-card, #1e2229)', border: '3px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', width: '90vw', maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">{detalleLpn.codigo}</h3>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">OC</span>
              <span className="pm-despacho-modal-valor">{sesion.numero_oc}</span>
            </div>
            {detalleLpn.tienda && (
              <div className="pm-despacho-modal-fila">
                <span className="pm-despacho-modal-label">Tienda</span>
                <span className="pm-despacho-modal-valor">{detalleLpn.tienda}</span>
              </div>
            )}
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cantidad</span>
              <span className="pm-despacho-modal-valor"><strong>{detalleLpn.cantidadPedida}</strong></span>
            </div>
            <div className="pm-despacho-modal-fila" style={{ marginTop: 'var(--spacing-sm)' }}>
              <span className="pm-despacho-modal-label">LPN</span>
              <span className="pm-despacho-modal-valor" style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>{detalleLpn.lpn}</span>
            </div>
            <button className="btn-secundario" style={{ width: '100%', marginTop: 'var(--spacing-md)' }} onClick={() => setDetalleLpn(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal confirmación LPN */}
      {itemPendiente && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setItemPendiente(null)}
        >
          <div
            className="modal-box pm-despacho-modal"
            style={{ background: 'var(--bg-card, #1e2229)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '1.5rem', minWidth: '300px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">Confirmar bulto</h3>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Código</span>
              <span className="pm-despacho-modal-valor">{itemPendiente.codigo}</span>
            </div>
            <div className="pm-despacho-modal-fila">
              <span className="pm-despacho-modal-label">Cantidad</span>
              <span className="pm-despacho-modal-valor"><strong>{itemPendiente.cantidadPedida}</strong> uds</span>
            </div>
            {itemPendiente.tienda && (
              <div className="pm-despacho-modal-fila">
                <span className="pm-despacho-modal-label">Tienda</span>
                <span className="pm-despacho-modal-valor">{itemPendiente.tienda}</span>
              </div>
            )}
            <div className="pm-confirmar-acciones" style={{ marginTop: 'var(--spacing-md)' }}>
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setItemPendiente(null)}>
                Volver
              </button>
              <button
                className="btn-primario pm-confirmar-btn"
                disabled={validarLpn.isPending}
                onClick={handleConfirmar}
              >
                {validarLpn.isPending ? 'Confirmando…' : 'Confirmado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chofer */}
      {mostrarChofer && (
        <div className="modal-overlay" onClick={() => setMostrarChofer(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">Confirmar despacho</h3>
            <label className="pm-confirmar-label">
              Nombre del chofer <span style={{ color: 'var(--danger)' }}>*</span>
              <input
                type="text"
                className="pm-confirmar-input"
                placeholder="Ej: Juan Pérez"
                value={nombreChofer}
                onChange={(e) => setNombreChofer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && nombreChofer.trim() && handleDespachar()}
                autoFocus
              />
            </label>
            {errorDespacho && <p className="pm-confirmar-barcode-error">{errorDespacho}</p>}
            <div className="pm-confirmar-acciones">
              <button className="btn-secundario pm-confirmar-btn" onClick={() => setMostrarChofer(false)} disabled={despacharSesion.isPending}>
                Cancelar
              </button>
              <button
                className="btn-primario pm-confirmar-btn"
                disabled={!nombreChofer.trim() || despacharSesion.isPending}
                onClick={handleDespachar}
              >
                {despacharSesion.isPending ? 'Despachando…' : 'Confirmar despacho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
