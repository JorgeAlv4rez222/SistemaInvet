import { useState, useMemo } from 'react'
import { useNotasParaRevision } from '../hooks/useSalidas'
import { useDetalleNota } from '../../notas/hooks/useNotas'
import { RevisionFlow } from '../components/RevisionFlow'
import { ImportarNotaRevisionFlow } from '../components/ImportarNotaRevisionFlow'
import { useConectividad } from '../../../shared/hooks/useConectividad'
import type { NotaParaRevision } from '../services/salidas.api'
import type { ItemRevision } from '../components/RevisionFlow'

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'importar' }
  | { tipo: 'revision'; notaId: string; estadoNota: 'completa' | 'despachada'; nombreChofer: string | null }

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))

function formatearFecha(fecha: string): string {
  return fecha.slice(0, 10).split('-').reverse().join('-')
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IconFiltro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

// Componente intermedio que carga los productos de la nota antes de mostrar RevisionFlow
function RevisionConDetalle({
  notaId,
  estadoNota,
  nombreChofer,
  adminId,
  offline,
  onCerrar,
}: {
  notaId:       string
  estadoNota:   'completa' | 'despachada'
  nombreChofer: string | null
  adminId:      string
  offline:      boolean
  onCerrar:     () => void
}) {
  const { data, isLoading, isError } = useDetalleNota(notaId)

  if (isLoading) return <p className="cargando">Cargando productos…</p>
  if (isError || !data) return <p className="error">Error al cargar la nota</p>

  const items: ItemRevision[] = data.productos.map((p) => ({
    notaProductoId:     p.notaProductoId,
    sku:                p.sku,
    nombre:             p.nombre,
    codigoBarra:        p.codigoBarra,
    cantidadSolicitada: p.cantidadSolicitada,
    cantidadDespachada: p.cantidadDespachada,
    revisadoAdmin:      p.revisadoAdmin,
    estado:             p.estado,
    skuEquivalente:     p.skuEquivalente ?? null,
  }))

  return (
    <RevisionFlow
      notaId={notaId}
      numeroNota={data.numeroNota}
      nombreCliente={data.nombreCliente}
      rutCliente={data.rutCliente}
      numeroOc={data.numeroOc}
      comentarioDespacho={data.comentarioDespacho}
      adminId={adminId}
      items={items}
      estadoNota={estadoNota}
      nombreChofer={nombreChofer}
      offline={offline}
      onCerrar={onCerrar}
    />
  )
}

export function SalidasPage() {
  const adminId      = localStorage.getItem('user_id') ?? ''
  const esAdmin      = ['admin', 'supervisor'].includes(localStorage.getItem('user_rol') ?? '')
  const { offline }  = useConectividad()
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const { data, isLoading, isError } = useNotasParaRevision()

  const [busqueda, setBusqueda] = useState('')
  const [filtroAnio, setFiltroAnio] = useState<string | undefined>(undefined)
  const [filtroMes,  setFiltroMes]  = useState<string | undefined>(undefined)
  const [filtroDia,  setFiltroDia]  = useState<string | undefined>(undefined)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [seleccionadaId, setSeleccionadaId]   = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'completa' | 'despachada'>('completa')

  const HORAS_VISIBILIDAD_DESPACHADA = 25

  const notas = useMemo(() => {
    const todas = data ?? []
    const ahora = Date.now()
    return todas.filter((n) => {
      if (n.estado === 'despachada') {
        const ms = ahora - new Date(n.actualizadoEn).getTime()
        return ms < HORAS_VISIBILIDAD_DESPACHADA * 60 * 60 * 1000
      }
      return true
    })
  }, [data])

  const aniosDisponibles = useMemo(() => {
    const años = new Set(notas.map((n) => n.creadoEn?.slice(0, 4)).filter(Boolean))
    return Array.from(años).sort().reverse()
  }, [notas])

  const notasFiltradas = useMemo(() => {
    let lista = notas.filter((n) => n.estado === filtroEstado)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      lista = lista.filter((n) => n.numeroNota.toLowerCase().includes(q) || n.nombreCliente.toLowerCase().includes(q))
    }
    if (filtroAnio) lista = lista.filter((n) => n.creadoEn?.slice(0, 4) === filtroAnio)
    if (filtroMes)  lista = lista.filter((n) => n.creadoEn?.slice(5, 7) === filtroMes)
    if (filtroDia)  lista = lista.filter((n) => n.creadoEn?.slice(8, 10) === filtroDia)
    return lista
  }, [notas, busqueda, filtroAnio, filtroMes, filtroDia, filtroEstado])

  const filtrosActivos = [filtroAnio, filtroMes, filtroDia].filter(Boolean).length

  function limpiarFiltros() {
    setFiltroAnio(undefined)
    setFiltroMes(undefined)
    setFiltroDia(undefined)
  }

  function onSeleccionar(id: string) {
    setSeleccionadaId((cur) => (cur === id ? null : id))
  }

  function onRevisar() {
    if (!seleccionadaId) return
    const nota = notas.find((n) => n.notaId === seleccionadaId)
    if (nota) setVista({ tipo: 'revision', notaId: seleccionadaId, estadoNota: nota.estado, nombreChofer: nota.nombreChofer })
  }

  if (vista.tipo === 'importar') {
    return (
      <ImportarNotaRevisionFlow
        adminId={adminId}
        onVolver={() => setVista({ tipo: 'lista' })}
        onCreada={(notaId) => setVista({ tipo: 'revision', notaId, estadoNota: 'completa', nombreChofer: null })}
      />
    )
  }

  if (vista.tipo === 'revision') {
    return (
      <RevisionConDetalle
        notaId={vista.notaId}
        estadoNota={vista.estadoNota}
        nombreChofer={vista.nombreChofer}
        adminId={adminId}
        offline={offline}
        onCerrar={() => setVista({ tipo: 'lista' })}
      />
    )
  }

  return (
    <div className="notas-page">
      <h1 className="notas-titulo">NV para despacho</h1>

      {offline && <div className="aviso-offline">Sin conexión — modo solo lectura.</div>}

      {/* Búsqueda + Filtro en la misma fila */}
      <div className="notas-toolbar">
        <div className="ing-busqueda">
          <span className="ing-busqueda-icono"><IconSearch /></span>
          <input
            type="search"
            placeholder="Buscar por número de NV o cliente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoComplete="off"
          />
          {busqueda && (
            <button className="ing-busqueda-limpiar" onClick={() => setBusqueda('')}>✕</button>
          )}
        </div>
        <button
          type="button"
          className={`ing-filtrar-btn ${filtrosAbiertos ? 'ing-filtrar-btn--abierto' : ''}`}
          aria-expanded={filtrosAbiertos}
          onClick={() => setFiltrosAbiertos((v) => !v)}
        >
          <IconFiltro />
          Filtro
          {filtrosActivos > 0 && <span className="ing-filtrar-badge">{filtrosActivos}</span>}
        </button>
      </div>

      {filtrosAbiertos && (
        <div className="ing-filtros-panel">
          <div className="ing-filtro-grupo">
            <span className="ing-filtro-label">Fecha</span>
            <div className="ing-filtro-opciones">
              <select
                className="ing-filtro-select"
                value={filtroDia ?? ''}
                onChange={(e) => setFiltroDia(e.target.value || undefined)}
              >
                <option value="">Día</option>
                {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                className="ing-filtro-select"
                value={filtroMes ?? ''}
                onChange={(e) => setFiltroMes(e.target.value || undefined)}
              >
                <option value="">Mes</option>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
              <select
                className="ing-filtro-select"
                value={filtroAnio ?? ''}
                onChange={(e) => setFiltroAnio(e.target.value || undefined)}
              >
                <option value="">Año</option>
                {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {filtrosActivos > 0 && (
            <button type="button" className="ing-filtro-limpiar" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Filtro por estado */}
      <div className="sal-filtro-estado">
        <button
          type="button"
          className={`sal-estado-btn ${filtroEstado === 'completa' ? 'sal-estado-btn--activo' : ''}`}
          onClick={() => { setFiltroEstado('completa'); setSeleccionadaId(null) }}
        >
          Completa
        </button>
        <button
          type="button"
          className={`sal-estado-btn ${filtroEstado === 'despachada' ? 'sal-estado-btn--activo sal-estado-btn--despachada' : ''}`}
          onClick={() => { setFiltroEstado('despachada'); setSeleccionadaId(null) }}
        >
          Despachada
        </button>
      </div>

      {/* Revisar — se habilita al marcar una nota de la lista */}
      <div className="notas-veroc-wrap">
        <button className="btn-primario" disabled={!seleccionadaId || offline} onClick={onRevisar}>
          Revisar
        </button>
      </div>

      {isLoading && <p className="cargando">Cargando notas…</p>}
      {isError   && <p className="error">Error al cargar notas</p>}
      {!isLoading && !isError && notasFiltradas.length === 0 && (
        <div className="notas-vacio">
          <p>{filtrosActivos > 0 || busqueda
            ? 'Sin resultados para el filtro aplicado'
            : filtroEstado === 'despachada'
              ? 'No hay notas despachadas en las últimas 25 horas'
              : "No hay notas en estado 'completa' para revisar"
          }</p>
        </div>
      )}

      {!isLoading && !isError && notasFiltradas.length > 0 && (
        <>
          <p className="notas-conteo">{notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''}</p>
          <div className="notas-lista-panel">
            <div className="notas-lista-scroll">
              <div className="notas-lista-filas">
              {notasFiltradas.map((nota: NotaParaRevision) => {

                const marcada = nota.notaId === seleccionadaId
                return (
                  <div
                    key={nota.notaId}
                    className={`nota-fila-item ${marcada ? 'nota-fila-item--activa' : ''}`}
                  >
                    <div
                      className="nota-fila"
                      role="button"
                      tabIndex={0}
                      aria-pressed={marcada}
                      onClick={() => onSeleccionar(nota.notaId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionar(nota.notaId) }
                      }}
                    >
                      {/* Selección — solo una nota a la vez */}
                      <button
                        type="button"
                        className={`nota-fila-check ${marcada ? 'nota-fila-check--activo' : ''}`}
                        aria-pressed={marcada}
                        aria-label={marcada ? `Quitar selección de ${nota.numeroNota}` : `Seleccionar ${nota.numeroNota}`}
                        onClick={(e) => { e.stopPropagation(); onSeleccionar(nota.notaId) }}
                      >
                        {marcada && <IconCheck />}
                      </button>

                      {/* Número + cliente */}
                      <div className="nota-fila-principal">
                        <span className="nota-fila-numero">{nota.numeroNota}</span>
                        <span className="nota-fila-cliente">{nota.nombreCliente}</span>
                      </div>

                      {/* Progreso */}
                      <div className="nota-fila-progreso">
                        <span className="nota-progreso-texto">
                          {nota.productosCompletos}/{nota.totalProductos}
                        </span>
                      </div>

                      {/* Fecha */}
                      <span className="nota-fila-fecha">{formatearFecha(nota.creadoEn)}</span>

                      {/* Estado */}
                      <div className="nota-fila-estado">
                        <span className={`badge badge-${nota.estado}`}>
                          {nota.estado === 'despachada' ? 'Despachada' : 'Completa'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
