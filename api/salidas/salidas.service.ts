// @ts-nocheck
import { supabase } from '../lib/supabase/client'
import type { ServiceResult } from '../../src/shared/types/base'
import type { Database } from '../lib/supabase/types'

type NotaVenta = Database['public']['Tables']['notas_venta']['Row']

export type NotaResumen = NotaVenta & {
  totalProductos:  number
  totalRevisados:  number
}

export type ValidarProductoInput = {
  adminId:           string
  notaProductoId:    string
  codigoProducto:    string
  cantidadIngresada: number
  comentario?:       string
}

export type ValidarProductoResult = {
  valido:            boolean
  cantidadEsperada:  number
  cantidadIngresada: number
  coincide:          boolean
  mensaje:           'Producto revisado' | 'Verifique cantidad'
  todosRevisados:    boolean
}

export const salidasService = {
  async obtenerNotasParaRevision(): Promise<ServiceResult<NotaResumen[]>> {
    const { data, error } = await supabase
      .from('notas_venta')
      .select('*, nota_productos(id, revisado_admin)')
      .in('estado', ['completa', 'despachada'])
      .order('updated_at', { ascending: false })

    if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

    type RawNota = NotaVenta & { nota_productos: { id: string; revisado_admin: boolean }[] }
    const notas = data as RawNota[] ?? []

    // Obtener choferes de las notas despachadas
    const notasIds = notas.map((n) => n.id)
    const { data: despachos } = notasIds.length
      ? await supabase.from('despachos').select('nota_venta_id, chofer').in('nota_venta_id', notasIds)
      : { data: [] }

    const choferPorNota = new Map<string, string>()
    for (const d of despachos ?? []) {
      choferPorNota.set(d.nota_venta_id, d.chofer)
    }

    const result: NotaResumen[] = notas.map((nota) => ({
      ...nota,
      totalProductos: nota.nota_productos.length,
      totalRevisados: nota.nota_productos.filter((np) => np.revisado_admin).length,
      nombreChofer:   choferPorNota.get(nota.id) ?? null,
    }))

    return { ok: true, data: result }
  },

  async validarProductoRevision(input: ValidarProductoInput): Promise<ServiceResult<ValidarProductoResult>> {
    // TC-SAL-004: verificar rol admin
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', input.adminId)
      .single()

    if (errorUsuario || !usuario) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Usuario no encontrado' } }
    }

    if (usuario.rol !== 'admin') {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Solo el Admin puede revisar notas para despacho' } }
    }

    // Obtener nota_producto con producto y nota padre
    const { data: notaProducto, error: errorNP } = await supabase
      .from('nota_productos')
      .select(`
        *,
        productos!nota_productos_producto_id_fkey(codigo_barra, sku, nombre),
        productos_equivalente:productos!nota_productos_producto_equivalente_id_fkey(codigo_barra, sku),
        notas_venta(id, estado, numero_nota)
      `)
      .eq('id', input.notaProductoId)
      .single()

    if (errorNP || !notaProducto) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Ítem de nota no encontrado', field: 'notaProductoId' } }
    }

    // Verificar que la nota está en estado 'completa'
    type NotaRef = { id: string; estado: string; numero_nota: string }
    const notaRef = notaProducto.notas_venta as NotaRef

    if (notaRef.estado !== 'completa') {
      return {
        ok: false,
        error: {
          code: 'CONFLICT_NOTA_NO_COMPLETA',
          message: `La nota está en estado '${notaRef.estado}'. Solo se pueden revisar notas en estado 'completa'`,
        },
      }
    }

    // Verificar que el producto escaneado corresponde al ítem
    type ProductoRef = { codigo_barra: string; sku: string; nombre: string }
    const productoRef    = notaProducto.productos as ProductoRef
    const equivalenteRef = notaProducto.productos_equivalente as { codigo_barra: string; sku: string } | null

    const codigoEsperado = notaProducto.producto_equivalente_id
      ? equivalenteRef?.codigo_barra
      : productoRef.codigo_barra
    const skuEsperado = notaProducto.producto_equivalente_id
      ? (equivalenteRef?.sku ?? productoRef.sku)
      : productoRef.sku

    const esCG = productoRef.sku.startsWith('CG')
    if (!esCG && codigoEsperado && codigoEsperado !== input.codigoProducto) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PRODUCTO',
          message: `El producto escaneado no corresponde a este ítem. Esperado: ${skuEsperado}`,
          field: 'codigoProducto',
        },
      }
    }

    // Usar cantidad_solicitada como referencia (en revisión directa la cantidad_despachada puede ser 0)
    const cantidadReferencia = notaProducto.cantidad_solicitada || notaProducto.cantidad_despachada

    if (input.cantidadIngresada > cantidadReferencia) {
      return {
        ok: false,
        error: {
          code: 'EXCEDE_SOLICITADO',
          message: `La cantidad ingresada (${input.cantidadIngresada}) supera la solicitada (${cantidadReferencia})`,
        },
      }
    }

    const coincide = input.cantidadIngresada === cantidadReferencia

    if (!coincide && !input.comentario?.trim()) {
      return {
        ok: false,
        error: {
          code: 'COMENTARIO_REQUERIDO',
          message: 'Debes indicar el motivo por el cual la cantidad es menor a la solicitada',
          field: 'comentario',
        },
      }
    }

    // Marcar revisado_admin y actualizar cantidad_despachada con lo físicamente contado
    const { error: errorUpdate } = await supabase
      .from('nota_productos')
      .update({ revisado_admin: true, cantidad_despachada: input.cantidadIngresada })
      .eq('id', input.notaProductoId)

    if (errorUpdate) {
      return { ok: false, error: { code: 'DB_ERROR', message: errorUpdate.message } }
    }

    // EV-001: registrar auditoría de revisión
    await supabase.from('movimientos').insert({
      tipo: 'revision_admin',
      nota_venta_id: notaRef.id,
      producto_id: notaProducto.producto_id,
      cantidad: input.cantidadIngresada,
      usuario_id: input.adminId,
      detalle: {
        numeroNota:         notaRef.numero_nota,
        sku:                productoRef.sku,
        nombreProducto:     productoRef.nombre,
        cantidadSolicitada: cantidadReferencia,
        cantidadRevisada:   input.cantidadIngresada,
        ...(input.comentario?.trim() ? { motivoDiferencia: input.comentario.trim() } : {}),
      },
    })

    // EV-002: registrar salida/salida_parcial visible en historial
    await supabase.from('movimientos').insert({
      tipo:          coincide ? 'salida' : 'salida_parcial',
      nota_venta_id: notaRef.id,
      producto_id:   notaProducto.producto_id,
      cantidad:      input.cantidadIngresada,
      usuario_id:    input.adminId,
      detalle: coincide
        ? { numeroNota: notaRef.numero_nota, sku: productoRef.sku, nombreProducto: productoRef.nombre, cantidadSolicitada: cantidadReferencia, cantidadDespachada: input.cantidadIngresada }
        : { numeroNota: notaRef.numero_nota, sku: productoRef.sku, nombreProducto: productoRef.nombre, cantidadSolicitada: cantidadReferencia, cantidadDespachada: input.cantidadIngresada, cantidadFaltante: cantidadReferencia - input.cantidadIngresada, razon: 'revision_admin', comentarioOperador: input.comentario?.trim() ?? null },
    })

    // Verificar si todos los ítems de la nota ya fueron revisados
    const { data: todosItems } = await supabase
      .from('nota_productos')
      .select('id, revisado_admin')
      .eq('nota_venta_id', notaRef.id)

    const todosRevisados = (todosItems ?? []).every(
      (item) => item.revisado_admin || item.id === input.notaProductoId
    )

    return {
      ok: true,
      data: {
        valido:            true,
        cantidadEsperada:  cantidadReferencia,
        cantidadIngresada: input.cantidadIngresada,
        coincide,
        mensaje:           coincide ? 'Producto revisado' : 'Verifique cantidad',
        todosRevisados,
      },
    }
  },
}
