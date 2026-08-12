import * as XLSX from 'xlsx'

export type FilaExcelPicking = {
  codigo:         string
  descripcion:    string
  cantidadPedida: number
}

export type ResultadoParseoPicking = {
  filas:   FilaExcelPicking[]
  errores: string[]
}

type Celda = string | number | boolean | null

const ALIAS_CODIGO      = ['codigo', 'sku', 'cod']
const ALIAS_DESCRIPCION = ['descripcion', 'producto', 'nombre', 'detalle']
const ALIAS_CANTIDAD    = ['cantidad', 'cantidad pedida', 'cant', 'qty']

function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function encontrarColumna(encabezados: string[], alias: string[]): number {
  return encabezados.findIndex((h) => alias.includes(normalizar(h)))
}

export async function parsearExcelPicking(file: File): Promise<ResultadoParseoPicking> {
  const errores: string[] = []
  const buffer = await file.arrayBuffer()
  const wb     = XLSX.read(buffer, { type: 'array' })
  const ws     = wb.Sheets[wb.SheetNames[0]]
  const data   = XLSX.utils.sheet_to_json<Celda[]>(ws, { header: 1, defval: null })

  const primeraFila = data.find((f) => f.some((c) => c !== null && c !== ''))
  if (!primeraFila) {
    errores.push('El archivo está vacío')
    return { filas: [], errores }
  }

  const encabezados = primeraFila.map((c) => String(c ?? '').trim())
  const filasDatos  = data
    .slice(data.indexOf(primeraFila) + 1)
    .filter((f) => f.some((c) => c !== null && c !== ''))

  const idxCodigo      = encontrarColumna(encabezados, ALIAS_CODIGO)
  const idxDescripcion = encontrarColumna(encabezados, ALIAS_DESCRIPCION)
  const idxCantidad    = encontrarColumna(encabezados, ALIAS_CANTIDAD)

  if (idxCodigo === -1 || idxDescripcion === -1 || idxCantidad === -1) {
    errores.push('No se encontraron las columnas código / descripción / cantidad en el archivo')
    return { filas: [], errores }
  }

  const filas: FilaExcelPicking[] = []
  for (const fila of filasDatos) {
    const codigo      = String(fila[idxCodigo] ?? '').trim()
    const descripcion = String(fila[idxDescripcion] ?? '').trim()
    const cantidad     = Number(fila[idxCantidad])
    if (!codigo || !Number.isFinite(cantidad) || cantidad <= 0) continue
    filas.push({ codigo, descripcion, cantidadPedida: Math.round(cantidad) })
  }

  if (filas.length === 0) errores.push('No se encontraron filas válidas en el archivo')

  return { filas, errores }
}
