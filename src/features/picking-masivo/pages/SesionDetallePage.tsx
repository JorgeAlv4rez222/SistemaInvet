import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useQueryClient } from '@tanstack/react-query'
import { useCancelarSesion, useSesionPicking, useGuardarLpns } from '../hooks/usePickingMasivo'
import { useRealtimeSesion } from '../hooks/useRealtimePicking'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { SesionResumen } from '../services/picking-masivo.api'

type SubtareaDetalle = {
  id:                 string
  posicion_codigo:    string
  orden_fifo:         number
  cantidad_asignada:  number
  cantidad_despachada: number | null
  estado:             string
  bloqueado_por:      string | null
  bloqueado_en:       string | null
  completado_por:     string | null
  completado_en:      string | null
  motivo_diferencia:  string | null
  es_equivalente:     boolean
  producto_real_id:   string | null
  producto_equivalente: { codigo: string; descripcion: string } | null
}

type ItemDetalle = {
  id:                  string
  codigo:              string
  descripcion:         string
  cantidad_pedida:     number
  cantidad_despachada: number
  estado:              string
  motivo_diferencia:   string | null
  lpn:                 string | null
  lpn_validado:        boolean | null
  tienda:              string | null
  codigo_barra:        string | null
  subtareas_picking_masivo: SubtareaDetalle[]
}

type SesionDetalle = SesionResumen & { items: ItemDetalle[] }

const ESTADO_SESION_LABELS: Record<string, string> = {
  validando:  'Validando',
  activa:     'Activa',
  completada: 'Completada',
  despachado: 'Despachado',
  cancelada:  'Cancelada',
}

const ESTADO_ITEM_LABELS: Record<string, string> = {
  libre:       'Libre',
  en_progreso: 'En progreso',
  completado:  'Completado',
  parcial:     'Parcial',
  sin_stock:   'Sin stock',
}

const ESTADO_SUBTAREA_LABELS: Record<string, string> = {
  libre:      'Libre',
  bloqueado:  'Bloqueado',
  completado: 'Completado',
  parcial:    'Parcial',
  sin_stock:  'Sin stock',
}

function BadgeSesion({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado}`}>{ESTADO_SESION_LABELS[estado] ?? estado}</span>
}
function BadgeItem({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.replace(/_/g, '-')}`}>{ESTADO_ITEM_LABELS[estado] ?? estado}</span>
}
function BadgeSubtarea({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.replace(/_/g, '-')}`}>{ESTADO_SUBTAREA_LABELS[estado] ?? estado}</span>
}

function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

export function SesionDetallePage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const sesionId  = id ?? null

  const { data, isLoading, isError } = useSesionPicking(sesionId)
  useRealtimeSesion(sesionId)
  const cancelarSesion = useCancelarSesion()
  const guardarLpns    = useGuardarLpns()
  const qc             = useQueryClient()
  const fileInputRef   = useRef<HTMLInputElement>(null)

  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [expandido, setExpandido]       = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda]         = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'parcial' | 'sin_stock'>('todos')
  const [productosConfirmados, setProductosConfirmados] = useState(false)
  const [lpnCount, setLpnCount]     = useState(0)
  const [lpnSubiendo, setLpnSubiendo] = useState(false)
  const [lpnError, setLpnError]     = useState<string | null>(null)

  useEffect(() => {
    if (!sesionId) return
    qc.invalidateQueries({ queryKey: ['picking-masivo', 'sesion', sesionId] })
    try {
      setProductosConfirmados(localStorage.getItem(`pm_productos_ok_${sesionId}`) === '1')
    } catch {}
  }, [sesionId, qc])

  // Leer conteo de LPNs ya guardados en la BD al recibir la sesión
  useEffect(() => {
    const lpnsDb = (data as any)?.lpns_excel as unknown[] | undefined
    if (lpnsDb) setLpnCount(lpnsDb.length)
  }, [data])

  const toggleExpandido = useCallback((id: string) => {
    setExpandido((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  async function handleCancelar() {
    if (!sesionId) return
    setError(null)
    try {
      await cancelarSesion.mutateAsync(sesionId)
      setConfirmarCancelar(false)
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al cancelar la sesión')
    }
  }

  if (isLoading) return <div className="notas-page"><p className="cargando">Cargando sesión…</p></div>
  if (isError || !data) return <div className="notas-page"><p className="error">Error al cargar la sesión</p></div>

  const sesion = data as SesionDetalle
  const pct    = sesion.total_items ? Math.round((sesion.items_completados / sesion.total_items) * 100) : 0
  const puedeCancelar = sesion.estado === 'validando' || sesion.estado === 'activa'
  const sesionTieneLpn = sesion.items.some((i) => !!i.lpn)
  // Sodimac: todos los productos validados — chequea API (lpn_validado) o flag localStorage
  const todosProductosValidados = !sesionTieneLpn && sesion.items.length > 0 && (
    sesion.items.every((i) => i.lpn_validado === true) || productosConfirmados
  )

  function handleArchivoLpn(file: File) {
    setLpnError(null)
    setLpnSubiendo(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellText: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false }) as (string | null)[][]

        type LpnEntry = { lpn: string; totalEmpaque: number; items: { codigo: string; tienda: string; cantidad: number }[] }
        const lpnMap = new Map<string, LpnEntry>()
        let currentLpn: string | null = null

        for (const row of raw.slice(1)) {
          const col0 = String(row[0] ?? '').trim()
          const col1 = String(row[1] ?? '').trim()
          const col2 = String(row[2] ?? '').trim()
          const col3 = String(row[3] ?? '').trim()
          if (!col0 && !col1) continue
          if (col0.startsWith('Total ')) {
            const totalLpn = col0.replace('Total ', '').trim()
            const entry = lpnMap.get(totalLpn)
            if (entry) entry.totalEmpaque = parseInt(col3, 10) || 0
            currentLpn = null
          } else if (col0 && /^\d+$/.test(col0)) {
            currentLpn = col0
            if (!lpnMap.has(currentLpn)) lpnMap.set(currentLpn, { lpn: currentLpn, totalEmpaque: 0, items: [] })
            if (col1) lpnMap.get(currentLpn)!.items.push({ codigo: col1, tienda: col2, cantidad: parseInt(col3, 10) || 0 })
          } else if (!col0 && col1 && currentLpn) {
            lpnMap.get(currentLpn)!.items.push({ codigo: col1, tienda: col2, cantidad: parseInt(col3, 10) || 0 })
          }
        }

        const entradas = [...lpnMap.values()]
        if (entradas.length === 0) { setLpnError('El archivo no contiene LPNs válidos'); setLpnSubiendo(false); return }
        await guardarLpns.mutateAsync({ sesionId: sesionId!, lpnsData: entradas })
        setLpnCount(entradas.length)
      } catch {
        setLpnError('Error al procesar el archivo Excel')
      } finally {
        setLpnSubiendo(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function descargarExcel() {
    const ESTADO_LABEL: Record<string, string> = {
      completado: 'Completado',
      parcial:    'Parcial',
      sin_stock:  'Sin stock',
      libre:      'Pendiente',
      bloqueado:  'En progreso',
    }

    const filas: Record<string, unknown>[] = []

    for (const item of sesion.items) {
      for (const sub of item.subtareas_picking_masivo) {
        const eq = sub.es_equivalente && sub.producto_equivalente
          ? `${sub.producto_equivalente.codigo} — ${sub.producto_equivalente.descripcion}`
          : ''
        filas.push({
          'UPC / EAN':           item.codigo_barra ?? '—',
          'Descripción':         item.descripcion ?? item.codigo,
          'Código':              item.codigo,
          'Cant. Solicitada':    sub.cantidad_asignada,
          'Cant. Despachada':    sub.cantidad_despachada ?? 0,
          'Diferencia':          (sub.cantidad_despachada ?? 0) - sub.cantidad_asignada,
          'Estado':              ESTADO_LABEL[sub.estado] ?? sub.estado,
          'Motivo diferencia':   sub.motivo_diferencia ?? '',
          'Producto equivalente usado': eq,
        })
      }
    }

    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [
      { wch: 18 }, { wch: 40 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 30 }, { wch: 45 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle')
    const nombre = `picking-${sesion.nombre_cliente ?? sesion.numero_oc}-${sesion.numero_oc}.xlsx`
      .replace(/[^a-zA-Z0-9\-_.]/g, '_')
    XLSX.writeFile(wb, nombre)
  }

  return (
    <div className="notas-page">
      <div className="pm-sesion-detalle-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>
          <IcoBack /> Volver
        </button>
        <h1 className="notas-titulo" style={{ flex: 1, fontSize: '1.75rem' }}>Detalle — {sesion.nombre_cliente ?? sesion.numero_oc}</h1>
        <span className={`badge badge-${sesion.estado}`} style={{ fontSize: '1.4rem', padding: '0.5rem 1.2rem' }}>
          {ESTADO_SESION_LABELS[sesion.estado] ?? sesion.estado}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Barra sobre la tarjeta: Descargar (izq) | Cargar Excel LPN (der, solo Sodimac) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <button className="btn-secundario" onClick={descargarExcel} style={{ fontSize: '0.85rem' }}>
          ↓ Descargar detalle Excel
        </button>
        {!sesionTieneLpn && (sesion.estado === 'completada' || sesion.estado === 'despachado') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivoLpn(f) }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {lpnError && <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{lpnError}</span>}
              <button
                type="button"
                className="btn-secundario"
                disabled={lpnSubiendo}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '0.85rem' }}
              >
                {lpnSubiendo ? 'Subiendo…' : lpnCount > 0 ? `📎 Excel LPN (${lpnCount} LPNs)` : '📎 Cargar Excel LPN'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="pm-sesion-info-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span className="pm-sesion-info-cliente">{sesion.nombre_cliente ?? sesion.numero_oc}</span>
          {sesion.numero_oc_pedido && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              OC: <strong style={{ color: 'var(--text-primary)' }}>{sesion.numero_oc_pedido}</strong>
            </span>
          )}
        </div>
        <div className="pm-sesion-info-entrega">
          <span className="pm-sesion-info-entrega-label">Fecha de entrega</span>
          <span className="pm-sesion-info-entrega-fecha">{sesion.numero_oc}</span>
        </div>
      </div>

      {(sesion.estado === 'completada' || sesion.estado === 'despachado') && (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)', alignItems: 'center' }}>
          {sesion.estado === 'completada' && (
            <button className="btn-primario" onClick={() => navigate(`/picking-masivo/${sesionId}/despacho`)}>
              Validar Entrega →
            </button>
          )}
          {!sesionTieneLpn && (
            <button
              className="btn-primario"
              disabled={!todosProductosValidados || lpnCount === 0}
              title={!todosProductosValidados ? 'Completa la Validación de Entrega primero' : lpnCount === 0 ? 'Carga el Excel de LPNs primero' : undefined}
              onClick={() => navigate(`/picking-masivo/${sesionId}/despacho?fase=lpns`)}
            >
              Validar LPN →
            </button>
          )}
        </div>
      )}

      {puedeCancelar && (
        <div className="paso-acciones">
          {!confirmarCancelar ? (
            <button className="btn-secundario" onClick={() => setConfirmarCancelar(true)}>
              Cancelar sesión
            </button>
          ) : (
            <>
              <span className="picking-nombre">¿Cancelar esta sesión de picking? Esta acción no se puede revertir.</span>
              <button className="btn-secundario" onClick={() => setConfirmarCancelar(false)}>No, mantener</button>
              <button className="btn-primario" disabled={cancelarSesion.isPending} onClick={handleCancelar}>
                {cancelarSesion.isPending ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Buscar por código o nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: '180px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}
        />
        {(['todos', 'parcial', 'sin_stock'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroEstado(f)}
            style={{
              padding: '0.5rem 0.9rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: filtroEstado === f ? (f === 'parcial' ? 'var(--warning)' : f === 'sin_stock' ? 'var(--danger)' : 'var(--primary)') : 'var(--surface)',
              color: filtroEstado === f ? (f === 'todos' ? 'white' : '#000') : 'var(--text-secondary)',
            }}
          >
            {f === 'todos' ? 'Todos' : f === 'parcial' ? 'Parcial' : 'Sin stock'}
          </button>
        ))}
      </div>

      <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Detalle completo de productos</p>
      <div className="ing-productos-lista pm-items-lista">
        {sesion.items
          .filter((item) => {
            const q = busqueda.trim().toLowerCase()
            const matchBusqueda = !q || item.codigo.toLowerCase().includes(q) || (item.descripcion ?? '').toLowerCase().includes(q)
            const matchFiltro = filtroEstado === 'todos' || item.estado === filtroEstado
            return matchBusqueda && matchFiltro
          })
          .map((item) => {
          const abierto = expandido.has(item.id)
          return (
            <div key={item.id} className="ing-prod-item pm-item-card">
              <div
                className="ing-prod-fila pm-item-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleExpandido(item.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandido(item.id)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span className="ing-prod-nombre">
                    {item.descripcion && item.descripcion !== item.codigo ? item.descripcion : item.codigo}
                  </span>
                  {item.descripcion && item.descripcion !== item.codigo && (
                    <span className="ing-prod-sku">{item.codigo}</span>
                  )}
                </div>
                <div className="ing-prod-fila-derecha" style={{ gap: '0.5rem' }}>
                  {item.subtareas_picking_masivo.some(s => s.es_equivalente) && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d97706', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '0.3rem', padding: '0.1rem 0.4rem', whiteSpace: 'nowrap' }}>Equiv.</span>
                  )}
                  <BadgeItem estado={item.estado} />
                  <span className="pm-item-chevron">{abierto ? '▲' : '▼'}</span>
                </div>
              </div>

              {abierto && (
                <div className="pm-item-detalle">
                  <div className="pm-item-detalle-fila">
                    <span className="pm-item-detalle-label">Código</span>
                    <span className="pm-item-detalle-valor">{item.codigo}</span>
                  </div>
                  <div className="pm-item-detalle-fila">
                    <span className="pm-item-detalle-label">Cantidad OC</span>
                    <span className="pm-item-detalle-valor">{item.cantidad_pedida}</span>
                  </div>
                  <div className="pm-item-detalle-fila">
                    <span className="pm-item-detalle-label">Enviado</span>
                    <span className="pm-item-detalle-valor" style={{ color: item.cantidad_despachada < item.cantidad_pedida ? 'var(--warning)' : 'var(--success)' }}>{item.cantidad_despachada}</span>
                  </div>
                  {item.subtareas_picking_masivo.some(s => s.es_equivalente) && (
                    <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', display: 'block', marginBottom: '0.2rem' }}>⚠ Producto reemplazado por equivalente</span>
                      {item.subtareas_picking_masivo.filter(s => s.es_equivalente && s.producto_equivalente).map(s => (
                        <div key={s.id} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600 }}>{s.producto_equivalente!.codigo}</span>
                          {' — '}{s.producto_equivalente!.descripcion}
                        </div>
                      ))}
                    </div>
                  )}
                  {sesionTieneLpn && (
                    <div className="pm-item-detalle-fila">
                      <span className="pm-item-detalle-label">LPN</span>
                      {item.lpn
                        ? <span className="pm-item-detalle-valor pm-item-detalle-lpn">{item.lpn}</span>
                        : <span className="pm-item-detalle-valor pm-item-detalle-sin-lpn">Sin LPN asignado</span>
                      }
                    </div>
                  )}
                  {item.tienda && (
                    <div className="pm-item-detalle-fila">
                      <span className="pm-item-detalle-label">Tienda</span>
                      <span className="pm-item-detalle-valor">{item.tienda}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
