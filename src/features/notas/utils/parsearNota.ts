import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

export type LineaNota = {
  cantidad:       number
  codigoProducto: string
  descripcion:    string
}

export type ResultadoParseoNota = {
  numeroNota:     string | null
  nombreCliente:  string | null
  rutCliente:     string | null
  numeroOc:       string | null
  productos:      LineaNota[]
  errores:        string[]
  _textoDebug?:   string  // texto crudo del PDF para diagnóstico
}

const REGEX_NV       = /N[°º]\s*de\s*NV[:\s]*(\d+)/i
const REGEX_CLIENTE  = /Nombre[:\s]+(.+?)(?:R\.U\.T|$)/im
const REGEX_RUT      = /R\.U\.T\.?[:\s]*([\d.\-kK]+)/i
const REGEX_OC       = /N[°º]\s*OC[:\s]*(\d+)/i

// Formato Grantt: "100. AG/PR6003 Descripcion 174 17,400"
// Acepta: AG/PR6003 (barra), HX-MVC2P10A-N (guión), 09631 (numérico 4-8 dígitos)
// Los precios finales actúan como delimitador de la descripción (no se capturan)
const REGEX_PRODUCTO = /(\d+)\.\s+([A-Z]{1,5}(?:[\/\-][A-Z0-9][A-Z0-9\-]*|\d+[A-Z0-9\-]*)|\d{4,8})\s+(.+?)\s+[\d,\.]+\s+[\d,\.]+(?=\s|$)/g

const INICIO_TABLA = /Cantidad\s+Codi[gó]o\s+Descripci[oó]n/i
const FIN_TABLA    = /Condici[oó]n de Pago|Total\s+IVA|Sub\s+Total/i

export async function parsearNota(file: File): Promise<ResultadoParseoNota> {
  const errores: string[] = []

  const buffer = await file.arrayBuffer()
  const uint8  = new Uint8Array(buffer)

  let texto = ''
  try {
    const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise
    const todosItems: { str: string; x: number; y: number; page: number }[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        // transform[4] = x, transform[5] = y
        todosItems.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5], page: i })
      }
    }
    // Ordenar por página → y descendente (arriba primero) → x ascendente (izquierda primero)
    // Esto reconstruye el orden visual de lectura aunque el PDF sea columnar
    todosItems.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
    texto = todosItems.map((it) => it.str).join(' ')
  } catch {
    errores.push('No se pudo leer el PDF. Verifica que el archivo no esté dañado.')
    return { numeroNota: null, nombreCliente: null, rutCliente: null, numeroOc: null, productos: [], errores }
  }

  const matchNv = texto.match(REGEX_NV)
  const numeroNota = matchNv ? matchNv[1] : null
  if (!numeroNota) errores.push('No se encontró el número de NV. Ingrésalo manualmente.')

  const matchCliente = texto.match(REGEX_CLIENTE)
  const nombreCliente = matchCliente ? matchCliente[1].trim() : null
  if (!nombreCliente) errores.push('No se encontró el nombre del cliente. Ingrésalo manualmente.')

  const matchRut = texto.match(REGEX_RUT)
  const rutCliente = matchRut ? matchRut[1].trim() : null
  if (!rutCliente) errores.push('No se encontró el RUT del cliente. Ingrésalo manualmente.')

  const matchOc = texto.match(REGEX_OC)
  const numeroOc = matchOc ? matchOc[1] : null

  // Acotar al cuerpo de la tabla de productos
  const inicioMatch = INICIO_TABLA.exec(texto)
  const finMatch    = FIN_TABLA.exec(texto)
  const cuerpo = inicioMatch
    ? texto.slice(inicioMatch.index + inicioMatch[0].length, finMatch ? finMatch.index : undefined)
    : texto

  const productos: LineaNota[] = []
  const vistos = new Set<string>()
  let match: RegExpExecArray | null

  REGEX_PRODUCTO.lastIndex = 0
  while ((match = REGEX_PRODUCTO.exec(cuerpo)) !== null) {
    const cantidad       = parseInt(match[1], 10)
    const codigoProducto = match[2].trim()
    const descripcion    = match[3].trim()

    const clave = `${codigoProducto}-${cantidad}`
    if (vistos.has(clave)) continue
    vistos.add(clave)

    if (cantidad > 0) productos.push({ cantidad, codigoProducto, descripcion })
  }

  if (productos.length === 0) {
    errores.push('No se encontraron productos. Revisa el formato del PDF.')
  }

  return { numeroNota, nombreCliente, rutCliente, numeroOc, productos, errores, _textoDebug: texto }
}
