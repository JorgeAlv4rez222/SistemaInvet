import { useState } from 'react'
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
  subtareas_picking_masivo: SubtareaDetalle[]
}

type SesionDetalle = SesionResumen & { items: ItemDetalle[] }

const ESTADO_SESION_LABELS: Record<string, string> = {
  validando:  'Validando',
  activa:     'Activa',
  completada: 'Completada',
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
function IcoChevron({ activo }: { activo: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      width={14} height={14}
      className={activo ? 'ing-prod-chevron ing-prod-chevron--activo' : 'ing-prod-chevron'}
    >
      <polyline points="9 18 15 12 9 6"/>
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

  const [expandidos, setExpandidos]     = useState<Set<string>>(new Set())
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  function toggleExpandido(itemId: string) {
    setExpandidos((cur) => {
      const next = new Set(cur)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      return next
    })
  }

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

  return (
    <div className="notas-page">
      <div className="ing-detalle-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>
          <IcoBack /> Volver
        </button>
        <h1 className="notas-titulo">OC {sesion.numero_oc}</h1>
        <div className="ing-detalle-estado">
          <BadgeSesion estado={sesion.estado} />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="ing-detalle-meta">
        <div className="ing-meta-item">
          <span className="ing-meta-label">Cliente</span>
          <span className="ing-meta-valor">{sesion.nombre_cliente ?? '—'}</span>
        </div>
        <div className="ing-meta-item">
          <span className="ing-meta-label">Progreso</span>
          <span className="ing-meta-valor">{sesion.items_completados}/{sesion.total_items}</span>
        </div>
        <div className="ing-meta-item">
          <span className="ing-meta-label">Archivo</span>
          <span className="ing-meta-valor">{sesion.archivo_nombre ?? '—'}</span>
        </div>
      </div>

      <div className="nota-progreso-barra">
        <div
          className="nota-progreso-fill"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--danger)',
          }}
        />
      </div>

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

      <div className="ing-productos-lista">
        {sesion.items.map((item) => {
          const abierto = expandidos.has(item.id)
          return (
            <div key={item.id} className="ing-prod-item">
              <button type="button" className="ing-prod-fila" onClick={() => toggleExpandido(item.id)}>
                <span>{item.codigo} — {item.descripcion}</span>
                <span className="nota-fila-progreso">
                  <span className="nota-progreso-texto">{item.cantidad_despachada}/{item.cantidad_pedida}</span>
                  <BadgeItem estado={item.estado} />
                  <IcoChevron activo={abierto} />
                </span>
              </button>

              {abierto && (
                <div className="ing-prod-detalle">
                  {item.subtareas_picking_masivo.length === 0 ? (
                    <p className="picking-nombre">Sin subtareas generadas (sin stock disponible)</p>
                  ) : (
                    item.subtareas_picking_masivo
                      .sort((a, b) => a.orden_fifo - b.orden_fifo)
                      .map((sub) => (
                        <div key={sub.id} className="ing-meta-item">
                          <span className="ing-meta-label">
                            #{sub.orden_fifo} · {sub.posicion_codigo}
                            {sub.es_equivalente && ' · equivalente'}
                          </span>
                          <span className="ing-meta-valor">
                            {sub.cantidad_despachada ?? 0}/{sub.cantidad_asignada}
                            {' '}
                            <BadgeSubtarea estado={sub.estado} />
                          </span>
                          {sub.motivo_diferencia && (
                            <span className="picking-nombre">Motivo: {sub.motivo_diferencia}</span>
                          )}
                        </div>
                      ))
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
