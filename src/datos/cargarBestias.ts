// Bestias para Wild Shape: se descargan de 5etools solo la primera vez que alguien se transforma,
// y se guardan ya procesadas en IndexedDB (son poco más de 80 fichas).
import { get, set } from 'idb-keyval'
import { BESTIARIOS_5ETOOLS, URL_BASE_5ETOOLS, VERSION_5ETOOLS } from './fuentes'
import { procesarBestias, type Bestia } from '../motor/formas'
import setting from '../setting/formas.json'

// Cambia si cambian los datos del setting (nombres, exclusiones)
const CLAVE = `bestias-${VERSION_5ETOOLS}-${JSON.stringify(setting).length}`
let enCurso: Promise<Bestia[]> | undefined

export function cargarBestias(): Promise<Bestia[]> {
  enCurso ??= (async () => {
    try {
      const cache = await get<Bestia[]>(CLAVE)
      if (cache) return cache
    } catch {
      // sin IndexedDB
    }
    const archivos = await Promise.all(
      BESTIARIOS_5ETOOLS.map(async (a) => {
        const r = await fetch(URL_BASE_5ETOOLS + a)
        if (!r.ok) throw new Error(`No se pudo descargar ${a} (${r.status})`)
        return r.json()
      }),
    )
    const bestias = procesarBestias(archivos)
    try {
      await set(CLAVE, bestias)
    } catch {
      // sin caché
    }
    return bestias
  })().catch((e) => {
    enCurso = undefined
    throw e
  })
  return enCurso
}
