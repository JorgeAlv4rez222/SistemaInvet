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
  const [filtro, setFiltro]       = useState<'todas' | 'mias' | 'tomadas' | 'parcial' | 'completas'>('todas')

  const subtareas = data ?? []
  const tengoPropias = subtareas.some((s) => s.estado === 'bloqueado' && s.bloqueado_por === operadorId)

  const subtareasFiltradas = subtareas.filter((s) => {
    if (filtro === 'todas')     return s.estado !== 'completado'
    if (filtro === 'mias')      return s.estado === 'bloqueado' && s.bloqueado_por === operadorId
    if (filtro === 'tomadas')   return s.estado === 'bloqueado' && s.bloqueado_por !== operadorId
    if (filtro === 'parcial')   return s.estado === 'parcial' || s.estado === 'sin_stock'
    if (filtro === 'completas') return s.estado === 'completado'
    return true
  })

  const cntMias     = subtareas.filter((s) => s.estado === 'bloqueado' && s.bloqueado_por === operadorId).length
  const cntTomadas  = subtareas.filter((s) => s.estado === 'bloqueado' && s.bloqueado_por !== operadorId).length
  const cntParcial  = subtareas.filter((s) => s.estado === 'parcial' || s.estado === 'sin_stock').length
  const cntCompletas = subtareas.filter((s) => s.estado === 'completado').length

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

      {sesion && (
        <div className="pm-cola-progreso">
          <div className="pm-cola-progreso-header">
            <span className="pm-cola-progreso-label">Progreso</span>
            <span className="pm-cola-progreso-ratio">{sesion.items_completados} / {sesion.total_items} productos</span>
          </div>
          <div className="pm-cola-progreso-barra">
            <div
              className="pm-cola-progreso-fill"
              style={{ width: sesion.total_items ? `${Math.round((sesion.items_completados / sesion.total_items) * 100)}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="filtros-wrap">
        <button className={`filtro-btn ${filtro === 'todas'     ? 'activo' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
        <button className={`filtro-btn ${filtro === 'mias'      ? 'activo' : ''}`} onClick={() => setFiltro('mias')}>Continuar {cntMias > 0 && <span className="filtro-badge">{cntMias}</span>}</button>
        <button className={`filtro-btn ${filtro === 'tomadas'   ? 'activo' : ''}`} onClick={() => setFiltro('tomadas')}>Tomadas {cntTomadas > 0 && <span className="filtro-badge">{cntTomadas}</span>}</button>
        <button className={`filtro-btn ${filtro === 'parcial'   ? 'activo' : ''}`} onClick={() => setFiltro('parcial')}>Parcial {cntParcial > 0 && <span className="filtro-badge">{cntParcial}</span>}</button>
        <button className={`filtro-btn ${filtro === 'completas' ? 'activo' : ''}`} onClick={() => setFiltro('completas')}>Completas {cntCompletas > 0 && <span className="filtro-badge">{cntCompletas}</span>}</button>
      </div>

      {isLoading && <p className="cargando">Cargando cola…</p>}
      {isError   && <p className="error">Error al cargar la cola</p>}
      {!isLoading && !isError && subtareasFiltradas.length === 0 && (
        <div className="notas-vacio"><p>{filtro === 'todas' ? 'No hay subtareas pendientes' : 'Sin resultados para este filtro'}</p></div>
      )}

      {!isLoading && !isError && subtareasFiltradas.length > 0 && (
        <div className="pm-cola-lista">
          {subtareasFiltradas.map((sub: SubtareaResumen) => {
            const esMia          = sub.estado === 'bloqueado' && sub.bloqueado_por === operadorId
            const bloqueadaXOtro = sub.estado === 'bloqueado' && sub.bloqueado_por !== operadorId
            const esParcial      = sub.estado === 'parcial' || sub.estado === 'sin_stock'
            const lpn            = sub.items_picking_masivo?.lpn

            return (
              <div key={sub.id} className={`pm-cola-fila ${bloqueadaXOtro ? 'pm-cola-fila--bloqueada' : ''} ${esParcial ? 'pm-cola-fila--parcial' : ''}`}>
                <div className="pm-cola-fila-info">
                  {sub.items_picking_masivo?.descripcion && sub.items_picking_masivo.descripcion !== sub.items_picking_masivo.codigo && (
                    <span className="pm-cola-fila-nombre">{sub.items_picking_masivo.descripcion}</span>
                  )}
                  <span className="pm-cola-fila-codigo">{sub.items_picking_masivo?.codigo}</span>
                  <div className="pm-cola-fila-meta">
                    {sub.posicion_codigo !== '—' && (
                      <span className="pm-cola-fila-pos">{sub.posicion_codigo}</span>
                    )}
                    {lpn && <span className="pm-cola-fila-lpn">LPN: {lpn}</span>}
                    <span className="pm-cola-fila-cant">
                      <span>
                        {esParcial
                          ? `${sub.cantidad_despachada ?? 0}/${sub.cantidad_asignada}`
                          : `${sub.cantidad_asignada}`}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="pm-cola-fila-accion">
                  {sub.estado === 'completado' ? (
                    <span className="badge badge-completado">✓</span>
                  ) : esParcial ? (
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
