import { initSupabase } from '../../api/lib/supabase/client'
import { salidasService } from '../../api/salidas/salidas.service'
import { json, sp, type Env } from '../_lib/cf'
import { z } from 'zod'

const validarProductoSchema = z.object({
  adminId: z.string().uuid(), notaProductoId: z.string().uuid(),
  codigoProducto: z.string().optional().default(''), cantidadIngresada: z.number().int().positive(),
  comentario: z.string().optional(),
})

export async function onRequest({ request, env }: { request: Request; env: Env }): Promise<Response> {
  initSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  if (request.method === 'GET') {
    const result = await salidasService.obtenerNotasParaRevision()
    if (!result.ok) return json({ error: result.error }, 500)
    const mapped = result.data.map((n: any) => ({
      notaId:             n.id,
      numeroNota:         n.numero_nota,
      nombreCliente:      n.nombre_cliente,
      estado:             n.estado,
      totalProductos:     n.totalProductos,
      productosCompletos: n.totalRevisados,
      creadoEn:           n.created_at,
    }))
    return json(mapped)
  }

  if (request.method === 'POST') {
    const accion = sp(request).get('accion')
    if (accion === 'validar-producto') {
      const body   = await request.json().catch(() => ({}))
      const parsed = validarProductoSchema.safeParse(body)
      if (!parsed.success) return json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }, 400)
      const result = await salidasService.validarProductoRevision(parsed.data)
      if (!result.ok) {
        const status = (result.error as any).code === 'UNAUTHORIZED' ? 403
          : (result.error as any).code === 'NOT_FOUND' ? 404 : 400
        return json({ error: result.error }, status)
      }
      return json(result.data)
    }
    return json({ error: { code: 'INVALID_ACTION', message: 'Acción no reconocida' } }, 400)
  }

  return json({ error: 'Método no permitido' }, 405)
}
