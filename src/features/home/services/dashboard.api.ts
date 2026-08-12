import { apiClient } from '../../../shared/utils/apiClient'

export type MesDespacho = { mes: string; label: string; cantidad: number }
export type DespachosMensuales = { meses: MesDespacho[]; total: number }

export type FiltrosDespachosMensuales = {
  cliente?:    string
  productoId?: string
  numeroNota?: string
}

function buildQuery(filtros: FiltrosDespachosMensuales): string {
  const params = new URLSearchParams({ vista: 'despachos-mensuales' })
  if (filtros.cliente)    params.set('cliente', filtros.cliente)
  if (filtros.productoId) params.set('productoId', filtros.productoId)
  if (filtros.numeroNota) params.set('numeroNota', filtros.numeroNota)
  return params.toString()
}

export const dashboardApi = {
  despachosMensuales: (filtros: FiltrosDespachosMensuales) =>
    apiClient.get<DespachosMensuales>(`/dashboard?${buildQuery(filtros)}`),
  clientes: () => apiClient.get<string[]>('/dashboard?vista=clientes'),
}
