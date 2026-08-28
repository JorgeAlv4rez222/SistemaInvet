import { useEffect }         from 'react'
import { useNavigate }       from 'react-router-dom'
import { CargaPosicionFlow } from '../components/CargaPosicionFlow'

export function InventarioInicialPage() {
  const navigate   = useNavigate()
  const usuarioId  = localStorage.getItem('user_id')  ?? ''
  const rol        = localStorage.getItem('user_rol')  ?? ''

  useEffect(() => {
    if (rol !== 'admin') navigate('/home', { replace: true })
  }, [rol, navigate])

  if (rol !== 'admin') return null

  return (
    <div className="inv-page">
      <div className="inv-page-header">
        <div className="inv-page-titulo">
          <h1>Ubicación Inicial</h1>
          <span className="inv-page-subtitulo">
            Asignación de ubicación física para productos almacenados. (Pendiente de integración con SF para actualización de stock).
          </span>
        </div>
      </div>

      <CargaPosicionFlow usuarioId={usuarioId} />
    </div>
  )
}
