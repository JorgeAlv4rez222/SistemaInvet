import { useNavigate } from 'react-router-dom'
import { useSesionesPicking } from '../hooks/usePickingMasivo'
import { useRealtimeSesiones } from '../hooks/useRealtimePicking'
import type { SesionResumen } from '../services/picking-masivo.api'

const ESTADO_LABELS: Record<string, string> = {
  validando:  'Validando',
  activa:     'Activa',
  completada: 'Completada',
  cancelada:  'Cancelada',
}

function BadgeEstado({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado}`}>{ESTADO_LABELS[estado] ?? estado}</span>
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—'
  return fecha.slice(0, 10).split('-').reverse().join('-')
}

export function PickingMasivoPage() {
  const navigate = useNavigate()
  const ROL       = localStorage.getItem('user_rol') ?? ''

  const { data, isLoading, isError } = useSesionesPicking()
  useRealtimeSesiones()

  const sesiones = data ?? []

  return (
    <div className="notas-page">
      <div className="notas-veroc-wrap">
        <h1 className="notas-titulo">Picking Masivo</h1>
        {ROL === 'admin' && (
          <button className="btn-primario" onClick={() => navigate('/picking-masivo/nueva')}>
            + Nueva sesión
          </button>
        )}
      </div>

      {isLoading && <p className="cargando">Cargando sesiones…</p>}
      {isError   && <p className="error">Error al cargar sesiones</p>}
      {!isLoading && !isError && sesiones.length === 0 && (
        <div className="notas-vacio"><p>No hay sesiones de picking masivo</p></div>
      )}

      {!isLoading && !isError && sesiones.length > 0 && (
        <>
          <p className="notas-conteo">{sesiones.length} sesión{sesiones.length !== 1 ? 'es' : ''}</p>
          <div className="notas-lista-panel">
            <div className="notas-lista-scroll">
              <div className="notas-lista-filas">
                {sesiones.map((s: SesionResumen) => {
                  const pct = s.total_items ? Math.round((s.items_completados / s.total_items) * 100) : 0
                  return (
                    <div key={s.id} className="nota-fila-item">
                      <div
                        className="pm-sesion-fila"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/picking-masivo/${s.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/picking-masivo/${s.id}`) }
                        }}
                      >
                        <div className="pm-sesion-info">
                          <span className="pm-sesion-nombre">{s.nombre_cliente ?? s.numero_oc}</span>
                          <span className="pm-sesion-oc">Entrega: {s.numero_oc}</span>
                        </div>

                        <div className="pm-sesion-progreso">
                          <div className="nota-progreso-barra">
                            <div
                              className="nota-progreso-fill"
                              style={{
                                width: `${pct}%`,
                                background: pct === 100 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--danger)',
                              }}
                            />
                          </div>
                          <span className="nota-progreso-texto">{s.items_completados}/{s.total_items} · {pct}%</span>
                        </div>

                        <span className="pm-sesion-fecha">{formatearFecha(s.creado_en)}</span>

                        <BadgeEstado estado={s.estado} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
