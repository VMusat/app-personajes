// «No se debe dejar nada atrás cuando haya una subida de nivel.»
// Este test sube a nivel 20 un personaje de cada subclase permitida y comprueba que:
//  1. todas las elecciones generadas se pueden completar;
//  2. todo rasgo cuyo texto habla de elegir algo está cubierto por datos estructurados o por la tabla manual.
import { describe, it, expect } from 'vitest'
import { datosDePrueba } from './datos'
import { personajeVacio } from '../src/motor/personaje'
import { resolver } from '../src/motor/resolver'
import { autocompletar } from './util'
import { RASGOS_MANUALES, claveManual } from '../src/motor/rasgosManuales'
import { claveRasgoClase, claveRasgoSubclase } from '../src/datos/refs'
import type { Datos, Rasgo } from '../src/datos/tipos'

const REGEX_ELECCION = /of your choice|you choose|choose (one|two|three|a|an)\b|you learn|gain proficiency|Expertise|languages? of your|resistance to one/i

function rasgosAlcanzables(d: Datos): { r: Rasgo; clase: string }[] {
  const res: { r: Rasgo; clase: string }[] = []
  const vistos = new Set<string>()
  const visitar = (r: Rasgo | undefined, clase: string) => {
    if (!r || vistos.has(r._ref)) return
    vistos.add(r._ref)
    res.push({ r, clase })
    const s = JSON.stringify(r.entries)
    for (const m of s.matchAll(/"subclassFeature":"([^"]+)"/g)) visitar(d.rasgos[claveRasgoSubclase(m[1])], clase)
    for (const m of s.matchAll(/"classFeature":"([^"]+)"/g)) visitar(d.rasgos[claveRasgoClase(m[1])], clase)
  }
  for (const c of d.clases) {
    for (const cf of c.classFeatures) visitar(d.rasgos[claveRasgoClase(typeof cf === 'string' ? cf : cf.classFeature)], c.name)
    for (const s of d.subclases.filter((s) => s.className === c.name)) for (const sf of s.subclassFeatures) visitar(d.rasgos[claveRasgoSubclase(sf)], c.name)
  }
  return res
}

describe('cobertura de rasgos', () => {
  const d = datosDePrueba()

  it('todo rasgo con elecciones en el texto está cubierto', () => {
    const sinCubrir: string[] = []
    for (const { r } of rasgosAlcanzables(d)) {
      const texto = JSON.stringify(r.entries).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
      if (!REGEX_ELECCION.test(texto)) continue
      if (RASGOS_MANUALES[claveManual(r)]) continue
      if (/"type":"options"/.test(JSON.stringify(r.entries))) continue
      // Rasgos introductorios de subclase (solo enlazan sub-rasgos)
      if (r.entries.every((e) => typeof e === 'string' || (e as { type?: string }).type === 'refSubclassFeature')) {
        if (!REGEX_ELECCION.test(JSON.stringify(r.entries.filter((e) => typeof e === 'string')))) continue
      }
      sinCubrir.push(claveManual(r))
    }
    expect(sinCubrir).toEqual([])
  })

  it('las claves de la tabla manual existen en los datos', () => {
    const claves = new Set(rasgosAlcanzables(d).map(({ r }) => claveManual(r)))
    const huérfanas = Object.keys(RASGOS_MANUALES).filter((k) => !claves.has(k) && !/\|(Ability Score Improvement|Epic Boon|Spellcasting|\w+ Subclass)$/.test(k))
    expect(huérfanas).toEqual([])
  })

  for (const sub of d.subclases) {
    it(`${sub.className} / ${sub.shortName}: del 1 al 20 sin elecciones imposibles`, () => {
      const c = d.clases.find((x) => x.name === sub.className)!
      const p = personajeVacio()
      p.especie = 'human|xphb'
      p.trasfondo = 'sage|xphb'
      p.aspecto = 'Camino'
      p.caracteristicas.base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
      for (let nivel = 1; nivel <= 20; nivel++) {
        p.niveles.push({ clase: c._clave })
        const pendientes = autocompletar(p, d, { [`cls:${c.name}:sub`]: sub._clave })
        expect(pendientes.map((e) => `${nivel}: ${e.id} (${e.etiqueta}) ${e.opciones.length} opciones`)).toEqual([])
      }
      const r = resolver(p, d)
      const ids = r.elecciones.map((e) => e.id)
      expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([])
      expect(r.clases[0].subclase?._clave).toBe(sub._clave)
      // Todos los rasgos de subclase hasta el 20 están en la hoja
      const refs = sub.subclassFeatures.map((sf) => d.rasgos[claveRasgoSubclase(sf)]?._ref).filter(Boolean)
      for (const ref of refs) expect(r.rasgos.some((x) => x.ref === ref)).toBe(true)
    })
  }
})
