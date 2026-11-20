import type { TipoTarea, RegistroProduccion } from '../../../../api/produccion/produccion.service'

export type { TipoTarea, RegistroProduccion }

export const TIPOS_TAREA: { value: TipoTarea; label: string }[] = [
  { value: 'etiquetado',    label: 'Etiquetado general' },
  { value: 'cambio_codigo', label: 'Cambio de códigos' },
  { value: 'cambio_bolsa',  label: 'Cambio de bolsa' },
  { value: 'codigo_sku_dun',label: 'Colocación SKU / DUN' },
  { value: 'sellado',       label: 'Sellado' },
]

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      ...opts?.headers,
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? 'Error en la petición')
  return json as T
}

export const produccionClient = {
  obtenerActiva: (usuarioId: string) =>
    apiFetch<RegistroProduccion | null>(`/api/produccion?accion=activa&usuarioId=${usuarioId}`),

  obtenerRegistros: (params: { usuarioId?: string; fecha?: string; sku?: string; fechaDesde?: string; fechaHasta?: string }) => {
    const qs = new URLSearchParams()
    if (params.usuarioId)  qs.set('usuarioId',  params.usuarioId)
    if (params.fecha)      qs.set('fecha',       params.fecha)
    if (params.sku)        qs.set('sku',         params.sku)
    if (params.fechaDesde) qs.set('fechaDesde',  params.fechaDesde)
    if (params.fechaHasta) qs.set('fechaHasta',  params.fechaHasta)
    return apiFetch<RegistroProduccion[]>(`/api/produccion?${qs}`)
  },

  iniciarTarea: (body: { usuarioId: string; tipoTarea: TipoTarea; sku: string; unidadesMeta: number }) =>
    apiFetch<RegistroProduccion>('/api/produccion?accion=iniciar', { method: 'POST', body: JSON.stringify(body) }),

  cerrarTarea: (body: { registroId: string; usuarioId: string; unidadesLogradas: number; observaciones: string }) =>
    apiFetch<RegistroProduccion>('/api/produccion?accion=cerrar', { method: 'POST', body: JSON.stringify(body) }),
}
