import { initSupabase } from '../../api/lib/supabase/client'
import { produccionService } from '../../api/produccion/produccion.service'
import { json, errStatus, sp, type Env } from '../_lib/cf'

export async function onRequest({ request, env }: { request: Request; env: Env }): Promise<Response> {
  initSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const params  = sp(request)
  const accion  = params.get('accion')

  if (request.method === 'GET') {
    if (accion === 'activa') {
      const usuarioId = params.get('usuarioId')
      if (!usuarioId) return json({ error: 'Falta usuarioId' }, 400)
      const result = await produccionService.obtenerTareaActiva(usuarioId)
      return result.ok ? json(result.data) : json({ error: result.error }, 500)
    }

    const usuarioId  = params.get('usuarioId')  ?? undefined
    const fecha      = params.get('fecha')       ?? undefined
    const sku        = params.get('sku')         ?? undefined
    const fechaDesde = params.get('fechaDesde')  ?? undefined
    const fechaHasta = params.get('fechaHasta')  ?? undefined
    const result = await produccionService.obtenerRegistros({ usuarioId, fecha, sku, fechaDesde, fechaHasta })
    return result.ok ? json(result.data) : json({ error: result.error }, 500)
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>

    if (accion === 'iniciar') {
      const { usuarioId, tipoTarea, sku, unidadesMeta } = body as any
      if (!usuarioId || !tipoTarea || !sku || !unidadesMeta) return json({ error: 'Faltan campos requeridos' }, 400)
      const result = await produccionService.iniciarTarea({ usuarioId, tipoTarea, sku, unidadesMeta: Number(unidadesMeta) })
      return result.ok ? json(result.data, 201) : json({ error: result.error }, errStatus((result.error as any).code))
    }

    if (accion === 'cerrar') {
      const { registroId, usuarioId, unidadesLogradas, observaciones } = body as any
      if (!registroId || !usuarioId) return json({ error: 'Faltan campos requeridos' }, 400)
      const result = await produccionService.cerrarTarea({ registroId, usuarioId, unidadesLogradas: Number(unidadesLogradas ?? 0), observaciones: observaciones ?? '' })
      return result.ok ? json(result.data) : json({ error: result.error }, errStatus((result.error as any).code))
    }

    return json({ error: 'Acción POST no reconocida' }, 400)
  }

  return json({ error: 'Método no permitido' }, 405)
}
