import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotas } from '../hooks/useNotas'
import { useConectividad } from '../../../shared/hooks/useConectividad'
import { ImportarNotaFlow } from '../components/ImportarNotaFlow'
import type { NotaResumen } from '../services/notas.api'

const ESTADO_LABELS: Record<string, string> = {
  pendiente:   'Pendiente',
  preparacion: 'En preparación',
  completa:    'Completa',
  despachada:  'Despachada',
}
const ESTADO_FILTROS = ['', 'pendiente', 'preparacion', 'completa'] as const

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))

function BadgeEstado({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.replace('_', '-')}`}>{ESTADO_LABELS[estado] ?? estado}</span>
}

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

function IcoLock({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

export function NotasPage() {
  const navigate    = useNavigate()
  const { offline } = useConectividad()
  const ADMIN_ID    = localStorage.getItem('user_id') ?? ''
  const ROL         = localStorage.getItem('user_rol') ?? ''
  const [filtroEstado, setFiltroEstado] = useState<string | undefined>(undefined)
  const [filtroAnio,   setFiltroAnio]   = useState<string | undefined>(undefined)
  const [filtroMes,    setFiltroMes]    = useState<string | undefined>(undefined)
  const [filtroDia,    setFiltroDia]    = useState<string | undefined>(undefined)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [estadosAbiertos, setEstadosAbiertos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [importar, setImportar] = useState(false)
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const { data, isLoading, isError, refetch } = useNotas(filtroEstado)

  const notas = data ?? []

  const aniosDisponibles = useMemo(() => {
    const años = new Set(notas.map((n) => n.creadoEn?.slice(0, 4)).filter(Boolean))
    return Array.from(años).sort().reverse()
  }, [notas])

  const notasFiltradas = useMemo(() => {
    let lista = notas
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      lista = lista.filter((n) => n.numeroNota.toLowerCase().includes(q) || n.nombreCliente.toLowerCase().includes(q))
    }
    if (filtroAnio) lista = lista.filter((n) => n.creadoEn?.slice(0, 4) === filtroAnio)
    if (filtroMes)  lista = lista.filter((n) => n.creadoEn?.slice(5, 7) === filtroMes)
    if (filtroDia)  lista = lista.filter((n) => n.creadoEn?.slice(8, 10) === filtroDia)
    lista = lista.filter((n) => n.estado !== 'despachada')
    return lista
  }, [notas, busqueda, filtroAnio, filtroMes, filtroDia])

  if (importar && ROL === 'admin') {
    return (
      <ImportarNotaFlow
        adminId={ADMIN_ID}
        onVolver={() => setImportar(false)}
        onCreada={(notaId) => { setImportar(false); refetch(); navigate(`/notas/${notaId}`) }}
      />
    )
  }

  const filtrosActivos = [filtroEstado, filtroAnio, filtroMes, filtroDia].filter(Boolean).length

  function limpiarFiltros() {
    setFiltroEstado(undefined)
    setFiltroAnio(undefined)
    setFiltroMes(undefined)
    setFiltroDia(undefined)
  }

  function onSeleccionar(id: string) {
    setSeleccionadaId((cur) => (cur === id ? null : id))
  }

  function esTomadaPorOtro(nota: import('../services/notas.api').NotaResumen): boolean {
    return !!nota.tomadaPor && nota.tomadaPor !== ADMIN_ID
  }

  function onVerNota() {
    if (seleccionadaId) navigate(`/notas/${seleccionadaId}`)
  }

  return (
    <div className="notas-page">
      <h1 className="notas-titulo">NV pendiente de preparacion</h1>

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
            <button
              type="button"
              className={`ing-filtrar-btn ${estadosAbiertos ? 'ing-filtrar-btn--abierto' : ''}`}
              aria-expanded={estadosAbiertos}
              onClick={() => setEstadosAbiertos((v) => !v)}
            >
              Estados
              {filtroEstado && <span className="ing-filtrar-badge">1</span>}
            </button>
            {estadosAbiertos && (
              <div className="ing-filtro-opciones">
                {ESTADO_FILTROS.map((e) => (
                  <button
                    key={e}
                    className={`filtro-btn ${(filtroEstado ?? '') === e ? 'activo' : ''}`}
                    onClick={() => setFiltroEstado(e || undefined)}
                  >
                    {e ? ESTADO_LABELS[e] : 'Todas'}
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* Nueva NV (izquierda) + Ver nota (derecha) */}
      <div className="notas-veroc-wrap">
        {ROL === 'admin' && (
          <button className="btn-primario" onClick={() => setImportar(true)} disabled={offline}>
            + NV
          </button>
        )}
        <button
          className="btn-primario"
          disabled={!seleccionadaId || esTomadaPorOtro(notas.find((n) => n.notaId === seleccionadaId)!)}
          onClick={onVerNota}
        >
          Ver nota
        </button>
      </div>

      {isLoading && <p className="cargando">Cargando notas…</p>}
      {isError   && <p className="error">Error al cargar notas</p>}
      {!isLoading && !isError && notasFiltradas.length === 0 && (
        <div className="notas-vacio">
          <p>{filtrosActivos > 0 ? 'Sin resultados para el filtro aplicado' : 'No hay notas de venta'}</p>
        </div>
      )}

      {!isLoading && !isError && notasFiltradas.length > 0 && (
        <>
          <p className="notas-conteo">{notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''}</p>
          <div className="notas-lista-panel">
            <div className="notas-lista-scroll">
              <div className="notas-lista-filas">
              {notasFiltradas.map((nota: NotaResumen) => {
                const marcada     = nota.notaId === seleccionadaId
                const bloqueada   = esTomadaPorOtro(nota)
                return (
                  <div
                    key={nota.notaId}
                    className={`nota-fila-item ${marcada ? 'nota-fila-item--activa' : ''} ${bloqueada ? 'nota-fila-item--bloqueada' : ''}`}
                  >
                    <div
                      className="nota-fila"
                      role="button"
                      tabIndex={0}
                      aria-pressed={marcada}
                      onClick={() => !bloqueada && onSeleccionar(nota.notaId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!bloqueada) onSeleccionar(nota.notaId) }
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
                        <BadgeEstado estado={nota.estado} />
                        {bloqueada && (
                          <span className="nota-fila-lock" title="En preparación por otro operador">
                            <IcoLock />
                          </span>
                        )}
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
