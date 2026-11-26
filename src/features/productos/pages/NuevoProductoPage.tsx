import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PREFIJOS = [
  '2 USB','B','BK','BO','CG000','CG001','CG002','CG003','CP005',
  'DR','EK','GT','HX','LED E14','LED E27','LED GU10','NUMERICO','PACK','UB','PL',
]

type Campo = {
  sku: string
  nombre: string
  codigo_barra: string
  prefijo: string
  codigo_grupo: string
  descripcion_grupo: string
  codigo_subgrupo: string
  descripcion_subgrupo: string
  alto_cm: string
  ancho_cm: string
  largo_cm: string
  peso_kg: string
}

const VACIO: Campo = {
  sku: '', nombre: '', codigo_barra: '', prefijo: '',
  codigo_grupo: '', descripcion_grupo: '',
  codigo_subgrupo: '', descripcion_subgrupo: '',
  alto_cm: '', ancho_cm: '', largo_cm: '', peso_kg: '',
}

function IcoBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

export function NuevoProductoPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState<Campo>(VACIO)
  const [error, setError]     = useState<string | null>(null)
  const [exito, setExito]     = useState(false)
  const [enviando, setEnviando] = useState(false)

  function set(key: keyof Campo, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.prefijo) { setError('Selecciona un prefijo'); return }

    const alto  = parseFloat(form.alto_cm)
    const ancho = parseFloat(form.ancho_cm)
    const largo = parseFloat(form.largo_cm)
    const peso  = parseFloat(form.peso_kg)

    if ([alto, ancho, largo, peso].some(isNaN)) {
      setError('Las dimensiones y el peso deben ser números válidos')
      return
    }

    setEnviando(true)
    setError(null)

    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku:                  form.sku,
          nombre:               form.nombre,
          codigo_barra:         form.codigo_barra,
          prefijo:              form.prefijo,
          codigo_grupo:         form.codigo_grupo || '000',
          descripcion_grupo:    form.descripcion_grupo || 'Sin clasificar',
          codigo_subgrupo:      form.codigo_subgrupo || '000',
          descripcion_subgrupo: form.descripcion_subgrupo || 'Sin clasificar',
          alto_cm:  alto,
          ancho_cm: ancho,
          largo_cm: largo,
          peso_kg:  peso,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Error al crear producto')
        return
      }

      setExito(true)
      setForm(VACIO)
      setTimeout(() => setExito(false), 4000)
    } catch {
      setError('Error de red. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="np-wrap">
      <div className="np-header">
        <button className="np-btn-back" onClick={() => navigate('/productos')}>
          <IcoBack /> Volver
        </button>
        <div>
          <h1 className="np-titulo">Nuevo Producto</h1>
          <p className="notas-descripcion">Registra un nuevo producto en el catálogo. Completa el SKU, prefijo, dimensiones y datos de clasificación.</p>
        </div>
      </div>

      <form className="np-form" onSubmit={handleSubmit} noValidate>

        {/* ── Identificación ── */}
        <section className="np-seccion">
          <h2 className="np-seccion-titulo">Identificación</h2>
          <div className="np-grid2">
            <div className="np-campo">
              <label className="np-label">SKU <span className="np-req">*</span></label>
              <input className="np-input" required value={form.sku}
                onChange={e => set('sku', e.target.value.toUpperCase())}
                placeholder="Ej: PLLED-RS-12C" />
            </div>
            <div className="np-campo">
              <label className="np-label">Código de barra <span className="np-req">*</span></label>
              <input className="np-input" required value={form.codigo_barra}
                onChange={e => set('codigo_barra', e.target.value)}
                placeholder="EAN / UPC" />
            </div>
          </div>

          <div className="np-campo">
            <label className="np-label">Nombre del producto <span className="np-req">*</span></label>
            <input className="np-input" required value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre descriptivo completo" />
          </div>

          <div className="np-campo">
            <label className="np-label">Prefijo <span className="np-req">*</span></label>
            <div className="np-prefijos">
              {PREFIJOS.map(p => (
                <button
                  key={p}
                  type="button"
                  className={`np-prefijo-btn${form.prefijo === p ? ' np-prefijo-btn--activo' : ''}`}
                  onClick={() => set('prefijo', p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Clasificación ── */}
        <section className="np-seccion">
          <h2 className="np-seccion-titulo">Clasificación</h2>
          <div className="np-grid2">
            <div className="np-campo">
              <label className="np-label">Código grupo</label>
              <input className="np-input" value={form.codigo_grupo}
                onChange={e => set('codigo_grupo', e.target.value)}
                placeholder="Ej: 001" />
            </div>
            <div className="np-campo">
              <label className="np-label">Descripción grupo</label>
              <input className="np-input" value={form.descripcion_grupo}
                onChange={e => set('descripcion_grupo', e.target.value)}
                placeholder="Ej: Iluminación LED" />
            </div>
            <div className="np-campo">
              <label className="np-label">Código subgrupo</label>
              <input className="np-input" value={form.codigo_subgrupo}
                onChange={e => set('codigo_subgrupo', e.target.value)}
                placeholder="Ej: 001" />
            </div>
            <div className="np-campo">
              <label className="np-label">Descripción subgrupo</label>
              <input className="np-input" value={form.descripcion_subgrupo}
                onChange={e => set('descripcion_subgrupo', e.target.value)}
                placeholder="Ej: Tubos LED" />
            </div>
          </div>
        </section>

        {/* ── Dimensiones ── */}
        <section className="np-seccion">
          <h2 className="np-seccion-titulo">Dimensiones y peso</h2>
          <div className="np-grid4">
            <div className="np-campo">
              <label className="np-label">Alto (cm) <span className="np-req">*</span></label>
              <input className="np-input" type="number" min="0" step="0.1" required
                value={form.alto_cm} onChange={e => set('alto_cm', e.target.value)} />
            </div>
            <div className="np-campo">
              <label className="np-label">Ancho (cm) <span className="np-req">*</span></label>
              <input className="np-input" type="number" min="0" step="0.1" required
                value={form.ancho_cm} onChange={e => set('ancho_cm', e.target.value)} />
            </div>
            <div className="np-campo">
              <label className="np-label">Largo (cm) <span className="np-req">*</span></label>
              <input className="np-input" type="number" min="0" step="0.1" required
                value={form.largo_cm} onChange={e => set('largo_cm', e.target.value)} />
            </div>
            <div className="np-campo">
              <label className="np-label">Peso (kg) <span className="np-req">*</span></label>
              <input className="np-input" type="number" min="0" step="0.001" required
                value={form.peso_kg} onChange={e => set('peso_kg', e.target.value)} />
            </div>
          </div>
        </section>

        {error && <p className="np-error">{error}</p>}
        {exito && <p className="np-exito">Producto creado exitosamente.</p>}

        <div className="np-acciones">
          <button type="button" className="np-btn-cancelar" onClick={() => navigate('/productos')}>
            Cancelar
          </button>
          <button type="submit" className="np-btn-guardar" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  )
}
