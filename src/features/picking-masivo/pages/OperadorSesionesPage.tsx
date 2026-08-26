import { useNavigate } from 'react-router-dom'
import { useSesionesPicking } from '../hooks/usePickingMasivo'
import { useRealtimeSesiones } from '../hooks/useRealtimePicking'
import type { SesionResumen } from '../services/picking-masivo.api'

export function OperadorSesionesPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useSesionesPicking('activa')
  useRealtimeSesiones()

  const sesiones = data ?? []

  return (
    <div className="notas-page">
      <h1 className="notas-titulo">Picking Masivo — Sesiones activas</h1>

      {isLoading && <p className="cargando">Cargando sesiones…</p>}
      {isError   && <p className="error">Error al cargar sesiones</p>}
      {!isLoading && !isError && sesiones.length === 0 && (
        <div className="notas-vacio"><p>No hay sesiones activas en este momento</p></div>
      )}

      {!isLoading && !isError && sesiones.length > 0 && (
        <div className="notas-lista-panel">
          <div className="notas-lista-scroll">
            <div className="notas-lista-filas">
              {sesiones.map((s: SesionResumen) => {
                const pct = s.total_items ? Math.round((s.items_completados / s.total_items) * 100) : 0
                return (
                  <div key={s.id} className="pm-op-sesion-item">
                    <div className="pm-op-sesion-info">
                      <span className="pm-op-sesion-nombre">{s.nombre_cliente ?? s.numero_oc}</span>
                      <span className="pm-op-sesion-oc">Entrega: {s.numero_oc}</span>
                    </div>
                    <div className="pm-op-sesion-progreso">
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
                    <button className="btn-primario pm-op-sesion-btn" onClick={() => navigate(`/picking-masivo/operador/${s.id}`)}>
                      Unirse
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
