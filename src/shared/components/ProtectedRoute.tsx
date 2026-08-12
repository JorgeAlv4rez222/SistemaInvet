import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import type { UserRole } from '../types/base'

const RUTAS_SOLO_ADMIN = ['/ingresos', '/salidas']

interface Props {
  children:   React.ReactNode
  rutaActual: string
}

function limpiarSesion() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_rol')
  localStorage.removeItem('user_id')
  localStorage.removeItem('user_nombre')
}

// Valida el token en el servidor una vez por sesión de pestaña
let tokenValidado: string | null = null

export function ProtectedRoute({ children, rutaActual }: Props) {
  const token = localStorage.getItem('auth_token')
  const rol   = localStorage.getItem('user_rol') as UserRole | null

  const [estado, setEstado] = useState<'verificando' | 'ok' | 'invalido'>(
    // Si ya validamos este token en esta pestaña, no repetir
    token && token === tokenValidado ? 'ok' : (token ? 'verificando' : 'invalido')
  )

  const verificado = useRef(false)

  useEffect(() => {
    if (estado !== 'verificando' || verificado.current) return
    verificado.current = true

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('invalido')
        tokenValidado = token
        setEstado('ok')
      })
      .catch(() => {
        limpiarSesion()
        tokenValidado = null
        setEstado('invalido')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (estado === 'verificando') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Verificando sesión…</p>
      </div>
    )
  }

  if (estado === 'invalido') {
    return <Navigate to="/login" replace />
  }

  // Operador intenta ruta de admin → /productos
  if (rol === 'operador' && RUTAS_SOLO_ADMIN.some((r) => rutaActual.startsWith(r))) {
    return <Navigate to="/productos" replace />
  }

  return <>{children}</>
}
