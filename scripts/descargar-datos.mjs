// Descarga los datos de 5etools a .cache-5etools/ para los tests (no se suben al repo).
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ARCHIVOS, URL_BASE } from './fuentes-datos.mjs'

const dir = '.cache-5etools'
for (const a of ARCHIVOS) {
  const destino = join(dir, a)
  try { await access(destino); continue } catch { /* no existe */ }
  const r = await fetch(URL_BASE + a)
  if (!r.ok) throw new Error(`${a}: ${r.status}`)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, await r.text())
  console.log('descargado', a)
}
