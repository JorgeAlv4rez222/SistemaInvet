import { useMutation, useQueryClient } from '@tanstack/react-query'
import { devolucionesApi } from '../services/devoluciones.api'
import type { DevolucionItemInput } from '../services/devoluciones.api'

export function useRegistrarDevolucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ adminId, notaId, items }: { adminId: string; notaId: string; items: DevolucionItemInput[] }) =>
      devolucionesApi.registrar(adminId, notaId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}
