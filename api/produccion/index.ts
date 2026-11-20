// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { produccionService } from './produccion.service'

const iniciarSchema = z.object({
  usuarioId:    z.string().uuid(),
  tipoTarea:    z.enum(['etiquetado','cambio_codigo','cambio_bolsa','codigo_sku_dun','sellado']),
  sku:          z.string().min(1),
  unidadesMeta: z.number().int().positive(),
})

const cerrarSchema = z.object({
  registroId:       z.string().uuid(),
  usuarioId:        z.string().uuid(),
  unidadesLogradas: z.number().int().min(0),
  observaciones:    z.string().default(''),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

  const { accion, usuarioId, fecha, sku, fechaDesde, fechaHasta } = req.query

  if (req.method === 'GET') {
    if (accion === 'activa') {
      if (typeof usuarioId !== 'string') return res.status(400).json({ error: 'Falta usuarioId' })
      const result = await produccionService.obtenerTareaActiva(usuarioId)
      if (!result.ok) return res.status(500).json({ error: result.error })
      return res.status(200).json(result.data)
    }

    const result = await produccionService.obtenerRegistros({
      usuarioId:   typeof usuarioId   === 'string' ? usuarioId   : undefined,
      fecha:       typeof fecha        === 'string' ? fecha        : undefined,
      sku:         typeof sku          === 'string' ? sku          : undefined,
      fechaDesde:  typeof fechaDesde   === 'string' ? fechaDesde   : undefined,
      fechaHasta:  typeof fechaHasta   === 'string' ? fechaHasta   : undefined,
    })
    if (!result.ok) return res.status(500).json({ error: result.error })
    return res.status(200).json(result.data)
  }

  if (req.method === 'POST') {
    if (accion === 'iniciar') {
      const parsed = iniciarSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await produccionService.iniciarTarea(parsed.data)
      if (!result.ok) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'CONFLICT' ? 409 : 400
        return res.status(status).json({ error: result.error })
      }
      return res.status(201).json(result.data)
    }

    if (accion === 'cerrar') {
      const parsed = cerrarSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await produccionService.cerrarTarea(parsed.data)
      if (!result.ok) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : 400
        return res.status(status).json({ error: result.error })
      }
      return res.status(200).json(result.data)
    }

    return res.status(400).json({ error: 'Acción no reconocida' })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
