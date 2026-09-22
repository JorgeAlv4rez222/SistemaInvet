import { useParams, useNavigate } from 'react-router-dom'
import { useOla } from '../hooks/useOlas'
import { useAuth } from '../../auth/hooks/useAuth'

const ESTADO_LABEL: Record<string, string> = {
  validando:      'Validando',
  en_extraccion:  'En extracción',
  en_preparacion: 'En preparación',
  completada:     'Completada',
  despachada:     'Despachada',
  cancelada:      'Cancelada',
}

const ESTADO_BADGE: Record<string, string> = {
  validando:      'badge-validando',
  en_extraccion:  'badge-en-proceso',
  en_preparacion: 'badge-en-proceso',
  completada:     'badge-completado',
  despachada:     'badge-despachado',
  cancelada:      'badge-cancelada',
}

function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

export function OlaDetallePage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { sesion } = useAuth()
  const { data: ola, isLoading, error } = useOla(id ?? null)

  if (isLoading) return <div className="notas-page"><p className="text-muted" style={{ padding: '2rem' }}>Cargando ola…</p></div>
  if (error || !ola) return <div className="notas-page"><p className="error-banner">Ola no encontrada</p></div>

  const esOperador = sesion.rol === 'operador'

  return (
    <div className="notas-page">
      <div className="ing-detalle-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>
          <IcoBack /> Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 className="notas-titulo">
            Ola wave — {ola.proveedor.charAt(0).toUpperCase() + ola.proveedor.slice(1)}
          </h1>
          <span className={`badge ${ESTADO_BADGE[ola.estado] ?? ''}`}>
            {ESTADO_LABEL[ola.estado] ?? ola.estado}
          </span>
        </div>
      </div>

      {/* Resumen */}
      <div className="pm-ola-meta">
        <div className="pm-ola-meta-item"><span className="pm-ola-meta-label">Entrega</span><span>{ola.fecha_entrega}</span></div>
        <div className="pm-ola-meta-item"><span className="pm-ola-meta-label">Órdenes</span><span>{ola.total_ordenes}</span></div>
        <div className="pm-ola-meta-item"><span className="pm-ola-meta-label">LPNs</span><span>{ola.total_lineas}</span></div>
        <div className="pm-ola-meta-item"><span className="pm-ola-meta-label">Archivo</span><span style={{ fontSize: '0.8rem' }}>{ola.archivo_nombre ?? '—'}</span></div>
        {ola.creado_por_usuario && (
          <div className="pm-ola-meta-item"><span className="pm-ola-meta-label">Creado por</span><span>{ola.creado_por_usuario.nombre}</span></div>
        )}
      </div>

      {/* Acciones por fase */}
      <div className="pm-ola-acciones">
        {ola.estado === 'en_extraccion' && (
          <button className="btn-primario" onClick={() => navigate(`/picking-masivo/ola/${id}/extraccion`)}>
            Ir a extracción (Fase 1)
          </button>
        )}
        {ola.estado === 'en_preparacion' && (
          <button className="btn-primario" onClick={() => navigate(`/picking-masivo/ola/${id}/preparacion`)}>
            Ir a preparación LPN (Fase 2)
          </button>
        )}
        {ola.estado === 'completada' && !esOperador && (
          <button className="btn-primario" onClick={() => navigate(`/picking-masivo/ola/${id}/despacho`)}>
            Ir a despacho (Fase 3)
          </button>
        )}
        {ola.estado === 'despachada' && (
          <p className="text-muted" style={{ padding: '1rem 0' }}>
            Ola despachada el {new Date(ola.despachada_en!).toLocaleDateString('es-CL')}
            {ola.nombre_chofer ? ` · Chofer: ${ola.nombre_chofer}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
