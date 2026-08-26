import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCancelarSesion, useSesionPicking } from '../hooks/usePickingMasivo'
import { useRealtimeSesion } from '../hooks/useRealtimePicking'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { SesionResumen } from '../services/picking-masivo.api'

type SubtareaDetalle = {
  id:                 string
  posicion_codigo:    string
  orden_fifo:         number
  cantidad_asignada:  number
  cantidad_despachada: number | null
  estado:             string
  bloqueado_por:      string | null
  bloqueado_en:       string | null
  completado_por:     string | null
  completado_en:      string | null
  motivo_diferencia:  string | null
  es_equivalente:     boolean
  producto_real_id:   string | null
}

type ItemDetalle = {
  id:                  string
  codigo:              string
  descripcion:         string
  cantidad_pedida:     number
  cantidad_despachada: number
  estado:              string
  motivo_diferencia:   string | null
  lpn:                 string | null
  tienda:              string | null
  subtareas_picking_masivo: SubtareaDetalle[]
}

type SesionDetalle = SesionResumen & { items: ItemDetalle[] }

const ESTADO_SESION_LABELS: Record<string, string> = {
  validando:  'Validando',
  activa:     'Activa',
  completada: 'Completada',
  despachado: 'Despachado',
  cancelada:  'Cancelada',
}

const ESTADO_ITEM_LABELS: Record<string, string> = {
  libre:       'Libre',
  en_progreso: 'En progreso',
  completado:  'Completado',
  parcial:     'Parcial',
  sin_stock:   'Sin stock',
}

const ESTADO_SUBTAREA_LABELS: Record<string, string> = {
  libre:      'Libre',
  bloqueado:  'Bloqueado',
  completado: 'Completado',
  parcial:    'Parcial',
  sin_stock:  'Sin stock',
}

function BadgeSesion({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado}`}>{ESTADO_SESION_LABELS[estado] ?? estado}</span>
}
function BadgeItem({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.replace(/_/g, '-')}`}>{ESTADO_ITEM_LABELS[estado] ?? estado}</span>
}
function BadgeSubtarea({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.replace(/_/g, '-')}`}>{ESTADO_SUBTAREA_LABELS[estado] ?? estado}</span>
}

function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

export function SesionDetallePage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const sesionId  = id ?? null

  const { data, isLoading, isError } = useSesionPicking(sesionId)
  useRealtimeSesion(sesionId)
  const cancelarSesion = useCancelarSesion()

  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [expandido, setExpandido]       = useState<Set<string>>(new Set())

  const toggleExpandido = useCallback((id: string) => {
    setExpandido((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  async function handleCancelar() {
    if (!sesionId) return
    setError(null)
    try {
      await cancelarSesion.mutateAsync(sesionId)
      setConfirmarCancelar(false)
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al cancelar la sesión')
    }
  }

  if (isLoading) return <div className="notas-page"><p className="cargando">Cargando sesión…</p></div>
  if (isError || !data) return <div className="notas-page"><p className="error">Error al cargar la sesión</p></div>

  const sesion = data as SesionDetalle
  const pct    = sesion.total_items ? Math.round((sesion.items_completados / sesion.total_items) * 100) : 0
  const puedeCancelar = sesion.estado === 'validando' || sesion.estado === 'activa'
  const sesionTieneLpn = sesion.items.some((i) => !!i.lpn)

  return (
    <div className="notas-page">
      <div className="pm-sesion-detalle-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>
          <IcoBack /> Volver
        </button>
        <h1 className="notas-titulo" style={{ flex: 1, fontSize: '1.75rem' }}>Detalle — {sesion.nombre_cliente ?? sesion.numero_oc}</h1>
        <span className={`badge badge-${sesion.estado}`} style={{ fontSize: '1.4rem', padding: '0.5rem 1.2rem' }}>
          {ESTADO_SESION_LABELS[sesion.estado] ?? sesion.estado}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="pm-sesion-info-card">
        <span className="pm-sesion-info-cliente">{sesion.nombre_cliente ?? sesion.numero_oc}</span>
        <div className="pm-sesion-info-entrega">
          <span className="pm-sesion-info-entrega-label">Fecha de entrega</span>
          <span className="pm-sesion-info-entrega-fecha">{sesion.numero_oc}</span>
        </div>
      </div>

      {sesion.estado === 'completada' && (
        <button
          className="btn-primario"
          style={{ marginBottom: 'var(--spacing-md)' }}
          onClick={() => navigate(`/picking-masivo/${sesionId}/despacho`)}
        >
          Validar Entrega →
        </button>
      )}

      {puedeCancelar && (
        <div className="paso-acciones">
          {!confirmarCancelar ? (
            <button className="btn-secundario" onClick={() => setConfirmarCancelar(true)}>
              Cancelar sesión
            </button>
          ) : (
            <>
              <span className="picking-nombre">¿Cancelar esta sesión de picking? Esta acción no se puede revertir.</span>
              <button className="btn-secundario" onClick={() => setConfirmarCancelar(false)}>No, mantener</button>
              <button className="btn-primario" disabled={cancelarSesion.isPending} onClick={handleCancelar}>
                {cancelarSesion.isPending ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="ing-productos-lista pm-items-lista">
        {sesion.items.map((item) => {
          const abierto = expandido.has(item.id)
          return (
            <div key={item.id} className="ing-prod-item pm-item-card">
              <div
                className="ing-prod-fila pm-item-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleExpandido(item.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandido(item.id)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span className="ing-prod-nombre">
                    {item.descripcion && item.descripcion !== item.codigo ? item.descripcion : item.codigo}
                  </span>
                  {item.descripcion && item.descripcion !== item.codigo && (
                    <span className="ing-prod-sku">{item.codigo}</span>
                  )}
                </div>
                <div className="ing-prod-fila-derecha" style={{ gap: '0.5rem' }}>
                  <BadgeItem estado={item.estado} />
                  <span className="pm-item-chevron">{abierto ? '▲' : '▼'}</span>
                </div>
              </div>

              {abierto && (
                <div className="pm-item-detalle">
                  <div className="pm-item-detalle-fila">
                    <span className="pm-item-detalle-label">Código</span>
                    <span className="pm-item-detalle-valor">{item.codigo}</span>
                  </div>
                  <div className="pm-item-detalle-fila">
                    <span className="pm-item-detalle-label">Cantidad</span>
                    <span className="pm-item-detalle-valor">{item.cantidad_pedida}</span>
                  </div>
                  {sesionTieneLpn && (
                    <div className="pm-item-detalle-fila">
                      <span className="pm-item-detalle-label">LPN</span>
                      {item.lpn
                        ? <span className="pm-item-detalle-valor pm-item-detalle-lpn">{item.lpn}</span>
                        : <span className="pm-item-detalle-valor pm-item-detalle-sin-lpn">Sin LPN asignado</span>
                      }
                    </div>
                  )}
                  {item.tienda && (
                    <div className="pm-item-detalle-fila">
                      <span className="pm-item-detalle-label">Tienda</span>
                      <span className="pm-item-detalle-valor">{item.tienda}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
