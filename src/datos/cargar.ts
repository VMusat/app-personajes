// Descarga los datos de 5etools en el navegador y los guarda procesados en IndexedDB.
import { get, set, keys, del } from 'idb-keyval'
import { ARCHIVOS_5ETOOLS, URL_BASE_5ETOOLS } from './fuentes'
import { construirDatos, VERSION_DATOS } from './procesar'
import type { Crudo, Datos } from './tipos'

const CLAVE = `datos-${VERSION_DATOS}`

export async function cargarDatos(progreso?: (hechos: number, total: number) => void): Promise<Datos> {
  try {
    const cache = await get<Datos>(CLAVE)
    if (cache) return cache
  } catch {
    // IndexedDB no disponible (ventana privada): se descarga sin caché
  }
  let hechos = 0
  const crudos: Record<string, Crudo> = {}
  await Promise.all(
    ARCHIVOS_5ETOOLS.map(async (a) => {
      const r = await fetch(URL_BASE_5ETOOLS + a)
      if (!r.ok) throw new Error(`No se pudo descargar ${a} (${r.status})`)
      crudos[a] = await r.json()
      progreso?.(++hechos, ARCHIVOS_5ETOOLS.length)
    }),
  )
  const datos = construirDatos(crudos)
  try {
    for (const k of await keys()) if (String(k).startsWith('datos-') && k !== CLAVE) await del(k)
    await set(CLAVE, datos)
  } catch {
    // sin caché
  }
  return datos
}
