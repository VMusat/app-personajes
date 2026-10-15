// Carga los datos de 5etools desde .cache-5etools/ (npm run datos) para los tests.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ARCHIVOS_5ETOOLS } from '../src/datos/fuentes'
import { construirDatos } from '../src/datos/procesar'
import type { Datos } from '../src/datos/tipos'

let cache: Datos | undefined
export function datosDePrueba(): Datos {
  if (cache) return cache
  const crudos: Record<string, unknown> = {}
  for (const a of ARCHIVOS_5ETOOLS) {
    const f = join('.cache-5etools', a)
    if (!existsSync(f)) throw new Error(`Falta ${f}: ejecuta «npm run datos»`)
    crudos[a] = JSON.parse(readFileSync(f, 'utf8'))
  }
  cache = construirDatos(crudos as never)
  return cache
}
