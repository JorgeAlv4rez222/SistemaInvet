import { useState, useRef, useEffect, useCallback } from 'react'
import { useResolverPosicion, useResolverProducto, useRegistrarLoteInicial } from '../hooks/useInventarioInicial'
import { BarcodeScanner }                         from '../../../shared/components/BarcodeScanner'
import { ApiResponseError }                       from '../../../shared/utils/apiClient'
import type { InfoPosicion, InfoProducto }        from '../services/inventarioInicial.api'

type Paso =
  | { tipo: 'posicion' }
  | { tipo: 'producto';  posicion: InfoPosicion }
  | { tipo: 'exito';     posicion: string; sku: string; cantidad: number }

type Props = { usuarioId: string }

export function CargaPosicionFlow({ usuarioId }: Props) {
  const [paso,         setPaso]         = useState<Paso>({ tipo: 'posicion' })
  const [error,        setError]        = useState<string | null>(null)
  const [codPosicion,  setCodPosicion]  = useState('')
  const [codProducto,  setCodProducto]  = useState('')
  const [totalRegistrados, setTotalRegistrados] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrarToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const posRef  = useRef<HTMLInputElement>(null)
  const prodRef = useRef<HTMLInputElement>(null)

  const resolverPos  = useResolverPosicion()
  const resolverProd = useResolverProducto()
  const registrar    = useRegistrarLoteInicial()

  useEffect(() => {
    if (paso.tipo === 'posicion') posRef.current?.focus()
    if (paso.tipo === 'producto') prodRef.current?.focus()
  }, [paso])

  async function handleConfirmarPosicion() {
    const codigo = codPosicion.trim()
    if (!codigo) { setError('Escanea el código QR de la posición'); return }
    setError(null)
    try {
      const pos = await resolverPos.mutateAsync(codigo)
      if (pos.ocupada) {
        setError(`La posición ${pos.codigo} ya tiene stock registrado. Escanea otra posición.`)
        setCodPosicion('')
        return
      }
      mostrarToast('✓ Rack escaneado correctamente')
      setPaso({ tipo: 'producto', posicion: pos })
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al resolver la posición')
    }
  }

  async function handleConfirmarProducto() {
    if (paso.tipo !== 'producto') return
    const codigo = codProducto.trim()
    if (!codigo) { setError('Escanea el código de barras del producto'); return }
    setError(null)
    try {
      const prod = await resolverProd.mutateAsync(codigo)
      mostrarToast('✓ Producto escaneado correctamente')
      // Registrar directamente con cantidad 0 — la cantidad se ajustará al integrar la BD real
      const resultado = await registrar.mutateAsync({
        usuarioId,
        posicionId:   paso.posicion.id,
        productoId:   prod.id,
        cantidad:     0,
        fechaIngreso: new Date().toISOString().slice(0, 10),
      })
      setTotalRegistrados((n) => n + 1)
      setPaso({ tipo: 'exito', posicion: resultado.posicion, sku: resultado.skuProducto, cantidad: 0 })
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al resolver el producto')
    }
  }

  async function handleRegistrar() {
    if (paso.tipo !== 'cantidad') return
    const cant = parseInt(cantidad, 10)
    if (!cant || cant <= 0) { setError('Ingresa una cantidad válida'); return }
    if (!fechaIngreso)      { setError('La fecha es obligatoria'); return }
    setError(null)
    try {
      const resultado = await registrar.mutateAsync({
        usuarioId,
        posicionId:   paso.posicion.id,
        productoId:   paso.producto.id,
        cantidad:     cant,
        fechaIngreso,
      })
      setTotalRegistrados((n) => n + 1)
      setPaso({ tipo: 'exito', posicion: resultado.posicion, sku: resultado.skuProducto, cantidad: cant })
    } catch (e) {
      setError(e instanceof ApiResponseError ? e.message : 'Error al registrar')
    }
  }

  function siguientePosicion() {
    setCodPosicion(''); setCodProducto('')
    setError(null)
    setPaso({ tipo: 'posicion' })
  }

  return (
    <div className="inv-flow">

      {/* Contador de progreso */}
      {totalRegistrados > 0 && (
        <div className="inv-contador">
          <span className="inv-contador-num">{totalRegistrados}</span>
          <span>posición{totalRegistrados !== 1 ? 'es' : ''} registrada{totalRegistrados !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Indicador de pasos */}
      <div className="inv-pasos">
        {['Posición', 'Producto'].map((label, i) => {
          const pasoIdx = { posicion: 0, producto: 1, exito: 2 }[paso.tipo]
          return (
            <div key={label} className={`inv-paso-dot ${i === pasoIdx ? 'activo' : i < pasoIdx ? 'completo' : ''}`}>
              <span>{i + 1}</span>
              <small>{label}</small>
            </div>
          )
        })}
      </div>

      {/* Toast flotante */}
      {toast && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(15,30,20,0.97)', border: '1.5px solid #22c55e',
          color: '#4ade80', borderRadius: '1rem', padding: '1.1rem 2rem',
          fontWeight: 700, fontSize: '1.1rem', zIndex: 9999,
          boxShadow: '0 8px 40px rgba(34,197,94,0.3)',
          whiteSpace: 'nowrap', textAlign: 'center',
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      {error && (
        <div className={`inv-error ${error.startsWith('⚠️') ? 'inv-error--advertencia' : ''}`}>
          {error}
        </div>
      )}

      {/* ── PASO 1: Escanear posición ── */}
      {paso.tipo === 'posicion' && (
        <div className="inv-card">
          <div className="inv-icono-paso">📍</div>
          <h3>Escanea la posición</h3>
          <p className="inv-instruccion">Ubícate en el rack y escanea el código QR de la posición</p>
          <div className="input-con-camara">
            <input
              ref={posRef}
              type="text"
              placeholder="Código de posición…"
              value={codPosicion}
              onChange={(e) => { setCodPosicion(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmarPosicion()}
              autoComplete="off"
            />
            <BarcodeScanner
              onDetected={(c) => { setCodPosicion(c); setError(null) }}
              title="Escanear posición"
            />
          </div>
          <button
            className="btn-primario"
            onClick={handleConfirmarPosicion}
            disabled={resolverPos.isPending || !codPosicion.trim()}
          >
            {resolverPos.isPending ? 'Buscando…' : 'Confirmar →'}
          </button>
        </div>
      )}

      {/* ── PASO 2: Escanear producto ── */}
      {paso.tipo === 'producto' && (
        <div className="inv-card">
          <div className="inv-posicion-badge">
            <span className="inv-badge-etiqueta">Posición</span>
            <span className="inv-badge-codigo">{paso.posicion.codigo}</span>
            <span className="inv-badge-detalle">Rack {paso.posicion.rackCodigo} · Nivel {paso.posicion.nivel} · Pos {paso.posicion.posicion}</span>
          </div>
          <div className="inv-icono-paso">📦</div>
          <h3>Escanea el producto</h3>
          <p className="inv-instruccion">Escanea el código de barras del producto en esta posición</p>
          <div className="input-con-camara">
            <input
              ref={prodRef}
              type="text"
              placeholder="Código de barras…"
              value={codProducto}
              onChange={(e) => { setCodProducto(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmarProducto()}
              autoComplete="off"
            />
            <BarcodeScanner
              onDetected={(c) => { setCodProducto(c); setError(null) }}
              title="Escanear producto"
            />
          </div>
          <div className="inv-acciones">
            <button className="btn-secundario" onClick={() => { setError(null); setPaso({ tipo: 'posicion' }) }}>
              ← Volver
            </button>
            <button
              className="btn-primario"
              onClick={handleConfirmarProducto}
              disabled={resolverProd.isPending || !codProducto.trim()}
            >
              {resolverProd.isPending ? 'Buscando…' : 'Confirmar →'}
            </button>
          </div>
        </div>
      )}


      {/* ── ÉXITO ── */}
      {paso.tipo === 'exito' && (
        <div className="inv-card inv-exito">
          <div className="inv-exito-icono">✓</div>
          <h3>¡Registrado!</h3>
          <p><strong>{paso.cantidad}</strong> unidades de <code>{paso.sku}</code></p>
          <p>en posición <strong>{paso.posicion}</strong></p>
          <button className="btn-primario inv-siguiente-btn" onClick={siguientePosicion}>
            → Siguiente posición
          </button>
        </div>
      )}
    </div>
  )
}
