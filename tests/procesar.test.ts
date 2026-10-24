import { describe, it, expect } from 'vitest'
import { datosDePrueba } from './datos'

describe('datos procesados', () => {
  const d = datosDePrueba()
  it('tiene las 13 clases y sus subclases del setting', () => {
    expect(d.clases.map((c) => c.name).sort()).toHaveLength(13)
    expect(d.subclases.length).toBe(69)
    for (const s of d.subclases) for (const ref of s.subclassFeatures) expect(Object.keys(d.rasgos).length).toBeGreaterThan(0) && ref
  })
  it('tiene las 15 especies y el trasfondo propio', () => {
    expect(d.especies).toHaveLength(15)
    expect(d.trasfondos.find((t) => t.name === 'Superviviente de la miasma')).toBeTruthy()
  })
  it('genera las marcas de los 22 aspectos', () => {
    const manif = d.dotes.filter((f) => f._marca?.tipo === 'manifiesta' && !f._marca.invertida)
    const plenas = d.dotes.filter((f) => f._marca?.tipo === 'plena' && !f._marca.invertida)
    const inv = d.dotes.filter((f) => f._marca?.invertida && f._marca.tipo === 'manifiesta')
    expect(manif).toHaveLength(22)
    expect(plenas).toHaveLength(22)
    expect(inv).toHaveLength(22)
    expect(d.dotes.some((f) => /^(Greater )?Mark of/.test(f.name))).toBe(false)
    expect(d.dotes.find((f) => f.name === 'Eco del Divino')).toBeTruthy()
  })
  it('asigna listas de clase a los conjuros', () => {
    const fb = d.conjuros.find((c) => c.name === 'Fireball')!
    expect(fb._clases).toEqual(expect.arrayContaining(['Wizard', 'Sorcerer']))
    const cure = d.conjuros.find((c) => c.name === 'Cure Wounds')!
    expect(cure._clases).toEqual(expect.arrayContaining(['Artificer', 'Cleric']))
  })
  it('todas las referencias a conjuros de las marcas existen', () => {
    const nombres = new Set(d.conjuros.map((c) => c._clave))
    const refs: string[] = []
    for (const f of d.dotes.filter((f) => f.source === 'SETTING')) {
      JSON.stringify(f.additionalSpells ?? []).replace(/"([a-z' ]+)\|xphb(#c)?"/g, (_, n) => (refs.push(`${n}|xphb`), ''))
    }
    expect(refs.filter((r) => !nombres.has(r))).toEqual([])
  })
  it('todos los rasgos referenciados por clases y subclases existen', () => {
    const faltan: string[] = []
    for (const c of d.clases) for (const r of c.classFeatures) {
      const ref = typeof r === 'string' ? r : r.classFeature
      const k = `cf|${ref}`.toLowerCase().split('|')
      const key = ['cf', k[1], k[2], k[3], k[4], k[5] || k[3]].join('|')
      if (!d.rasgos[key]) faltan.push(key)
    }
    expect(faltan).toEqual([])
  })
})

describe('equipo inicial', () => {
  it('el oro se corrige con el texto del libro (opción A del clérigo: 7 GP)', () => {
    const d = datosDePrueba()
    const cl = d.clases.find((c) => c.name === 'Cleric')!
    expect(cl.startingEquipment.defaultData[0].A.at(-1).value).toBe(700)
    expect(cl.startingEquipment.defaultData[0].B.at(-1).value).toBe(11000)
  })
})
