import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { notasService } from './notas.service'

const crearNotaSchema = z.object({
  adminId:        z.string().uuid(),
  numeroNota:     z.string().min(1),
  nombreCliente:  z.string().min(1),
  rutCliente:     z.string().min(1),
  numeroOc:       z.string().optional(),
  archivoNombre:  z.string().optional(),
  productos: z.array(z.object({
    productoId:          z.string().uuid(),
    cantidadSolicitada: z.number().int().positive(),
  })).min(1),
})

const pickingSchema = z.object({
  usuarioId:              z.string().uuid(),
  notaProductoId:         z.string().uuid(),
  codigoProducto:         z.string().min(1),
  cantidad:               z.number().int().positive(),
  usarEquivalente:        z.boolean().optional(),
  productoEquivalenteId:  z.string().uuid().optional(),
  comentarioOperador:     z.string().optional().nullable(),
})

const sinStockSchema = z.object({
  usuarioId:          z.string().uuid(),
  notaProductoId:     z.string().uuid(),
  comentarioOperador: z.string(),
})

const concluirParcialSchema = z.object({
  usuarioId:          z.string().uuid(),
  notaProductoId:     z.string().uuid(),
  comentarioOperador: z.string().optional(),
})

const cambiarEstadoSchema = z.object({
  adminId:      z.string().uuid(),
  notaId:       z.string().uuid(),
  nuevoEstado:  z.literal('lista_despacho'),
  nombreChofer: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accion, id, estado, usuarioId } = req.query

  if (req.method === 'GET') {
    if (typeof id === 'string') {
      const result = await notasService.obtenerDetalleNota(id, typeof usuarioId === 'string' ? usuarioId : undefined)
      if (!result.ok) return res.status(404).json({ error: result.error })
      return res.status(200).json(result.data)
    }

    const result = await notasService.obtenerNotas(typeof estado === 'string' ? estado : undefined)
    if (!result.ok) return res.status(500).json({ error: result.error })
    return res.status(200).json(result.data)
  }

  if (req.method === 'POST') {
    if (accion === 'picking') {
      const parsed = pickingSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      }
      const result = await notasService.registrarPicking(parsed.data)
      if (!result.ok) return res.status(400).json({ error: result.error })
      return res.status(200).json(result.data)
    }

    if (accion === 'sin-stock') {
      const parsed = sinStockSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      }
      const result = await notasService.registrarSinStock(parsed.data)
      if (!result.ok) return res.status(400).json({ error: result.error })
      return res.status(200).json(result.data)
    }

    if (accion === 'concluir-parcial') {
      const parsed = concluirParcialSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      }
      const result = await notasService.concluirParcial(parsed.data)
      if (!result.ok) return res.status(400).json({ error: result.error })
      return res.status(200).json(result.data)
    }

    if (accion === 'cambiar-estado') {
      const parsed = cambiarEstadoSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      }
      const result = await notasService.cambiarEstadoNota(parsed.data)
      if (!result.ok) return res.status(400).json({ error: result.error })
      return res.status(200).json(result.data)
    }

    const parsed = crearNotaSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }
    const result = await notasService.crearNota(parsed.data)
    if (!result.ok) return res.status(400).json({ error: result.error })
    return res.status(201).json(result.data)
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
