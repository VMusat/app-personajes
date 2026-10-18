// Copia la Guía para aventureros desde la bóveda de Obsidian (carpeta hermana «Campaign») a la app:
// la nota va a src/setting/guia.md y las imágenes que incrusta (![[...]]) a public/guia/.
// Se ejecuta solo antes de «npm run dev» y «npm run build». Si la bóveda no está (por ejemplo, en GitHub Actions),
// no hace nada y se usan los archivos ya copiados en el repositorio.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BOVEDA = path.resolve(RAIZ, '..', 'Campaign')
const NOTA = path.join(BOVEDA, 'Lore', 'Guía para aventureros de los Reinos de la Miasma.md')
const DESTINO_NOTA = path.join(RAIZ, 'src', 'setting', 'guia.md')
const DESTINO_IMAGENES = path.join(RAIZ, 'public', 'guia')

if (!fs.existsSync(NOTA)) {
  console.log('copiar-guia: no encuentro la nota en la bóveda; uso la copia del repositorio.')
  process.exit(0)
}

const texto = fs.readFileSync(NOTA, 'utf8').replace(/\r\n/g, '\n')
fs.writeFileSync(DESTINO_NOTA, texto)

// Busca un archivo por nombre en la bóveda (como hace Obsidian con los enlaces)
function buscar(nombre, dir = BOVEDA) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      const r = buscar(nombre, p)
      if (r) return r
    } else if (e.name === nombre) return p
  }
  return null
}

fs.rmSync(DESTINO_IMAGENES, { recursive: true, force: true })
fs.mkdirSync(DESTINO_IMAGENES, { recursive: true })
const sinComentarios = texto.replace(/%%[\s\S]*?%%/g, '')
const incrustados = [...sinComentarios.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim())
for (const nombre of new Set(incrustados)) {
  const origen = buscar(nombre)
  if (!origen) {
    console.warn(`copiar-guia: no encuentro «${nombre}» en la bóveda.`)
    continue
  }
  let datos = fs.readFileSync(origen)
  if (nombre.endsWith('.svg')) {
    // Las notas para el DM que llevan algunas láminas («Propuesta: …») no se publican
    datos = datos.toString('utf8').replace(/<text[^>]*>Propuesta:[^<]*<\/text>/g, '')
  }
  fs.writeFileSync(path.join(DESTINO_IMAGENES, nombre), datos)
}
console.log(`copiar-guia: guía copiada con ${new Set(incrustados).size} imágenes.`)
