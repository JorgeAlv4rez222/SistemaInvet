// @ts-nocheck
import { supabase } from '../lib/supabase/client'
import type { ServiceResult } from '../../src/shared/types/base'

// ── Tipos ─────────────────────────────────────────────────────────────────

export type TipoMovimiento =
  | 'ingreso'
  | 'ingreso_parcial'
  | 'ubicacion_rack'
  | 'picking'
  | 'salida'
  | 'salida_parcial'
  | 'traslado_reubicacion'
  | 'traslado_intercambio'
  | 'equivalente_usado'
  | 'cambio_estado_nota'
  | 'revision_admin'
  | 'despacho'

export type MovimientoHistorial = {
  movimientoId:       string
  tipo:               TipoMovimiento
  fecha:              string
  usuario:            string
  producto:           string | null
  nombreProducto:     string | null
  cantidad:           number | null
  detalle:            string
  ubicacion:          string | null
  notaNumero:         string | null
  notaVentaId:        string | null
  importacionCodigo:  string | null
  cantidadSolicitada: number | null
  skuEquivalente:     string | null
  skuOriginal:        string | null
}

export type ObtenerMovimientosInput = {
  tipo?:     TipoMovimiento
  usuarioId?: string
  desde?:    string
  hasta?:    string
  limite?:   number
  offset?:   number
}

export type ObtenerMovimientosResult = {
  movimientos: MovimientoHistorial[]
  total:       number
}

export type MovimientosPorIngresoResult = {
  importacion:  string
  numeroOc:     string
  fechaIngreso: string
  movimientos:  MovimientoHistorial[]
}

export type MovimientosPorNotaResult = {
  nota:              string
  cliente:           string
  estado:            string
  movimientos:       MovimientoHistorial[]
  despacho:          { nombreChofer: string; fechaDespacho: string } | null
  comentariosPorSku: Record<string, string>
}

export type OCResumen = {
  importacionId:  string
  codigo:         string
  numeroOc:       string
  fechaIngreso:   string
  estado:         string
  totalProductos: number
}

export type ProductoEnOC = {
  detalleId:        string
  productoId:       string
  sku:              string
  nombre:           string
  cantidadEsperada: number
  cantidadRecibida: number
  estado:           string
}

export type MovimientosPorTrasladoResult = {
  trasladoId:      string
  tipo:            string
  realizadoPor:    string
  fechaTraslado:   string
  origen:          string
  destino:         string
  productoOrigen:  string
  productoDestino: string | null
}

// ── Transformador de detalle JSON a texto legible (ARQ-004) ───────────────

type DetalleJson = Record<string, unknown>

function textoLegible(tipo: TipoMovimiento, detalle: DetalleJson | null, usuario: string, cantidadRow?: number | null): string {
  const d    = detalle ?? {}
  const cant = (v: unknown) => v ?? cantidadRow ?? '?'

  switch (tipo) {
    case 'ingreso':
      return `${usuario} ingresó ${cant(d.cantidadIngresada)} unidades de ${d.sku} en ${d.ubicacion ?? 'bodega'}`

    case 'ingreso_parcial':
      return `${usuario} ingresó parcialmente ${cant(d.cantidadIngresada)}/${d.cantidadEsperada} unidades de ${d.sku} en ${d.ubicacion ?? 'bodega'}`

    case 'ubicacion_rack':
      return `${usuario} ubicó ${d.sku} (${cant(d.cantidadIngresada)} u.) en posición ${d.ubicacion}`

    case 'picking':
      return `${usuario} preparó ${d.cantidadDespachada} unidades de ${d.sku} para nota ${d.numeroNota}`

    case 'salida':
      return `${usuario} despachó ${d.cantidadDespachada} unidades de ${d.sku} para nota ${d.numeroNota}`

    case 'salida_parcial': {
      const razon = d.comentario ?? 'cantidad parcial'
      return `${usuario} despachó ${d.cantidadDespachada}/${d.cantidadSolicitada} unidades de ${d.sku} — ${razon}`
    }

    case 'traslado_reubicacion':
      return `${usuario} trasladó ${d.sku} de ${d.posicionOrigen} a ${d.posicionDestino}`

    case 'traslado_intercambio': {
      type Lado = { sku: string; posicion: string }
      const origen  = d.origen  as Lado | undefined
      const destino = d.destino as Lado | undefined
      return `${usuario} intercambió ${origen?.sku} (${origen?.posicion}) con ${destino?.sku} (${destino?.posicion})`
    }

    case 'equivalente_usado': {
      type ProdRef = { sku?: string }
      const orig  = d.productoOriginal    as ProdRef | undefined
      const equiv = d.productoEquivalente as ProdRef | undefined
      const skuO  = (d.skuOriginal    as string) ?? orig?.sku  ?? '?'
      const skuE  = (d.skuEquivalente as string) ?? equiv?.sku ?? '?'
      return `${usuario} usó equivalente ${skuE} en lugar de ${skuO} para nota ${d.numeroNota}`
    }

    case 'cambio_estado_nota':
      return `${usuario} cambió nota ${d.numeroNota} de ${d.estadoAnterior} a ${d.estadoNuevo}`

    case 'revision_admin':
      return `${usuario} revisó ${d.cantidadRevisada} unidades de ${d.sku} en nota`

    case 'despacho':
      return `${usuario} despachó nota ${d.numeroNota} al chofer ${d.nombreChofer}`

    default:
      return `${usuario} realizó acción: ${tipo}`
  }
}

// ── Helper: construir MovimientoHistorial desde fila raw ──────────────────

type RawMovimiento = {
  id:            string
  tipo:          string
  fecha:         string
  cantidad:      number | null
  detalle:       DetalleJson | null
  nota_venta_id: string | null
  usuarios:      { nombre: string } | null
  productos:     { sku: string; nombre: string } | null
  notas_venta:   { numero_nota: string } | null
  importaciones: { codigo: string } | null
}

function mapearMovimiento(row: RawMovimiento): MovimientoHistorial {
  const tipo    = row.tipo as TipoMovimiento
  const usuario = row.usuarios?.nombre ?? 'Sistema'
  const d       = row.detalle ?? {}

  return {
    movimientoId:       row.id,
    tipo,
    fecha:              row.fecha,
    usuario,
    producto:           row.productos?.sku ?? null,
    nombreProducto:     row.productos?.nombre ?? null,
    cantidad:           row.cantidad,
    detalle:            textoLegible(tipo, row.detalle, usuario, row.cantidad),
    ubicacion:          typeof d.ubicacion === 'object' && d.ubicacion != null
                          ? ((d.ubicacion as { rack?: string }).rack ?? null)
                          : (d.ubicacion as string) ?? null,
    notaNumero:         row.notas_venta?.numero_nota   ?? null,
    notaVentaId:        row.nota_venta_id,
    importacionCodigo:  row.importaciones?.codigo      ?? null,
    cantidadSolicitada: (d.cantidadSolicitada as number) ?? null,
    skuEquivalente:     (d.skuEquivalente as string)
                          ?? (d.productoEquivalente as { sku?: string } | undefined)?.sku
                          ?? null,
    skuOriginal:        (d.skuOriginal as string)
                          ?? (d.productoOriginal as { sku?: string } | undefined)?.sku
                          ?? null,
  }
}

const JOINS = `
  id, tipo, fecha, cantidad, detalle,
  nota_venta_id,
  usuarios(nombre),
  productos(sku, nombre),
  notas_venta(numero_nota),
  importaciones(codigo)
`

// ── Service ───────────────────────────────────────────────────────────────

export const historialService = {
  async obtenerMovimientos(input: ObtenerMovimientosInput): Promise<ServiceResult<ObtenerMovimientosResult>> {
    const limite = Math.min(input.limite ?? 50, 200)
    const offset = input.offset ?? 0

    let query = supabase
      .from('movimientos')
      .select(JOINS, { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(offset, offset + limite - 1)

    // TC-HIS-002: filtro por tipo
    if (input.tipo) query = query.eq('tipo', input.tipo)

    // Filtro por usuario
    if (input.usuarioId) query = query.eq('usuario_id', input.usuarioId)

    // TC-HIS-003: filtro por rango de fechas
    if (input.desde) query = query.gte('fecha', input.desde)
    if (input.hasta) query = query.lte('fecha', `${input.hasta}T23:59:59`)

    const { data, count, error } = await query

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    // TC-HIS-006: lista vacía es resultado válido
    return {
      ok: true,
      data: {
        movimientos: (data as RawMovimiento[] ?? []).map(mapearMovimiento),
        total:       count ?? 0,
      },
    }
  },

  async obtenerMovimientosPorIngreso(importacionId: string): Promise<ServiceResult<MovimientosPorIngresoResult>> {
    // TC-HIS-004: verificar que la importación existe
    const { data: importacion, error: errorImp } = await supabase
      .from('importaciones')
      .select('codigo, numero_oc, fecha_ingreso')
      .eq('id', importacionId)
      .single()

    if (errorImp || !importacion) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Importación no encontrada', field: 'importacionId' } }
    }

    const { data, error } = await supabase
      .from('movimientos')
      .select(JOINS)
      .eq('importacion_id', importacionId)
      .order('fecha', { ascending: true })

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    return {
      ok: true,
      data: {
        importacion:  importacion.codigo,
        numeroOc:     importacion.numero_oc,
        fechaIngreso: importacion.fecha_ingreso,
        movimientos:  (data as RawMovimiento[] ?? []).map(mapearMovimiento),
      },
    }
  },

  async obtenerMovimientosPorNota(notaId: string): Promise<ServiceResult<MovimientosPorNotaResult>> {
    const { data: nota, error: errorNota } = await supabase
      .from('notas_venta')
      .select('numero_nota, nombre_cliente, estado')
      .eq('id', notaId)
      .single()

    if (errorNota || !nota) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Nota no encontrada', field: 'notaId' } }
    }

    // TC-HIS-005: todos los tipos de evento de la nota en orden cronológico
    const { data, error } = await supabase
      .from('movimientos')
      .select(JOINS)
      .eq('nota_venta_id', notaId)
      .order('fecha', { ascending: true })

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    // Obtener despacho si existe
    const { data: despacho } = await supabase
      .from('despachos')
      .select('nombre_chofer, fecha_despacho')
      .eq('nota_venta_id', notaId)
      .single()

    // Comentarios por SKU (sin stock o despacho parcial)
    const { data: nps } = await supabase
      .from('nota_productos')
      .select('producto_id, comentario_operador')
      .eq('nota_venta_id', notaId)
      .not('comentario_operador', 'is', null)

    const comentariosPorSku: Record<string, string> = {}
    if (nps && nps.length > 0) {
      const productoIds = nps.map((np) => np.producto_id)
      const { data: prods } = await supabase
        .from('productos')
        .select('id, sku')
        .in('id', productoIds)

      const skuById = new Map((prods ?? []).map((p) => [p.id, p.sku]))
      for (const np of nps) {
        const sku = skuById.get(np.producto_id)
        if (sku && np.comentario_operador) comentariosPorSku[sku] = np.comentario_operador
      }
    }

    return {
      ok: true,
      data: {
        nota:              nota.numero_nota,
        cliente:           nota.nombre_cliente,
        estado:            nota.estado,
        movimientos:       (data as RawMovimiento[] ?? []).map(mapearMovimiento),
        despacho:          despacho
          ? { nombreChofer: despacho.nombre_chofer, fechaDespacho: despacho.fecha_despacho }
          : null,
        comentariosPorSku,
      },
    }
  },

  async listarOCs(): Promise<ServiceResult<OCResumen[]>> {
    const { data, error } = await supabase
      .from('importaciones')
      .select('id, codigo, numero_oc, fecha_ingreso, estado, importacion_detalles(id)')
      .order('fecha_ingreso', { ascending: false })
      .limit(200)

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocs = (data ?? []).map((row: any) => ({
      importacionId:  row.id,
      codigo:         row.codigo,
      numeroOc:       row.numero_oc,
      fechaIngreso:   row.fecha_ingreso,
      estado:         row.estado,
      totalProductos: Array.isArray(row.importacion_detalles) ? row.importacion_detalles.length : 0,
    }))

    return { ok: true, data: ocs }
  },

  async obtenerProductosPorOC(importacionId: string): Promise<ServiceResult<ProductoEnOC[]>> {
    const { data, error } = await supabase
      .from('importacion_detalles')
      .select('id, cantidad_esperada, cantidad_recibida, estado, productos(id, sku, nombre)')
      .eq('importacion_id', importacionId)
      .order('id')

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productos = (data ?? []).map((row: any) => ({
      detalleId:        row.id,
      productoId:       row.productos?.id   ?? '',
      sku:              row.productos?.sku   ?? '',
      nombre:           row.productos?.nombre ?? '',
      cantidadEsperada: row.cantidad_esperada,
      cantidadRecibida: row.cantidad_recibida,
      estado:           row.estado,
    }))

    return { ok: true, data: productos }
  },

  async obtenerMovimientosPorOCYProducto(
    importacionId: string,
    productoId:    string,
  ): Promise<ServiceResult<MovimientoHistorial[]>> {
    const { data, error } = await supabase
      .from('movimientos')
      .select(JOINS)
      .eq('importacion_id', importacionId)
      .eq('producto_id', productoId)
      .order('fecha', { ascending: true })

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    return { ok: true, data: (data as RawMovimiento[] ?? []).map(mapearMovimiento) }
  },

  async obtenerMovimientosPorTraslado(trasladoId: string): Promise<ServiceResult<MovimientosPorTrasladoResult>> {
    const { data: traslado, error } = await supabase
      .from('traslados')
      .select(`
        id, tipo, fecha_traslado,
        usuarios!traslados_realizado_por_fkey(nombre),
        posicion_origen:posiciones_rack!traslados_posicion_origen_id_fkey(codigo),
        posicion_destino:posiciones_rack!traslados_posicion_destino_id_fkey(codigo),
        producto_origen:productos!traslados_producto_origen_id_fkey(sku),
        producto_destino:productos!traslados_producto_destino_id_fkey(sku)
      `)
      .eq('id', trasladoId)
      .single()

    if (error || !traslado) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Traslado no encontrado', field: 'trasladoId' } }
    }

    type Ref<T> = T | null
    type UsuarioRef   = { nombre: string }
    type PosicionRef  = { codigo: string }
    type ProductoRef  = { sku: string }

    return {
      ok: true,
      data: {
        trasladoId:      traslado.id,
        tipo:            traslado.tipo,
        realizadoPor:    (traslado.usuarios as Ref<UsuarioRef>)?.nombre ?? '',
        fechaTraslado:   traslado.fecha_traslado,
        origen:          (traslado.posicion_origen as Ref<PosicionRef>)?.codigo ?? '',
        destino:         (traslado.posicion_destino as Ref<PosicionRef>)?.codigo ?? '',
        productoOrigen:  (traslado.producto_origen as Ref<ProductoRef>)?.sku ?? '',
        productoDestino: (traslado.producto_destino as Ref<ProductoRef>)?.sku ?? null,
      },
    }
  },
}
