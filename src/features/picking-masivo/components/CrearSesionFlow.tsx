import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parsearExcelPicking, type FilaExcelPicking } from '../utils/parsearExcelPicking'
import { useActivarSesion, useCrearSesion, useValidarExcel } from '../hooks/usePickingMasivo'
import { ApiResponseError } from '../../../shared/utils/apiClient'
import type { ValidarExcelResult } from '../services/picking-masivo.api'

type Paso = 'upload' | 'preview' | 'validado'

const ALERTA_LABELS: Record<string, string> = {
  sin_catalogo:       'Sin catálogo',
  sin_stock:          'Sin stock',
  stock_insuficiente: 'Stock insuficiente',
}

function IcoBack({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

export function CrearSesionFlow({ adminId }: { adminId: string }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [paso, setPaso]                   = useState<Paso>('upload')
  const [archivo, setArchivo]             = useState<File | null>(null)
  const [filas, setFilas]                 = useState<FilaExcelPicking[]>([])
  const [numeroOc, setNumeroOc]           = useState('')
  const [nombreCliente, setNombreCliente] = useState('')
  const [resultado, setResultado]         = useState<ValidarExcelResult | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [creando, setCreando]             = useState(false)

  const validarExcel  = useValidarExcel()
  const crearSesion   = useCrearSesion()
  const activarSesion = useActivarSesion()

  async function handleArchivoSeleccionado(file: File) {
    setError(null)
    setArchivo(file)
    try {
      const resultadoParseo = await parsearExcelPicking(file)
      if (resultadoParseo.errores.length > 0) {
        setError(resultadoParseo.errores.join(' — '))
        return
      }
      setFilas(resultadoParseo.filas)
      setPaso('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    }
  }

  async function handleValidar() {
    if (!nombreCliente.trim()) { setError('Ingresa el nombre del cliente'); return }
    if (!numeroOc.trim()) { setError('Ingresa la fecha de entrega'); return }
    setError(null)
    try {
      const res = await validarExcel.mutateAsync({
        items: filas.map((f) => ({ codigo: f.codigo, descripcion: f.descripcion, cantidadPedida: f.cantidadPedida, codigoBarra: f.codigoBarra, lpn: f.lpn, tienda: f.tienda })),
      })
      setResultado(res)
      setPaso('validado')
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al validar el archivo')
    }
  }

  async function handleConfirmar() {
    if (!resultado) return
    setCreando(true)
    setError(null)
    try {
      const { sesionId } = await crearSesion.mutateAsync({
        usuarioId:     adminId,
        numeroOc:      numeroOc.trim(),
        nombreCliente: nombreCliente.trim() || undefined,
        archivoNombre: archivo?.name ?? 'excel.xlsx',
        items: resultado.items.map((i) => ({
          codigo:         i.codigo,
          descripcion:    i.descripcion,
          cantidadPedida: i.cantidadPedida,
          productoId:     i.productoId,
          codigoBarra:    i.codigoBarra,
          lpn:            i.lpn,
          tienda:         i.tienda,
        })),
      })
      await activarSesion.mutateAsync({ sesionId, usuarioId: adminId })
      navigate(`/picking-masivo/${sesionId}`)
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al crear la sesión')
      setCreando(false)
    }
  }

  return (
    <div className="notas-page">
      <div className="ing-detalle-header">
        <button className="btn-volver" onClick={() => navigate('/picking-masivo')}>
          <IcoBack /> Volver
        </button>
        <h1 className="notas-titulo">Nueva sesión de picking masivo</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {paso === 'upload' && (
        <div className="paso">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivoSeleccionado(f) }}
          />
          <button className="upload-zona" onClick={() => inputRef.current?.click()}>
            {archivo ? `📄 ${archivo.name}` : '📎 Seleccionar Excel'}
          </button>
        </div>
      )}

      {paso === 'preview' && (
        <div className="paso">
          <div className="ing-filtro-grupo">
            <span className="ing-filtro-label">Cliente</span>
            <input
              className="ing-filtro-select"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              placeholder="Nombre cliente"
              autoFocus
            />
          </div>
          <div className="ing-filtro-grupo">
            <span className="ing-filtro-label">Fecha de entrega</span>
            <input
              className="ing-filtro-select"
              value={numeroOc}
              onChange={(e) => setNumeroOc(e.target.value)}
              placeholder="Ej: 28-08-2026"
            />
          </div>

          <p className="notas-conteo">{filas.length} línea{filas.length !== 1 ? 's' : ''} detectada{filas.length !== 1 ? 's' : ''}</p>

          <div className="excel-tabla-wrap">
            <table className="excel-tabla">
              <thead>
                <tr>
                  <th className="excel-th excel-th--num">#</th>
                  <th className="excel-th">Código</th>
                  <th className="excel-th excel-th--derecha">Cantidad</th>
                  {filas.some((f) => f.codigoBarra) && <th className="excel-th">EAN / UPC</th>}
                  {filas.some((f) => f.lpn)         && <th className="excel-th">LPN</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'excel-tr--par' : 'excel-tr--impar'}>
                    <td className="excel-td excel-td--num">{i + 1}</td>
                    <td className="excel-td">{f.codigo}</td>
                    <td className="excel-td excel-td--derecha">{f.cantidadPedida}</td>
                    {filas.some((f2) => f2.codigoBarra) && <td className="excel-td">{f.codigoBarra ?? '—'}</td>}
                    {filas.some((f2) => f2.lpn)         && <td className="excel-td">{f.lpn ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="paso-acciones">
            <button className="btn-secundario" onClick={() => { setPaso('upload'); setArchivo(null); setFilas([]) }}>
              <IcoBack /> Volver
            </button>
            <button className="btn-primario" disabled={validarExcel.isPending} onClick={handleValidar}>
              {validarExcel.isPending ? 'Validando…' : 'Validar'}
            </button>
          </div>
        </div>
      )}

      {paso === 'validado' && resultado && (
        <div className="paso">
          <p className="pm-validado-resumen">{resultado.totalItems} ítems · {resultado.conCatalogo} en catálogo · {resultado.sinStock} sin stock</p>

          {resultado.alertas.length > 0 && (
            <div className="pm-alertas-lista">
              {resultado.alertas.map((a, i) => (
                <div key={i} className="pm-alerta-fila">
                  <div className="pm-alerta-izq">
                    <span className="pm-alerta-codigo">{a.codigo}</span>
                    {a.stockActual !== undefined && (
                      <span className="pm-alerta-stock">Stock: {a.stockActual} · Solicitado: {a.solicitado ?? 0}</span>
                    )}
                  </div>
                  <span className={`badge badge-${a.tipo.replace(/_/g, '-')}`}>{ALERTA_LABELS[a.tipo] ?? a.tipo}</span>
                </div>
              ))}
            </div>
          )}

          <div className="paso-acciones">
            <button className="btn-secundario" onClick={() => setPaso('preview')}>
              <IcoBack /> Volver
            </button>
            <button className="btn-primario" disabled={creando} onClick={handleConfirmar}>
              {creando ? 'Creando sesión…' : 'Confirmar y activar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
