import { useState, useEffect, useCallback } from 'react'
import { produccionClient, type RegistroProduccion, type TipoTarea } from '../api/produccionClient'

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useProduccion(usuarioId: string) {
  const [tareaActiva, setTareaActiva]   = useState<RegistroProduccion | null>(null)
  const [registros,   setRegistros]     = useState<RegistroProduccion[]>([])
  const [cargando,    setCargando]      = useState(true)
  const [error,       setError]         = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [activa, lista] = await Promise.all([
        produccionClient.obtenerActiva(usuarioId),
        produccionClient.obtenerRegistros({ usuarioId, fecha: fechaHoy() }),
      ])
      setTareaActiva(activa)
      setRegistros(lista.filter(r => r.hora_fin !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }, [usuarioId])

  useEffect(() => { cargar() }, [cargar])

  async function iniciar(params: { tipoTarea: TipoTarea; sku: string; unidadesMeta: number }) {
    const data = await produccionClient.iniciarTarea({ usuarioId, ...params })
    setTareaActiva(data)
  }

  async function cerrar(params: { unidadesLogradas: number; observaciones: string }) {
    if (!tareaActiva) return
    const data = await produccionClient.cerrarTarea({ registroId: tareaActiva.id, usuarioId, ...params })
    setTareaActiva(null)
    setRegistros(prev => [data, ...prev])
  }

  return { tareaActiva, registros, cargando, error, iniciar, cerrar, recargar: cargar }
}
