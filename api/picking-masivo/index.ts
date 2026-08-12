import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabase } from '../lib/supabase/client'
import { pickingMasivoService } from './picking-masivo.service'

// ─── Schemas de validación ────────────────────────────────────────────────────

const itemExcelSchema = z.object({
  codigo:        z.string().min(1),
  descripcion:   z.string().min(1),
  cantidadPedida: z.number().int().positive(),
  productoId:    z.string().uuid().optional(),
})

const validarExcelSchema = z.object({
  items: z.array(itemExcelSchema).min(1),
})

const crearSesionSchema = z.object({
  usuarioId:     z.string().uuid(),
  numeroOc:      z.string().min(1),
  nombreCliente: z.string().optional(),
  archivoNombre: z.string().min(1),
  items:         z.array(itemExcelSchema).min(1),
})

const activarSesionSchema = z.object({
  sesionId:  z.string().uuid(),
  usuarioId: z.string().uuid(),
})

const tomarSubtareaSchema = z.object({
  subtareaId: z.string().uuid(),
  usuarioId:  z.string().uuid(),
})

const confirmarSubtareaSchema = z.object({
  subtareaId:         z.string().uuid(),
  usuarioId:          z.string().uuid(),
  cantidadDespachada: z.number().int().min(0),
  motivo:             z.string().optional(),
  productoRealId:     z.string().uuid().optional(),
})

const liberarPropiasSchema = z.object({
  sesionId:  z.string().uuid(),
  usuarioId: z.string().uuid(),
})

const cancelarSesionSchema = z.object({
  sesionId: z.string().uuid(),
})

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getUsuarioId(req: NextApiRequest): Promise<string | null> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accion, id, estado } = req.query

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store')

    if (accion === 'sesiones') {
      const filtroEstado = typeof estado === 'string' ? estado : undefined
      const result = await pickingMasivoService.listarSesiones(filtroEstado)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(500).json({ error: result.error })
    }

    if (accion === 'sesion') {
      if (typeof id !== 'string') return res.status(400).json({ error: 'Falta id' })
      const result = await pickingMasivoService.obtenerSesion(id)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(result.error.code === 'NOT_FOUND' ? 404 : 500).json({ error: result.error })
    }

    if (accion === 'cola') {
      const usuarioId = await getUsuarioId(req)
      if (!usuarioId) return res.status(401).json({ error: 'No autenticado' })
      if (typeof id !== 'string') return res.status(400).json({ error: 'Falta id de sesión' })
      const result = await pickingMasivoService.colaSubtareas(id, usuarioId)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(500).json({ error: result.error })
    }

    return res.status(400).json({ error: 'Acción GET no reconocida' })
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {

    if (accion === 'validar-excel') {
      const parsed = validarExcelSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.validarExcel(parsed.data)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(500).json({ error: result.error })
    }

    if (accion === 'crear-sesion') {
      const parsed = crearSesionSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.crearSesion(parsed.data)
      return result.ok
        ? res.status(201).json(result.data)
        : res.status(500).json({ error: result.error })
    }

    if (accion === 'activar-sesion') {
      const parsed = activarSesionSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.activarSesion(parsed.data)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(
            result.error.code === 'NOT_FOUND' ? 404
            : result.error.code === 'INVALID_STATE' ? 409
            : 500
          ).json({ error: result.error })
    }

    if (accion === 'tomar-subtarea') {
      const parsed = tomarSubtareaSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.tomarSubtarea(parsed.data)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(
            result.error.code === 'NOT_FOUND' ? 404
            : result.error.code === 'CONFLICT' ? 409
            : 500
          ).json({ error: result.error })
    }

    if (accion === 'confirmar-subtarea') {
      const parsed = confirmarSubtareaSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.confirmarSubtarea(parsed.data)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(
            result.error.code === 'NOT_FOUND' ? 404
            : result.error.code === 'UNAUTHORIZED' ? 403
            : result.error.code === 'VALIDATION_ERROR' ? 400
            : result.error.code === 'INVALID_STATE' ? 409
            : 500
          ).json({ error: result.error })
    }

    if (accion === 'liberar-propias') {
      const parsed = liberarPropiasSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.liberarPropias(parsed.data)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(500).json({ error: result.error })
    }

    if (accion === 'cancelar-sesion') {
      const parsed = cancelarSesionSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
      const result = await pickingMasivoService.cancelarSesion(parsed.data.sesionId)
      return result.ok
        ? res.status(200).json(result.data)
        : res.status(
            result.error.code === 'NOT_FOUND' ? 404
            : result.error.code === 'INVALID_STATE' ? 409
            : 500
          ).json({ error: result.error })
    }

    return res.status(400).json({ error: 'Acción POST no reconocida' })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
