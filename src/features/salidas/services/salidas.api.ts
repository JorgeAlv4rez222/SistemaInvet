import { apiClient } from '../../../shared/utils/apiClient'
import type {
  ValidarProductoInput,
  ValidarProductoResult,
} from '../../../../api/salidas/salidas.service'

export type NotaParaRevision = {
  notaId:             string
  numeroNota:         string
  nombreCliente:      string
  estado:             'completa' | 'despachada'
  totalProductos:     number
  productosCompletos: number
  creadoEn:           string
  actualizadoEn:      string
}

export type { ValidarProductoResult }

export const salidasApi = {
  getNotasParaRevision: () =>
    apiClient.get<NotaParaRevision[]>('/salidas'),

  validarProducto: (body: ValidarProductoInput) =>
    apiClient.post<ValidarProductoResult>('/salidas?accion=validar-producto', body),
}
