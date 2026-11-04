// Familiares, invocaciones, compañeros y formas: plantillas genéricas y sugerencias según lo que tiene el PJ.
// Cómo entran en combate (reglas de 2024):
//  - propia: tira su propia iniciativa (Find Familiar, Wild Companion).
//  - tras: comparte la del PJ y actúa justo después (conjuros Summon, Steel Defender).
//  - turno: actúa dentro del turno del PJ y no tiene turno propio (Primal Companion, Eldritch Cannon).
import type { Hoja } from './derivar'
import type { Aliado, ModoIniciativa } from './personaje'

export const MODO_INICIATIVA: Record<ModoIniciativa, string> = {
  propia: 'Tira su propia iniciativa',
  tras: 'Actúa justo después del PJ',
  turno: 'Actúa dentro del turno del PJ',
}

export const TIPO_ALIADO: Record<Aliado['tipo'], string> = {
  familiar: 'Familiar',
  invocacion: 'Invocación',
  compañero: 'Compañero',
  objeto: 'Objeto animado',
  otro: 'Otro',
}

export type PlantillaAliado = Omit<Aliado, 'id'>

/** Plantillas genéricas: el jugador completa los valores de la ficha de la criatura. */
export const PLANTILLAS: { texto: string; aliado: PlantillaAliado }[] = [
  { texto: 'Familiar', aliado: { nombre: 'Familiar', tipo: 'familiar', iniciativa: 'propia', bonoIniciativa: 2, pg: 1, pgMax: 1, ca: 12 } },
  { texto: 'Invocación (Summon…)', aliado: { nombre: 'Invocación', tipo: 'invocacion', iniciativa: 'tras', pg: 10, pgMax: 10, ca: 12 } },
  { texto: 'Compañero que actúa en tu turno', aliado: { nombre: 'Compañero', tipo: 'compañero', iniciativa: 'turno', pg: 10, pgMax: 10, ca: 13 } },
  { texto: 'Otro', aliado: { nombre: '', tipo: 'otro', iniciativa: 'propia', bonoIniciativa: 0, pg: 1, pgMax: 1, ca: 10 } },
]

export interface Sugerencia {
  texto: string
  detalle: string
  aliado?: PlantillaAliado
  /** Para las transformaciones: nombre de la forma y PG temporales que da. */
  forma?: { pgTemporales: number }
}

const nivelDe = (h: Hoja, clase: string) => h.resolucion.clases.find((c) => c.clase.name === clase)?.nivel ?? 0
const tieneRasgo = (h: Hoja, nombre: string) => h.rasgos.some((r) => r.nombre === nombre)
const tieneConjuro = (h: Hoja, f: (n: string) => boolean) => h.conjuros.some((c) => f(c.conjuro.name))

/** Lo que este PJ puede convocar o adoptar según sus rasgos y conjuros. */
export function sugerencias(h: Hoja): Sugerencia[] {
  const out: Sugerencia[] = []
  const druida = nivelDe(h, 'Druid')
  const artificiero = nivelDe(h, 'Artificer')
  if (tieneRasgo(h, 'Wild Shape'))
    out.push({ texto: 'Wild Shape', detalle: `Te transformas en una bestia. Ganas ${druida} PG temporales y usas su AC y su Speed.`, forma: { pgTemporales: druida } })
  if (tieneRasgo(h, 'Wild Companion'))
    out.push({ texto: 'Wild Companion', detalle: 'Find Familiar gastando un uso de Wild Shape. Es un feérico y tira su propia iniciativa.', aliado: { nombre: 'Familiar', tipo: 'familiar', iniciativa: 'propia', bonoIniciativa: 2, pg: 1, pgMax: 1, ca: 12 } })
  else if (tieneConjuro(h, (n) => n === 'Find Familiar'))
    out.push({ texto: 'Find Familiar', detalle: 'Tira su propia iniciativa y actúa en su turno.', aliado: { nombre: 'Familiar', tipo: 'familiar', iniciativa: 'propia', bonoIniciativa: 2, pg: 1, pgMax: 1, ca: 12 } })
  if (tieneRasgo(h, 'Eldritch Cannon'))
    out.push({ texto: 'Eldritch Cannon', detalle: `AC 18 y ${5 * artificiero} PG. Lo activas con una acción adicional, dentro de tu turno.`, aliado: { nombre: 'Eldritch Cannon', tipo: 'objeto', iniciativa: 'turno', pg: 5 * artificiero, pgMax: 5 * artificiero, ca: 18 } })
  if (tieneRasgo(h, 'Steel Defender'))
    out.push({ texto: 'Steel Defender', detalle: 'Comparte tu iniciativa y actúa justo después de ti. Completa sus valores con su ficha.', aliado: { nombre: 'Steel Defender', tipo: 'compañero', iniciativa: 'tras', pg: 10, pgMax: 10, ca: 15 } })
  if (tieneRasgo(h, 'Primal Companion'))
    out.push({ texto: 'Primal Companion', detalle: 'Actúa dentro de tu turno. Completa sus valores con su ficha.', aliado: { nombre: 'Compañero primigenio', tipo: 'compañero', iniciativa: 'turno', pg: 10, pgMax: 10, ca: 13 } })
  for (const c of h.conjuros.filter((c) => /^Summon /.test(c.conjuro.name)))
    out.push({ texto: c.conjuro.name, detalle: 'Comparte tu iniciativa y actúa justo después de ti.', aliado: { nombre: c.conjuro.name.replace(/^Summon /, ''), tipo: 'invocacion', iniciativa: 'tras', pg: 10, pgMax: 10, ca: 12 } })
  return out
}
