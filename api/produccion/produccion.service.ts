import { supabase } from '../lib/supabase/client'
import type { ServiceResult } from '../../src/shared/types/base'

export type TipoTarea = 'etiquetado' | 'cambio_codigo' | 'cambio_bolsa' | 'codigo_sku_dun' | 'sellado'

export type RegistroProduccion = {
  id:                string
  usuario_id:        string
  usuario_nombre?:   string
  tipo_tarea:        TipoTarea
  sku:               string
  unidades_meta:     number
  unidades_logradas: number | null
  hora_inicio:       string
  hora_fin:          string | null
  observaciones:     string | null
  created_at:        string
}

type IniciarParams = {
  usuarioId:    string
  tipoTarea:    TipoTarea
  sku:          string
  unidadesMeta: number
}

type CerrarParams = {
  registroId:        string
  usuarioId:         string
  unidadesLogradas:  number
  observaciones:     string
}

type ObtenerParams = {
  usuarioId?: string
  fecha?:     string   // YYYY-MM-DD
}

export const produccionService = {
  async iniciarTarea(params: IniciarParams): Promise<ServiceResult<RegistroProduccion>> {
    // Verificar que el SKU exista
    const { data: producto } = await supabase
      .from('productos')
      .select('id')
      .eq('sku', params.sku)
      .eq('activo', true)
      .maybeSingle()

    if (!producto) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `El SKU "${params.sku}" no existe en el catálogo.` } }
    }

    // Verificar que no tenga tarea activa
    const { data: activa } = await supabase
      .from('registros_produccion')
      .select('id')
      .eq('usuario_id', params.usuarioId)
      .is('hora_fin', null)
      .maybeSingle()

    if (activa) {
      return { ok: false, error: { code: 'CONFLICT', message: 'Ya tienes una tarea en curso. Ciérrala antes de iniciar una nueva.' } }
    }

    const { data, error } = await supabase
      .from('registros_produccion')
      .insert({
        usuario_id:    params.usuarioId,
        tipo_tarea:    params.tipoTarea,
        sku:           params.sku,
        unidades_meta: params.unidadesMeta,
      })
      .select()
      .single()

    if (error || !data) {
      return { ok: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Error al iniciar tarea.' } }
    }
    return { ok: true, data: data as RegistroProduccion }
  },

  async cerrarTarea(params: CerrarParams): Promise<ServiceResult<RegistroProduccion>> {
    const { data: registro } = await supabase
      .from('registros_produccion')
      .select('*')
      .eq('id', params.registroId)
      .eq('usuario_id', params.usuarioId)
      .is('hora_fin', null)
      .maybeSingle()

    if (!registro) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'No se encontró la tarea activa.' } }
    }

    const { data, error } = await supabase
      .from('registros_produccion')
      .update({
        hora_fin:          new Date().toISOString(),
        unidades_logradas: params.unidadesLogradas,
        observaciones:     params.observaciones || null,
      })
      .eq('id', params.registroId)
      .select()
      .single()

    if (error || !data) {
      return { ok: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Error al cerrar tarea.' } }
    }
    return { ok: true, data: data as RegistroProduccion }
  },

  async obtenerTareaActiva(usuarioId: string): Promise<ServiceResult<RegistroProduccion | null>> {
    const { data, error } = await supabase
      .from('registros_produccion')
      .select('*')
      .eq('usuario_id', usuarioId)
      .is('hora_fin', null)
      .maybeSingle()

    if (error) {
      return { ok: false, error: { code: 'DB_ERROR', message: error.message } }
    }
    return { ok: true, data: data as RegistroProduccion | null }
  },

  async obtenerRegistros(params: ObtenerParams & { sku?: string; fechaDesde?: string; fechaHasta?: string }): Promise<ServiceResult<RegistroProduccion[]>> {
    let query = supabase
      .from('registros_produccion')
      .select('*, usuarios(nombre)')
      .order('hora_inicio', { ascending: false })

    if (params.usuarioId)  query = query.eq('usuario_id', params.usuarioId)
    if (params.sku)        query = query.ilike('sku', `%${params.sku}%`)

    if (params.fecha) {
      const inicio = `${params.fecha}T00:00:00.000Z`
      const fin    = `${params.fecha}T23:59:59.999Z`
      query = query.gte('hora_inicio', inicio).lte('hora_inicio', fin)
    } else {
      if (params.fechaDesde) query = query.gte('hora_inicio', `${params.fechaDesde}T00:00:00.000Z`)
      if (params.fechaHasta) query = query.lte('hora_inicio', `${params.fechaHasta}T23:59:59.999Z`)
    }

    const { data, error } = await query
    if (error) {
      return { ok: false, error: { code: 'DB_ERROR', message: error.message } }
    }

    const registros = (data ?? []).map((r: any) => ({
      ...r,
      usuario_nombre: r.usuarios?.nombre ?? null,
      usuarios:       undefined,
    })) as RegistroProduccion[]

    return { ok: true, data: registros }
  },
}
