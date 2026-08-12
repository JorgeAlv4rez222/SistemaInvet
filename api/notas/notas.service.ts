import { supabase } from '../lib/supabase/client'
import type { ServiceResult } from '../../src/shared/types/base'
import type { Database } from '../lib/supabase/types'

type NotaVenta    = Database['public']['Tables']['notas_venta']['Row']
type NotaProducto = Database['public']['Tables']['nota_productos']['Row']

// ── Tipos públicos ─────────────────────────────────────────────────────────

export type Ubicacion = {
  loteId:         string
  posicionCodigo: string
  cantidad:       number
  fechaIngreso:   string
}

export type ProductoConStock = {
  productoId:      string
  sku:             string
  nombre:          string
  codigoBarra:     string
  stockDisponible: number
  ubicaciones:     Ubicacion[]
}

export type NotaProductoResumen = {
  notaProductoId:        string
  productoId:            string
  sku:                   string
  nombre:                string
  codigoBarra:           string
  cantidadSolicitada:    number
  cantidadDespachada:    number
  estado:                string
  ubicaciones:           Ubicacion[]
  productoEquivalenteId: string | null
  skuEquivalente:        string | null
  comentarioOperador:    string | null
  revisadoAdmin:         boolean
  equivalentes:          ProductoConStock[]
}

export type CrearNotaInput = {
  adminId:        string
  numeroNota:     string
  nombreCliente:  string
  rutCliente:     string
  numeroOc?:      string
  archivoNombre?: string
  productos: { productoId: string; cantidadSolicitada: number }[]
}

export type CrearNotaResult = {
  notaId:     string
  numeroNota: string
  estado:     'pendiente'
  productos:  NotaProductoResumen[]
}

export type NotaResumen = {
  notaId:             string
  numeroNota:         string
  nombreCliente:      string
  estado:             string
  totalProductos:     number
  productosCompletos: number
  creadoEn:           string
  importadoPor:       string
}

export type DetalleNota = {
  notaId:        string
  numeroNota:    string
  nombreCliente: string
  rutCliente:    string
  numeroOc:      string | null
  estado:        string
  productos:     NotaProductoResumen[]
}

export type RegistrarPickingInput = {
  usuarioId:              string
  notaProductoId:         string
  codigoProducto:         string
  cantidad:               number
  usarEquivalente?:       boolean
  productoEquivalenteId?: string
  comentarioOperador?:    string | null
  loteId?:                string   // multi-lote: lote específico a descontar
  esParadaMultiLote?:     boolean  // multi-lote: parada intermedia, no pedir motivo
}

export type RegistrarPickingResult = {
  valido:             boolean
  mensaje:            string
  cantidadDespachada: number
  stockRestante:      number
  notaCompleta:       boolean
}

export type RegistrarSinStockInput = {
  usuarioId:          string
  notaProductoId:     string
  comentarioOperador: string
}

export type ConcluirParcialInput = {
  usuarioId:          string
  notaProductoId:     string
  comentarioOperador?: string
}

export type ConcluirParcialResult = {
  notaProductoId: string
  notaCompleta:   boolean
}

export type CambiarEstadoInput = {
  adminId:      string
  notaId:       string
  nuevoEstado:  'lista_despacho'
  nombreChofer: string
}

export type CambiarEstadoResult = {
  notaId:        string
  estado:        'lista_despacho'
  despachoId:    string
  nombreChofer:  string
  fechaDespacho: string
}

//Constantes (prefijos que sirve para equivalente en caso de S.STOCK)

const PREFIJOS_EQUIVALENTES = ['HX', 'EK', 'BOL', 'BO'] as const

//Helpers

async function verificarAdmin(adminId: string): Promise<boolean> {
  const { data } = await supabase.from('usuarios').select('rol').eq('id', adminId).single()
  return data?.rol === 'admin'
}

async function obtenerUbicacionesFifo(productoId: string): Promise<Ubicacion[]> {
  const { data } = await supabase
    .from('lotes_inventario')
    .select('id, cantidad, fecha_ingreso, created_at, posiciones_rack(codigo)')
    .eq('producto_id', productoId)
    .eq('activo', true)
    .gt('cantidad', 0)
    .order('fecha_ingreso', { ascending: true })
    .order('created_at', { ascending: true }) // TC-FIFO-005: desempate por created_at

  type LoteRaw = { id: string; cantidad: number; fecha_ingreso: string; created_at: string; posiciones_rack: { codigo: string } | null }

  return (data as LoteRaw[] ?? [])
    .filter((l) => l.posiciones_rack)
    .map((l) => ({
      loteId:         l.id,
      posicionCodigo: l.posiciones_rack!.codigo,
      cantidad:       l.cantidad,
      fechaIngreso:   l.fecha_ingreso,
    }))
}

async function obtenerEquivalentesConStock(sku: string): Promise<ProductoConStock[]> {
  const prefijo = PREFIJOS_EQUIVALENTES.find((p) => sku.startsWith(p))
  if (!prefijo) return []
  const sufijo = sku.slice(prefijo.length)

  const skusEquivalentes = PREFIJOS_EQUIVALENTES
    .filter((p) => p !== prefijo)
    .map((p) => `${p}${sufijo}`)

  const { data: productos } = await supabase
    .from('productos')
    .select('id, sku, nombre, codigo_barra, stock_total')
    .in('sku', skusEquivalentes)
    .eq('activo', true)
    .gt('stock_total', 0)

  if (!productos?.length) return []

  const result: ProductoConStock[] = []
  for (const p of productos) {
    const ubicaciones = await obtenerUbicacionesFifo(p.id)
    result.push({ productoId: p.id, sku: p.sku, nombre: p.nombre, codigoBarra: p.codigo_barra, stockDisponible: p.stock_total, ubicaciones })
  }
  return result
}

async function enriquecerNotaProducto(
  np: NotaProducto & { productos: { sku: string; nombre: string; codigo_barra: string } | null;
                       productos_equivalente?: { sku: string; codigo_barra: string } | null }
): Promise<NotaProductoResumen> {
  const sku        = np.productos?.sku ?? ''
  const ubicaciones = await obtenerUbicacionesFifo(np.producto_id)
  const equivalentes = await obtenerEquivalentesConStock(sku)

  // Si se pickeó un equivalente, usar su código de barra para la revisión
  const codigoBarra = np.producto_equivalente_id
    ? (np.productos_equivalente?.codigo_barra ?? '')
    : (np.productos?.codigo_barra ?? '')

  return {
    notaProductoId:        np.id,
    productoId:            np.producto_id,
    sku,
    nombre:                np.productos?.nombre ?? '',
    codigoBarra,
    cantidadSolicitada:    np.cantidad_solicitada,
    cantidadDespachada:    np.cantidad_despachada,
    estado:                np.estado,
    ubicaciones,
    productoEquivalenteId: np.producto_equivalente_id,
    skuEquivalente:        np.productos_equivalente?.sku ?? null,
    comentarioOperador:    np.comentario_operador,
    revisadoAdmin:         np.revisado_admin,
    equivalentes,
  }
}

async function evaluarEstadoNota(notaId: string, usuarioId: string | null, notaData: { numero_nota: string; nombre_cliente: string }): Promise<boolean> {
  const { data: items } = await supabase
    .from('nota_productos')
    .select('estado, comentario_operador')
    .eq('nota_venta_id', notaId)

  if (!items?.length) return false

  // Un ítem parcial cuenta como terminado cuando el operador ya lo cerró
  // con una justificación (comentario_operador) — a su criterio, sin más picking pendiente.
  const terminados = items.every((i) =>
    i.estado === 'completo' || i.estado === 'sin_stock' || (i.estado === 'parcial' && !!i.comentario_operador)
  )
  if (!terminados) return false

  await supabase.from('notas_venta').update({ estado: 'completa' }).eq('id', notaId)

  // TC-NTA-006: EVT-008 cambio de estado automático — solo si hay un usuario a quien
  // atribuir el movimiento (p.ej. no cuando se autocorrige al simplemente leer la nota).
  if (usuarioId) {
    await supabase.from('movimientos').insert({
      tipo:          'cambio_estado_nota',
      nota_venta_id: notaId,
      usuario_id:    usuarioId,
      detalle: {
        numeroNota:    notaData.numero_nota,
        nombreCliente: notaData.nombre_cliente,
        estadoAnterior: 'pendiente',
        estadoNuevo:   'completa',
        completadoPor:  usuarioId,
        rol:            'operador',
      },
    })
  }

  return true
}

// ── Service ────────────────────────────────────────────────────────────────

export const notasService = {

  async obtenerNotas(estado?: string): Promise<ServiceResult<NotaResumen[]>> {
    let query = supabase
      .from('notas_venta')
      .select('*, nota_productos(id, estado), usuarios!notas_venta_importado_por_fkey(nombre)')
      .order('created_at', { ascending: false })

    if (estado) query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    type RawNota = NotaVenta & {
      nota_productos: { id: string; estado: string }[]
      usuarios: { nombre: string } | null
    }

    const result: NotaResumen[] = (data as RawNota[] ?? []).map((n) => ({
      notaId:             n.id,
      numeroNota:         n.numero_nota,
      nombreCliente:      n.nombre_cliente,
      estado:             n.estado,
      totalProductos:     n.nota_productos.length,
      productosCompletos: n.nota_productos.filter((p) => ['completo', 'sin_stock'].includes(p.estado)).length,
      creadoEn:           n.created_at,
      importadoPor:       n.usuarios?.nombre ?? '',
    }))

    return { ok: true, data: result }
  },

  async obtenerDetalleNota(notaId: string, usuarioId?: string): Promise<ServiceResult<DetalleNota>> {
    const { data, error } = await supabase
      .from('notas_venta')
      .select(`
        *,
        nota_productos(
          *,
          productos!nota_productos_producto_id_fkey(sku, nombre, codigo_barra),
          productos_equivalente:productos!nota_productos_producto_equivalente_id_fkey(sku, codigo_barra)
        )
      `)
      .eq('id', notaId)
      .single()

    if (error || !data) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Nota no encontrada', field: 'notaId' } }
    }

    // Autocorrección: si quedó "pendiente" pero todos sus ítems ya están
    // terminados (p.ej. se cerró un parcial y nadie volvió a pickear después),
    // recalcular el estado al leer la nota en vez de esperar a la próxima escritura.
    let estadoNota = data.estado
    if (estadoNota === 'pendiente') {
      const quedoCompleta = await evaluarEstadoNota(notaId, usuarioId ?? null, { numero_nota: data.numero_nota, nombre_cliente: data.nombre_cliente })
      if (quedoCompleta) estadoNota = 'completa'
    }

    type NPRaw = NotaProducto & {
      productos: { sku: string; nombre: string; codigo_barra: string } | null
      productos_equivalente: { sku: string; codigo_barra: string } | null
    }

    const productosEnriquecidos = await Promise.all(
      (data.nota_productos as NPRaw[]).map((np) => enriquecerNotaProducto(np))
    )

    return {
      ok: true,
      data: {
        notaId:        data.id,
        numeroNota:    data.numero_nota,
        nombreCliente: data.nombre_cliente,
        rutCliente:    data.rut_cliente,
        numeroOc:      data.numero_oc,
        estado:        estadoNota,
        productos:     productosEnriquecidos,
      },
    }
  },

  async crearNota(input: CrearNotaInput): Promise<ServiceResult<CrearNotaResult>> {
    if (!(await verificarAdmin(input.adminId))) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Solo el Admin puede crear notas de venta' } }
    }

    if (!input.productos.length) {
      return { ok: false, error: { code: 'VALIDATION_PRODUCTOS_VACIOS', message: 'Debe incluir al menos un producto' } }
    }

    // TC-NTA-001: verificar nota duplicada
    const { data: existe } = await supabase
      .from('notas_venta')
      .select('id')
      .eq('numero_nota', input.numeroNota)
      .single()

    if (existe) {
      return { ok: false, error: { code: 'CONFLICT_NOTA_DUPLICADA', message: `Ya existe una nota con número ${input.numeroNota}` } }
    }

    const { data: nota, error: errorNota } = await supabase
      .from('notas_venta')
      .insert({
        numero_nota:    input.numeroNota,
        nombre_cliente: input.nombreCliente,
        rut_cliente:    input.rutCliente,
        numero_oc:      input.numeroOc ?? null,
        importado_por:  input.adminId,
        estado:         'pendiente',
        archivo_nombre: input.archivoNombre ?? null,
      })
      .select()
      .single()

    if (errorNota || !nota) {
      return { ok: false, error: { code: 'DB_ERROR', message: errorNota?.message ?? 'Error al crear nota' } }
    }

    const npInsert = input.productos.map((p) => ({
      nota_venta_id:      nota.id,
      producto_id:        p.productoId,
      cantidad_solicitada: p.cantidadSolicitada,
      cantidad_despachada: 0,
      estado:             'pendiente',
    }))

    const { data: npCreados, error: errorNP } = await supabase
      .from('nota_productos')
      .insert(npInsert)
      .select('*, productos!nota_productos_producto_id_fkey(sku, nombre, codigo_barra)')

    if (errorNP || !npCreados) {
      return { ok: false, error: { code: 'DB_ERROR', message: errorNP?.message ?? 'Error al crear ítems' } }
    }

    type NPRaw = NotaProducto & { productos: { sku: string; nombre: string; codigo_barra: string } | null; productos_equivalente: null }

    const productosEnriquecidos = await Promise.all(
      (npCreados as NPRaw[]).map((np) => enriquecerNotaProducto({ ...np, productos_equivalente: null }))
    )

    return {
      ok: true,
      data: { notaId: nota.id, numeroNota: nota.numero_nota, estado: 'pendiente', productos: productosEnriquecidos },
    }
  },

  async registrarPicking(input: RegistrarPickingInput): Promise<ServiceResult<RegistrarPickingResult>> {
    // Obtener nota_producto con datos completos
    const { data: np, error: errorNP } = await supabase
      .from('nota_productos')
      .select(`
        *,
        notas_venta(id, estado, numero_nota, nombre_cliente, rut_cliente),
        productos!nota_productos_producto_id_fkey(id, sku, nombre, codigo_barra)
      `)
      .eq('id', input.notaProductoId)
      .single()

    if (errorNP || !np) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Ítem no encontrado', field: 'notaProductoId' } }
    }

    type NotaRef    = { id: string; estado: string; numero_nota: string; nombre_cliente: string; rut_cliente: string }
    type ProductoRef = { id: string; sku: string; nombre: string; codigo_barra: string }

    const notaRef    = np.notas_venta as NotaRef
    const productoRef = np.productos as ProductoRef

    if (notaRef.estado !== 'pendiente') {
      return { ok: false, error: { code: 'CONFLICT_NOTA_NO_PENDIENTE', message: `La nota está en estado '${notaRef.estado}'` } }
    }

    // Determinar qué producto usar (original o equivalente)
    const usarEquivalente   = input.usarEquivalente === true && !!input.productoEquivalenteId
    const productoPickId    = usarEquivalente ? input.productoEquivalenteId! : productoRef.id

    // Obtener producto a picar (puede ser el equivalente)
    let productoPickRef = productoRef
    if (usarEquivalente) {
      const { data: prodEq } = await supabase
        .from('productos')
        .select('id, sku, nombre, codigo_barra')
        .eq('id', input.productoEquivalenteId!)
        .single()
      if (!prodEq) return { ok: false, error: { code: 'NOT_FOUND', message: 'Producto equivalente no encontrado' } }
      productoPickRef = prodEq
    }

    // Validar producto escaneado
    if (productoPickRef.codigo_barra !== input.codigoProducto) {
      return {
        ok: false,
        error: { code: 'INVALID_PRODUCTO', message: `El producto escaneado no coincide. Esperado: ${productoPickRef.sku}`, field: 'codigoProducto' },
      }
    }

    // Obtener lotes FIFO del producto a picar
    const { data: lotes, error: errorLotes } = await supabase
      .from('lotes_inventario')
      .select('*, posiciones_rack(id, codigo)')
      .eq('producto_id', productoPickId)
      .eq('activo', true)
      .gt('cantidad', 0)
      .order('fecha_ingreso', { ascending: true })
      .order('created_at', { ascending: true }) // TC-FIFO-005

    if (errorLotes) return { ok: false, error: { code: 'DB_ERROR', message: errorLotes.message } }

    if (!lotes?.length) {
      return { ok: false, error: { code: 'INSUFFICIENT_STOCK', message: 'No hay stock disponible para este producto' } }
    }

    type LoteRaw = typeof lotes[number] & { posiciones_rack: { id: string; codigo: string } | null }
    const lotesFifo = lotes as LoteRaw[]

    // Multi-lote: usar el lote indicado por el frontend; si no se indica, usar el primero FIFO
    const loteEsperado = input.loteId
      ? (lotesFifo.find(l => l.id === input.loteId) ?? lotesFifo[0])
      : lotesFifo[0]

    if (!loteEsperado.posiciones_rack) {
      return { ok: false, error: { code: 'INVALID_RACK', message: 'El lote no tiene posición asignada' } }
    }

    // Bloquear despacho superior a lo solicitado en la nota
    const cantidadPendiente = np.cantidad_solicitada - np.cantidad_despachada
    if (input.cantidad > cantidadPendiente) {
      return {
        ok: false,
        error: {
          code: 'EXCEDE_SOLICITADO',
          message: `No puedes despachar más de lo solicitado — pendiente: ${cantidadPendiente}`,
        },
      }
    }

    // Si es envío parcial, comentario es obligatorio (excepto en paradas intermedias multi-lote)
    if (input.cantidad < cantidadPendiente && !input.esParadaMultiLote && !input.comentarioOperador?.trim()) {
      return {
        ok: false,
        error: {
          code: 'COMENTARIO_REQUERIDO',
          message: 'Debes indicar el motivo del despacho parcial',
        },
      }
    }

    // Validar stock suficiente en el lote (TC-NTA-005: check antes del update)
    if (loteEsperado.cantidad < input.cantidad) {
      return {
        ok: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Stock insuficiente en lote — disponible: ${loteEsperado.cantidad}, solicitado: ${input.cantidad}`,
        },
      }
    }

    // Descontar stock del lote
    const cantidadRestanteLote = loteEsperado.cantidad - input.cantidad
    const { error: errorLoteUp } = await supabase
      .from('lotes_inventario')
      .update({ cantidad: cantidadRestanteLote, activo: cantidadRestanteLote > 0 })
      .eq('id', loteEsperado.id)

    if (errorLoteUp) return { ok: false, error: { code: 'DB_ERROR', message: errorLoteUp.message } }

    // TC-FIFO-003: si el lote se agotó, liberar posición
    if (cantidadRestanteLote === 0 && loteEsperado.posiciones_rack) {
      await supabase
        .from('posiciones_rack')
        .update({ ocupada: false })
        .eq('id', loteEsperado.posiciones_rack.id)
    }

    // stock_total se recalcula automáticamente vía trigger trg_recalcular_stock al actualizar el lote

    // Actualizar nota_producto
    const nuevaDespachada = np.cantidad_despachada + input.cantidad
    const estadoItem      = nuevaDespachada >= np.cantidad_solicitada ? 'completo' : 'parcial'

    const { error: errorNPUp } = await supabase
      .from('nota_productos')
      .update({
        cantidad_despachada:     nuevaDespachada,
        estado:                  estadoItem,
        producto_equivalente_id: usarEquivalente ? input.productoEquivalenteId : null,
        ...(input.comentarioOperador ? { comentario_operador: input.comentarioOperador } : {}),
      })
      .eq('id', input.notaProductoId)

    if (errorNPUp) return { ok: false, error: { code: 'DB_ERROR', message: errorNPUp.message } }

    const ubicacion = { rack: loteEsperado.posiciones_rack.codigo, fechaIngresoLote: loteEsperado.fecha_ingreso }

    // TC-NTA-009: EVT-007 equivalente_usado (antes de EVT-003)
    if (usarEquivalente) {
      await supabase.from('movimientos').insert({
        tipo:          'equivalente_usado',
        nota_venta_id: notaRef.id,
        producto_id:   productoRef.id,
        cantidad:      input.cantidad,
        usuario_id:    input.usuarioId,
        detalle: {
          numeroNota:    notaRef.numero_nota,
          nombreCliente: notaRef.nombre_cliente,
          productoOriginal: { sku: productoRef.sku, nombre: productoRef.nombre, stockDisponible: 0 },
          productoEquivalente: { sku: productoPickRef.sku, nombre: productoPickRef.nombre, cantidad: input.cantidad, ubicacion },
        },
      })
    }

    // EVT-003/004: salida o salida_parcial
    const esSalidaCompleta = nuevaDespachada >= np.cantidad_solicitada
    await supabase.from('movimientos').insert({
      tipo:          esSalidaCompleta ? 'salida' : 'salida_parcial',
      nota_venta_id: notaRef.id,
      lote_id:       loteEsperado.id,
      producto_id:   productoPickId,
      cantidad:      input.cantidad,
      usuario_id:    input.usuarioId,
      detalle: esSalidaCompleta
        ? { numeroNota: notaRef.numero_nota, nombreCliente: notaRef.nombre_cliente, sku: productoPickRef.sku, nombreProducto: productoPickRef.nombre, cantidadSolicitada: np.cantidad_solicitada, cantidadDespachada: nuevaDespachada, ubicacion }
        : { numeroNota: notaRef.numero_nota, nombreCliente: notaRef.nombre_cliente, sku: productoPickRef.sku, nombreProducto: productoPickRef.nombre, cantidadSolicitada: np.cantidad_solicitada, cantidadDespachada: nuevaDespachada, cantidadFaltante: np.cantidad_solicitada - nuevaDespachada, razon: input.esParadaMultiLote ? 'multi_lote' : 'parcial_operador', comentarioOperador: input.comentarioOperador ?? null, ubicacion },
    })

    // TC-NTA-006: evaluar si la nota quedó completa
    const notaCompleta = await evaluarEstadoNota(notaRef.id, input.usuarioId, { numero_nota: notaRef.numero_nota, nombre_cliente: notaRef.nombre_cliente })

    // Calcular stock restante del producto
    const { data: prodActual } = await supabase
      .from('productos')
      .select('stock_total')
      .eq('id', productoPickId)
      .single()

    return {
      ok: true,
      data: {
        valido:             true,
        mensaje:            esSalidaCompleta ? 'Producto despachado correctamente' : `Parcial — quedan ${np.cantidad_solicitada - nuevaDespachada} por despachar`,
        cantidadDespachada: nuevaDespachada,
        stockRestante:      prodActual?.stock_total ?? 0,
        notaCompleta,
      },
    }
  },

  async registrarSinStock(input: RegistrarSinStockInput): Promise<ServiceResult<{ notaProductoId: string; estado: string; comentario: string }>> {
    // TC-NTA-008: comentario obligatorio
    if (!input.comentarioOperador.trim()) {
      return { ok: false, error: { code: 'VALIDATION_COMENTARIO_VACIO', message: 'El comentario es obligatorio al registrar sin stock' } }
    }

    const { data: np, error } = await supabase
      .from('nota_productos')
      .select('*, notas_venta(id, estado, numero_nota, nombre_cliente), productos!nota_productos_producto_id_fkey(sku, nombre)')
      .eq('id', input.notaProductoId)
      .single()

    if (error || !np) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Ítem no encontrado', field: 'notaProductoId' } }
    }

    type NotaRef    = { id: string; estado: string; numero_nota: string; nombre_cliente: string }
    type ProductoRef = { sku: string; nombre: string }

    const notaRef    = np.notas_venta as NotaRef
    const productoRef = np.productos as ProductoRef

    await supabase
      .from('nota_productos')
      .update({ estado: 'sin_stock', comentario_operador: input.comentarioOperador })
      .eq('id', input.notaProductoId)

    // EVT-004: salida_parcial con razón sin_stock_sin_equivalente
    await supabase.from('movimientos').insert({
      tipo:          'salida_parcial',
      nota_venta_id: notaRef.id,
      producto_id:   np.producto_id,
      usuario_id:    input.usuarioId,
      detalle: {
        numeroNota:         notaRef.numero_nota,
        nombreCliente:      notaRef.nombre_cliente,
        sku:                productoRef.sku,
        nombreProducto:     productoRef.nombre,
        cantidadSolicitada: np.cantidad_solicitada,
        cantidadDespachada: np.cantidad_despachada,
        cantidadFaltante:   np.cantidad_solicitada - np.cantidad_despachada,
        razon:              'sin_stock_sin_equivalente',
        comentarioOperador: input.comentarioOperador,
      },
    })

    await evaluarEstadoNota(notaRef.id, input.usuarioId, { numero_nota: notaRef.numero_nota, nombre_cliente: notaRef.nombre_cliente })

    return { ok: true, data: { notaProductoId: input.notaProductoId, estado: 'sin_stock', comentario: input.comentarioOperador } }
  },

  // Cierre manual de un ítem parcial, a criterio del operador — no depende de que
  // ya exista un comentario previo; el propio operador decide que no seguirá pickeando.
  async concluirParcial(input: ConcluirParcialInput): Promise<ServiceResult<ConcluirParcialResult>> {
    const { data: np, error } = await supabase
      .from('nota_productos')
      .select('*, notas_venta(id, numero_nota, nombre_cliente), productos!nota_productos_producto_id_fkey(sku, nombre)')
      .eq('id', input.notaProductoId)
      .single()

    if (error || !np) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Ítem no encontrado', field: 'notaProductoId' } }
    }

    if (np.estado !== 'parcial') {
      return { ok: false, error: { code: 'ESTADO_INVALIDO', message: 'Solo se puede concluir un ítem que esté en estado parcial' } }
    }

    const comentarioFinal = input.comentarioOperador?.trim() || np.comentario_operador
    if (!comentarioFinal) {
      return { ok: false, error: { code: 'COMENTARIO_REQUERIDO', message: 'Debes indicar el motivo para dar por concluido este ítem' } }
    }

    type NotaRef     = { id: string; numero_nota: string; nombre_cliente: string }
    type ProductoRef = { sku: string; nombre: string }

    const notaRef     = np.notas_venta as NotaRef
    const productoRef = np.productos as ProductoRef

    await supabase
      .from('nota_productos')
      .update({ comentario_operador: comentarioFinal })
      .eq('id', input.notaProductoId)

    await supabase.from('movimientos').insert({
      tipo:          'salida_parcial',
      nota_venta_id: notaRef.id,
      producto_id:   np.producto_id,
      usuario_id:    input.usuarioId,
      detalle: {
        numeroNota:         notaRef.numero_nota,
        nombreCliente:      notaRef.nombre_cliente,
        sku:                productoRef.sku,
        nombreProducto:     productoRef.nombre,
        cantidadSolicitada: np.cantidad_solicitada,
        cantidadDespachada: np.cantidad_despachada,
        cantidadFaltante:   np.cantidad_solicitada - np.cantidad_despachada,
        razon:              'cierre_operador',
        comentarioOperador: comentarioFinal,
      },
    })

    const notaCompleta = await evaluarEstadoNota(notaRef.id, input.usuarioId, { numero_nota: notaRef.numero_nota, nombre_cliente: notaRef.nombre_cliente })

    return { ok: true, data: { notaProductoId: input.notaProductoId, notaCompleta } }
  },

  async cambiarEstadoNota(input: CambiarEstadoInput): Promise<ServiceResult<CambiarEstadoResult>> {
    // TC-NTA-010: solo Admin
    if (!(await verificarAdmin(input.adminId))) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Solo el Admin puede marcar notas para despacho' } }
    }

    if (!input.nombreChofer.trim()) {
      return { ok: false, error: { code: 'VALIDATION_CHOFER_VACIO', message: 'El nombre del chofer es obligatorio' } }
    }

    const { data: nota, error } = await supabase
      .from('notas_venta')
      .select('*, nota_productos(estado, comentario_operador)')
      .eq('id', input.notaId)
      .single()

    if (error || !nota) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Nota no encontrada', field: 'notaId' } }
    }

    // TC-NTA-011: solo desde 'completa'
    if (nota.estado !== 'completa') {
      return {
        ok: false,
        error: { code: 'CONFLICT_ESTADO_INVALIDO', message: `Solo se puede pasar a 'lista_despacho' desde estado 'completa'. Estado actual: '${nota.estado}'` },
      }
    }

    // Crear registro en despachos
    const fechaDespacho = new Date().toISOString()
    const { data: despacho, error: errorDespacho } = await supabase
      .from('despachos')
      .insert({ nota_venta_id: input.notaId, nombre_chofer: input.nombreChofer, validado_por: input.adminId, fecha_despacho: fechaDespacho })
      .select()
      .single()

    if (errorDespacho || !despacho) {
      return { ok: false, error: { code: 'DB_ERROR', message: errorDespacho?.message ?? 'Error al crear despacho' } }
    }

    await supabase.from('notas_venta').update({ estado: 'lista_despacho' }).eq('id', input.notaId)

    type NPEstado = { estado: string; comentario_operador: string | null }
    const nps = nota.nota_productos as NPEstado[]

    // EVT-008 cambio de estado
    await supabase.from('movimientos').insert({
      tipo:          'cambio_estado_nota',
      nota_venta_id: input.notaId,
      usuario_id:    input.adminId,
      detalle: {
        numeroNota:    nota.numero_nota,
        nombreCliente: nota.nombre_cliente,
        estadoAnterior: 'completa',
        estadoNuevo:   'lista_despacho',
        validadoPor:   input.adminId,
        rol:           'admin',
      },
    })

    // EVT-009 despacho
    await supabase.from('movimientos').insert({
      tipo:          'despacho',
      nota_venta_id: input.notaId,
      usuario_id:    input.adminId,
      detalle: {
        numeroNota:              nota.numero_nota,
        nombreCliente:           nota.nombre_cliente,
        rutCliente:              nota.rut_cliente,
        nombreChofer:            input.nombreChofer,
        fechaDespacho,
        totalProductos:          nps.length,
        productosDespachados:    nps.filter((p) => p.estado === 'completo').length,
        productosConObservacion: nps.filter((p) => p.comentario_operador).length,
      },
    })

    return {
      ok: true,
      data: { notaId: input.notaId, estado: 'lista_despacho', despachoId: despacho.id, nombreChofer: input.nombreChofer, fechaDespacho },
    }
  },
}
