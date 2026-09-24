import { useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { UserRole } from '../types/base'
import type { Notificacion } from './useNotificacionesRealtime'

const STORAGE_KEY = 'notif_last_seen'
const POLL_MS     = 60_000 // polling cada 60 segundos

function guardarUltimaVisita() {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()) } catch { /* noop */ }
}

function leerUltimaVisita(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

// ── Operador: notas pendientes ────────────────────────────────────────────────
// - Al montar (inicial=true): muestra TODAS las pendientes sin filtro de fecha
// - En polling/visibility: solo las nuevas desde la última visita
async function checkNotasOperador(inicial: boolean): Promise<Notificacion | null> {
  const desde = inicial ? null : leerUltimaVisita()
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
      ? 'Hay 1 nota pendiente de preparar'
      : `Hay ${count} notas pendientes de preparar`,
  }
}

async function checkSesionesOperador(inicial: boolean): Promise<Notificacion | null> {
  const desde = inicial ? null : leerUltimaVisita()
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
      ? 'Hay 1 sesión de picking masivo asignada'
      : `Hay ${count} sesiones de picking masivo asignadas`,
  }
}

// ── Supervisor: notas completas ───────────────────────────────────────────────
// Rastrea el último count notificado para no spamear si el valor no cambia
async function checkNotasSupervisor(lastCountRef: { current: number }): Promise<Notificacion | null> {
  const { count, error } = await supabase
    .from('notas_venta')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'completa')
  if (error || count === null) return null
  if (count === 0) { lastCountRef.current = 0; return null }
  if (count === lastCountRef.current) return null   // sin cambio, no notificar
  lastCountRef.current = count
  return {
    tipo: 'nota_completa',
    mensaje: count === 1
      ? 'Hay 1 nota completada pendiente de validación'
      : `Hay ${count} notas completadas pendientes de validación`,
  }
}

async function checkSesionesSupervisor(lastCountRef: { current: number }): Promise<Notificacion | null> {
  const { count, error } = await supabase
    .from('sesiones_picking_masivo')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'completada')
  if (error || count === null) return null
  if (count === 0) { lastCountRef.current = 0; return null }
  if (count === lastCountRef.current) return null
  lastCountRef.current = count
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
): { recheck: () => void } {
  const cbRef             = useRef(onNotificacion)
  cbRef.current           = onNotificacion
  const lastNotasRef      = useRef(0)
  const lastSesionesRef   = useRef(0)
  const inicialRef        = useRef(true)
  const checkRef          = useRef<() => void>(() => {})

  useEffect(() => {
    if (!rol) return

    inicialRef.current      = true
    lastNotasRef.current    = 0
    lastSesionesRef.current = 0

    async function check() {
      const esInicial = inicialRef.current
      inicialRef.current = false

      if (rol === 'operador') {
        const [notas, sesiones] = await Promise.all([
          checkNotasOperador(esInicial),
          checkSesionesOperador(esInicial),
        ])
        if (notas)    cbRef.current(notas)
        if (sesiones) cbRef.current(sesiones)
        if (!esInicial) guardarUltimaVisita()
      } else {
        const [notas, sesiones] = await Promise.all([
          checkNotasSupervisor(lastNotasRef),
          checkSesionesSupervisor(lastSesionesRef),
        ])
        if (notas)    cbRef.current(notas)
        if (sesiones) cbRef.current(sesiones)
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
