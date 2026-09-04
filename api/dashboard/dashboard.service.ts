import { supabase } from '../lib/supabase/client'
import type { ServiceResult } from '../../src/shared/types/base'

export type MesDespacho = { mes: string; label: string; cantidad: number }

export type FiltrosDespachosMensuales = {
  cliente?:    string
  productoId?: string
  numeroNota?: string
}

export type DespachosMensuales = { meses: MesDespacho[]; total: number }

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function labelMes(clave: string): string {
  const [anio, mes] = clave.split('-').map(Number)
  return `${MESES_LABEL[mes - 1]} ${anio}`
}

// Últimos 12 meses móviles, terminando en el mes actual
function ultimos12Meses(): { inicio: Date; claves: string[] } {
  const hoy    = new Date()
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1)
  const claves = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  return { inicio, claves }
}

export const dashboardService = {

  async obtenerDespachosMensuales(filtros: FiltrosDespachosMensuales): Promise<ServiceResult<DespachosMensuales>> {
    const { inicio, claves } = ultimos12Meses()
    const mesesVacios = () => claves.map((mes) => ({ mes, label: labelMes(mes), cantidad: 0 }))

    // Filtro por producto: primero resolver qué notas de venta lo contienen
    let notaVentaIdsProducto: string[] | null = null
    if (filtros.productoId) {
      const { data, error } = await supabase
        .from('nota_productos')
        .select('nota_venta_id')
        .eq('producto_id', filtros.productoId)

      if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

      notaVentaIdsProducto = Array.from(new Set((data ?? []).map((r) => r.nota_venta_id)))
      if (notaVentaIdsProducto.length === 0) {
        return { ok: true, data: { meses: mesesVacios(), total: 0 } }
      }
    }

    let query = supabase
      .from('despachos')
      .select('fecha_despacho, notas_venta!inner(id)')
      .gte('fecha_despacho', inicio.toISOString())

    if (filtros.cliente)      query = query.ilike('notas_venta.nombre_cliente', `%${filtros.cliente}%`)
    if (filtros.numeroNota)   query = query.ilike('notas_venta.numero_nota', `%${filtros.numeroNota}%`)
    if (notaVentaIdsProducto) query = query.in('notas_venta.id', notaVentaIdsProducto)

    const { data, error } = await query
    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    const conteo = new Map<string, number>(claves.map((c) => [c, 0]))
    for (const row of (data as { fecha_despacho: string }[] ?? [])) {
      const mes = row.fecha_despacho.slice(0, 7)
      if (conteo.has(mes)) conteo.set(mes, (conteo.get(mes) ?? 0) + 1)
    }

    const meses = claves.map((mes) => ({ mes, label: labelMes(mes), cantidad: conteo.get(mes) ?? 0 }))
    const total = meses.reduce((s, m) => s + m.cantidad, 0)

    return { ok: true, data: { meses, total } }
  },

  async obtenerDespachosSemana(): Promise<ServiceResult<{ dias: { dia: string; label: string; cant: number }[]; total: number }>> {
    const DIAS_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const hoy   = new Date()
    const inicio = new Date(hoy)
    inicio.setDate(inicio.getDate() - 6)
    inicio.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('despachos')
      .select('fecha_despacho')
      .gte('fecha_despacho', inicio.toISOString())

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      return { dia: d.toISOString().slice(0, 10), label: DIAS_LABEL[d.getDay()], cant: 0 }
    })

    for (const row of (data as { fecha_despacho: string }[] ?? [])) {
      const key = row.fecha_despacho.slice(0, 10)
      const found = dias.find((d) => d.dia === key)
      if (found) found.cant++
    }

    return { ok: true, data: { dias, total: dias.reduce((s, d) => s + d.cant, 0) } }
  },

  async obtenerClientes(): Promise<ServiceResult<string[]>> {
    const { data, error } = await supabase.from('notas_venta').select('nombre_cliente')
    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    const clientes = Array.from(new Set((data ?? []).map((r) => r.nombre_cliente))).sort((a, b) => a.localeCompare(b))
    return { ok: true, data: clientes }
  },
}
