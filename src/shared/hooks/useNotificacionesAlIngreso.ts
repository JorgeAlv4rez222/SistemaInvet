import { useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { UserRole } from '../types/base'
import type { Notificacion } from './useNotificacionesRealtime'

const STORAGE_KEY = 'notif_last_seen'

function guardarUltimaVisita() {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()) } catch { /* noop */ }
}

function leerUltimaVisita(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

async function checkNotasOperador(desde: string | null): Promise<Notificacion | null> {
  let q = supabase
    .from('notas_venta')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')
  if (desde) q = q.gt('created_at', desde)
  const { count, error } = await q
  if (error || !count || count === 0) return null
  return {
    tipo: 'nueva_nota',
    mensaje: count === 1
      ? 'Hay 1 nota nueva pendiente de preparar'
      : `Hay ${count} notas nuevas pendientes de preparar`,
  }
}

async function checkSesionesOperador(desde: string | null): Promise<Notificacion | null> {
  let q = supabase
    .from('sesiones_picking_masivo')
    .select('id', { count: 'exact', head: true })
    .in('estado', ['validando', 'en_proceso'])
  if (desde) q = q.gt('created_at', desde)
  const { count, error } = await q
  if (error || !count || count === 0) return null
  return {
    tipo: 'nueva_nota',
    mensaje: count === 1
      ? 'Hay 1 nueva sesión de picking masivo asignada'
      : `Hay ${count} nuevas sesiones de picking masivo asignadas`,
  }
}

async function checkNotasSupervisor(): Promise<Notificacion | null> {
  const { count, error } = await supabase
    .from('notas_venta')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'completa')
  if (error || !count || count === 0) return null
  return {
    tipo: 'nota_completa',
    mensaje: count === 1
      ? 'Hay 1 nota completada pendiente de validación'
      : `Hay ${count} notas completadas pendientes de validación`,
  }
}

async function checkSesionesSupervisor(): Promise<Notificacion | null> {
  const { count, error } = await supabase
    .from('sesiones_picking_masivo')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'completada')
  if (error || !count || count === 0) return null
  return {
    tipo: 'nota_completa',
    mensaje: count === 1
      ? 'Hay 1 sesión de picking masivo completada pendiente de despacho'
      : `Hay ${count} sesiones de picking masivo completadas pendientes de despacho`,
  }
}

export function useNotificacionesAlIngreso(
  rol: UserRole | null,
  onNotificacion: (n: Notificacion) => void,
) {
  const cbRef  = useRef(onNotificacion)
  cbRef.current = onNotificacion

  useEffect(() => {
    if (!rol) return

    async function check() {
      const desde = leerUltimaVisita()
      console.log('[Notif al ingreso] rol:', rol, 'desde:', desde)

      if (rol === 'operador') {
        const [notas, sesiones] = await Promise.all([
          checkNotasOperador(desde),
          checkSesionesOperador(desde),
        ])
        console.log('[Notif al ingreso] operador → notas:', notas, 'sesiones:', sesiones)
        if (notas)    cbRef.current(notas)
        if (sesiones) cbRef.current(sesiones)
      } else {
        const [notas, sesiones] = await Promise.all([
          checkNotasSupervisor(),
          checkSesionesSupervisor(),
        ])
        console.log('[Notif al ingreso] supervisor → notas:', notas, 'sesiones:', sesiones)
        if (notas)    cbRef.current(notas)
        if (sesiones) cbRef.current(sesiones)
      }
    }

    // Check al montar por primera vez con este rol
    check()

    // Guardar timestamp al ocultar; re-chequear al volver a ser visible
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
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [rol])
}
