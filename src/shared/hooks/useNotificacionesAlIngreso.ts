import { useEffect, useRef } from 'react'
import { apiClient } from '../utils/apiClient'
import type { UserRole } from '../types/base'
import type { Notificacion } from './useNotificacionesRealtime'

const STORAGE_KEY = 'notif_last_seen'
const POLL_MS     = 60_000

function guardarUltimaVisita() {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()) } catch { /* noop */ }
}

function leerUltimaVisita(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

type NotifCounts = { notasCount: number; sesionesCount: number }

async function fetchCounts(rol: string, desde: string | null): Promise<NotifCounts> {
  const params = new URLSearchParams({ accion: 'notif-counts', rol })
  if (desde != null) params.set('desde', desde)
  return apiClient.get<NotifCounts>(`/notas?${params.toString()}`)
}

export function useNotificacionesAlIngreso(
  rol: UserRole | null,
  onNotificacion: (n: Notificacion) => void,
): { recheck: () => void } {
  const cbRef           = useRef(onNotificacion)
  cbRef.current         = onNotificacion
  const lastNotasRef    = useRef(-1)   // -1 = aún no chequeado
  const lastSesionesRef = useRef(-1)
  const inicialRef      = useRef(true)
  const checkRef        = useRef<() => void>(() => {})

  useEffect(() => {
    if (!rol) return

    inicialRef.current    = true
    lastNotasRef.current  = -1
    lastSesionesRef.current = -1

    async function check() {
      const esInicial = inicialRef.current
      inicialRef.current = false

      // Operador: inicial sin filtro de fecha; polling con desde
      // Supervisor/admin: siempre sin filtro de fecha
      const desde = (rol === 'operador' && !esInicial) ? leerUltimaVisita() : null

      try {
        const { notasCount, sesionesCount } = await fetchCounts(rol as string, desde)

        if (rol === 'operador') {
          if (notasCount > 0) {
            cbRef.current({
              tipo: 'nueva_nota',
              mensaje: notasCount === 1
                ? 'Hay 1 nota pendiente de preparar'
                : `Hay ${notasCount} notas pendientes de preparar`,
            })
          }
          if (sesionesCount > 0) {
            cbRef.current({
              tipo: 'nueva_nota',
              mensaje: sesionesCount === 1
                ? 'Hay 1 sesión de picking masivo asignada'
                : `Hay ${sesionesCount} sesiones de picking masivo asignadas`,
            })
          }
          if (!esInicial) guardarUltimaVisita()
        } else {
          // Solo notificar si el count cambió respecto al último
          if (notasCount !== lastNotasRef.current && notasCount > 0) {
            cbRef.current({
              tipo: 'nota_completa',
              mensaje: notasCount === 1
                ? 'Hay 1 nota completada pendiente de validación'
                : `Hay ${notasCount} notas completadas pendientes de validación`,
            })
          }
          lastNotasRef.current = notasCount

          if (sesionesCount !== lastSesionesRef.current && sesionesCount > 0) {
            cbRef.current({
              tipo: 'nota_completa',
              mensaje: sesionesCount === 1
                ? 'Hay 1 sesión de picking masivo completada pendiente de despacho'
                : `Hay ${sesionesCount} sesiones de picking masivo completadas pendientes de despacho`,
            })
          }
          lastSesionesRef.current = sesionesCount
        }
      } catch {
        // Sin conexión o error de API — silencioso
      }
    }

    checkRef.current = check
    check()

    const timer = setInterval(check, POLL_MS)

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        guardarUltimaVisita()
      } else {
        check()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      guardarUltimaVisita()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [rol])

  return { recheck: () => checkRef.current() }
}
