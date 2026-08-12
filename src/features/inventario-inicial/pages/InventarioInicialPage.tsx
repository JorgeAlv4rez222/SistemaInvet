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
          <h1>Inventario Inicial</h1>
          <span className="inv-page-subtitulo">
            Carga única de stock existente — posición por posición
          </span>
        </div>
        <div className="inv-aviso">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Este módulo solo debe usarse una vez al desplegar el sistema
        </div>
      </div>

      <CargaPosicionFlow usuarioId={usuarioId} />
    </div>
  )
}
