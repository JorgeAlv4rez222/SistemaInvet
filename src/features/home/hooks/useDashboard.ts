import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../shared/utils/apiClient'
import { dashboardApi, type FiltrosDespachosMensuales } from '../services/dashboard.api'

export type DashboardKPIs = {
  totalProductos:   number
  stockTotal:       number
  notasPendientes:  number
  notasDespacho:    number
  ocPendientes:     number
  posicionesLibres: number
  posicionesTotal:  number
  ocupacionPct:     number
}

export function useDashboard() {
  return useQuery<DashboardKPIs>({
    queryKey: ['dashboard'],
    queryFn:  () => apiClient.get<DashboardKPIs>('/dashboard'),
    staleTime: 60_000,
  })
}

export function useDespachosMensuales(filtros: FiltrosDespachosMensuales) {
  return useQuery({
    queryKey:  ['dashboard', 'despachos-mensuales', filtros],
    queryFn:   () => dashboardApi.despachosMensuales(filtros),
    staleTime: 60_000,
  })
}

export function useClientesNotas() {
  return useQuery({
    queryKey:  ['dashboard', 'clientes'],
    queryFn:   dashboardApi.clientes,
    staleTime: 5 * 60_000,
  })
}
