import { describe, it, expect } from 'vitest'
import { datosDePrueba } from './datos'
import { personajeVacio } from '../src/motor/personaje'
import { resolver } from '../src/motor/resolver'
import { derivar } from '../src/motor/derivar'
import { autocompletar } from './util'

function pj(trasfondo: string, aspecto: string, nivel: number) {
  const d = datosDePrueba()
  const p = personajeVacio()
  p.especie = 'human|xphb'
  p.trasfondo = trasfondo
  p.aspecto = aspecto
  p.caracteristicas.base = { str: 10, dex: 14, con: 14, int: 15, wis: 12, cha: 8 }
  for (let i = 0; i < nivel; i++) p.niveles.push({ clase: 'wizard|xphb' })
  autocompletar(p, d, { 'cls:Wizard:sub': 'evoker|xphb' })
  return { p, d, r: resolver(p, d) }
}
const marcas = (r: ReturnType<typeof resolver>) => r.dotes.filter((f) => f._marca).map((f) => f.name)

describe('marcas de aspecto', () => {
  const d = datosDePrueba()

  it('todas las marcas siguen la misma plantilla', () => {
    for (const f of d.dotes.filter((x) => x._marca)) {
      const secciones = (f.entries as { name?: string }[]).filter((e) => typeof e === 'object').map((e) => e.name)
      if (f._marca.invertida) expect(secciones[0]).toMatch(/Fortaleza|Aumento/)
      else if (f._marca.tipo === 'manifiesta') {
        expect(secciones[0]).toBe('Intuición de la marca')
        expect(secciones).toContain('Magia de la marca')
        expect(secciones.at(-1)).toBe('Conjuros de la marca')
      } else expect(secciones.slice(0, 2)).toEqual(['Aumento de característica', 'Intuición mejorada'])
      // Nada de textos de Eberron
      expect(JSON.stringify(f)).not.toMatch(/Dragonmark|Mark of |Siberys|House /)
    }
  })

  it('la marca despierta sola al llegar a nivel 4, no antes', () => {
    expect(marcas(pj('sage|xphb', 'Valor', 3).r)).toEqual([])
    expect(marcas(pj('sage|xphb', 'Valor', 4).r)).toEqual(['Marca manifiesta (Valor)'])
  })

  it('quien ya tenía la marca obtiene la marca plena a nivel 4', () => {
    expect(marcas(pj('superviviente de la miasma|setting', 'Fortuna', 3).r)).toEqual(['Marca manifiesta (Fortuna)'])
    expect(marcas(pj('superviviente de la miasma|setting', 'Fortuna', 4).r)).toEqual(['Marca manifiesta (Fortuna)', 'Marca plena (Fortuna)'])
  })

  it('la marca plena de las marcas propias permite lanzar el conjuro PB veces', () => {
    const { p, d: dd } = pj('marcado manifiesto|setting', 'Amor', 5)
    const h = derivar(p, dd)
    const heroism = h.conjuros.find((c) => c.conjuro.name === 'Heroism')!
    expect(heroism.usos).toBe(h.pb)
  })

  it('Marcado manifiesto da la marca del aspecto; Marcado invertido, la invertida', () => {
    expect(marcas(pj('marcado manifiesto|setting', 'Ingenio', 1).r)).toEqual(['Marca manifiesta (Ingenio)'])
    expect(marcas(pj('marcado invertido|setting', 'Engaño', 1).r)).toEqual(['Marca invertida (Engaño)'])
    const conDerecho = pj('marcado invertido|setting', 'Ingenio', 1).r
    expect(marcas(conDerecho)).toEqual([])
    expect(conDerecho.elecciones.some((e) => e.tipo === 'texto' && /marca invertida/i.test(e.etiqueta))).toBe(true)
  })

  it('los trasfondos de las casas de Eberron no aparecen', () => {
    expect(d.trasfondos.some((t) => /^House |Aberrant Heir/.test(t.name))).toBe(false)
    expect(d.trasfondos.every((t) => t._setting)).toBe(true)
    expect(d.especies.every((e) => e._setting) && d.clases.every((c) => c._setting)).toBe(true)
  })
})

describe('idiomas', () => {
  it('la especie da su idioma y no se puede volver a elegir', () => {
    const d = datosDePrueba()
    const p = personajeVacio()
    p.especie = 'elf|xphb'
    const r = resolver(p, d)
    const idiomas = r.efectos.filter((e) => e.tipo === 'competencia' && e.categoria === 'idioma').map((e) => (e as { valor: string }).valor)
    expect(idiomas).toEqual(['Cerinés', 'Élfico'])
    const base = r.elecciones.find((e) => e.id === 'base:idiomas')!
    expect(base.opciones.find((o) => o.valor === 'Élfico')?.bloqueada).toMatch(/Ya lo conoces/)
    expect((base.meta!.conocidos as { nombre: string }[]).map((c) => c.nombre)).toEqual(['Cerinés', 'Élfico'])
  })
})
