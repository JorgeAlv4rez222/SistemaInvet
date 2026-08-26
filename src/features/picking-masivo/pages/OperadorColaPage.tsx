import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useColaSubtareas, useLiberarPropias, useSesionPicking, useTomarSubtarea } from '../hooks/usePickingMasivo'
import { useRealtimeSesion } from '../hooks/useRealtimePicking'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { SubtareaResumen } from '../services/picking-masivo.api'

export function OperadorColaPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sesionId = id ?? null
  const operadorId = localStorage.getItem('user_id') ?? ''

  const { data, isLoading, isError } = useColaSubtareas(sesionId)
  const { data: sesion } = useSesionPicking(sesionId)
  useRealtimeSesion(sesionId)
  const tomarSubtarea   = useTomarSubtarea(sesionId ?? '')
  const liberarPropias  = useLiberarPropias(sesionId ?? '')

  const [tomandoId, setTomandoId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const subtareas = data ?? []
  const tengoPropias = subtareas.some((s) => s.estado === 'bloqueado' && s.bloqueado_por === operadorId)

  async function handleTomar(sub: SubtareaResumen) {
    if (!sesionId) return
    setError(null)
    setTomandoId(sub.id)
    try {
      await tomarSubtarea.mutateAsync({ subtareaId: sub.id, usuarioId: operadorId })
      navigate(`/picking-masivo/operador/${sesionId}/confirmar/${sub.id}`)
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'No se pudo tomar la subtarea')
    } finally {
      setTomandoId(null)
    }
  }

  async function handleLiberar() {
    if (!sesionId) return
    setError(null)
    await liberarPropias.mutateAsync({ sesionId, usuarioId: operadorId })
  }

  return (
    <div className="notas-page">
      <div className="notas-veroc-wrap">
        <h1 className="notas-titulo">Cola de trabajo</h1>
        <button className="btn-secundario" disabled={!tengoPropias || liberarPropias.isPending} onClick={handleLiberar}>
          Liberar mis tareas
        </button>
      </div>

      {sesion && (
        <div className="pm-cola-sesion-card">
          <span className="pm-cola-sesion-nombre">{sesion.nombre_cliente ?? sesion.numero_oc}</span>
          <span className="pm-cola-sesion-fecha">Entrega: {sesion.numero_oc}</span>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {isLoading && <p className="cargando">Cargando cola…</p>}
      {isError   && <p className="error">Error al cargar la cola</p>}
      {!isLoading && !isError && subtareas.length === 0 && (
        <div className="notas-vacio"><p>No hay subtareas pendientes</p></div>
      )}

      {!isLoading && !isError && subtareas.length > 0 && (
        <div className="pm-cola-lista">
          {subtareas.map((sub: SubtareaResumen) => {
            const esMia          = sub.estado === 'bloqueado' && sub.bloqueado_por === operadorId
            const bloqueadaXOtro = sub.estado === 'bloqueado' && sub.bloqueado_por !== operadorId
            const esParcial      = sub.estado === 'parcial' || sub.estado === 'sin_stock'
            const lpn            = sub.items_picking_masivo?.lpn

            return (
              <div key={sub.id} className={`pm-cola-fila ${bloqueadaXOtro ? 'pm-cola-fila--bloqueada' : ''} ${esParcial ? 'pm-cola-fila--parcial' : ''}`}>
                <div className="pm-cola-fila-info">
                  <span className="pm-cola-fila-codigo">{sub.items_picking_masivo?.codigo}</span>
                  <div className="pm-cola-fila-meta">
                    {sub.posicion_codigo !== '—' && (
                      <span className="pm-cola-fila-pos">{sub.posicion_codigo}</span>
                    )}
                    {lpn && <span className="pm-cola-fila-lpn">LPN: {lpn}</span>}
                    <span className="pm-cola-fila-cant">
                      {esParcial
                        ? `${sub.cantidad_despachada ?? 0}/${sub.cantidad_asignada} uds`
                        : `${sub.cantidad_asignada} uds`}
                    </span>
                  </div>
                </div>

                <div className="pm-cola-fila-accion">
                  {esParcial ? (
                    <button className="btn-secundario" onClick={() => navigate(`/picking-masivo/operador/${sesionId}/confirmar/${sub.id}`)}>
                      Editar parcial
                    </button>
                  ) : esMia ? (
                    <button className="btn-primario" onClick={() => navigate(`/picking-masivo/operador/${sesionId}/confirmar/${sub.id}`)}>
                      Continuar
                    </button>
                  ) : bloqueadaXOtro ? (
                    <span className="badge badge-bloqueado">Tomada</span>
                  ) : (
                    <button className="btn-primario" disabled={tomandoId === sub.id} onClick={() => handleTomar(sub)}>
                      {tomandoId === sub.id ? 'Tomando…' : 'Tomar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
