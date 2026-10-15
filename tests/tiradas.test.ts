import { describe, it, expect } from 'vitest'
import { parsearFormula, resolverTirada, dadosALanzar, formulaValida } from '../src/dados/tiradas'
import { evaluar } from '../src/motor/formula'
import { costeCompra, sumar4d6 } from '../src/motor/personaje'

describe('tiradas', () => {
  it('parsea fórmulas', () => {
    expect(parsearFormula('2d6+1d4-1')).toEqual([
      { tipo: 'dados', n: 2, caras: 6, signo: 1 },
      { tipo: 'dados', n: 1, caras: 4, signo: 1 },
      { tipo: 'fijo', n: 1, caras: 0, signo: -1 },
    ])
    expect(formulaValida('d20+3')).toBe(true)
    expect(formulaValida('hola')).toBe(false)
  })
  it('usa los valores de la animación y aplica ventaja', () => {
    const p = { etiqueta: 'Ataque', formula: '1d20+5', d20: true, ventaja: 'ventaja' as const }
    expect(dadosALanzar(p)).toEqual(['2d20'])
    const r = resolverTirada(p, [[4, 17]])
    expect(r.total).toBe(22)
    expect(r.natural).toBe(17)
    expect(r.dados[0].descartados).toEqual([4])
    const d = resolverTirada({ ...p, ventaja: 'desventaja' }, [[4, 17]])
    expect(d.total).toBe(9)
  })
  it('crítico en daño duplica los dados', () => {
    const p = { etiqueta: 'Daño', formula: '1d8+3', critico: true }
    expect(dadosALanzar(p)).toEqual(['2d8'])
    expect(resolverTirada(p, [[5, 6]]).total).toBe(14)
  })
  it('detecta 20 y 1 naturales', () => {
    expect(resolverTirada({ etiqueta: 'x', formula: '1d20', d20: true }, [[20]]).critico).toBe(true)
    expect(resolverTirada({ etiqueta: 'x', formula: '1d20', d20: true }, [[1]]).pifia).toBe(true)
  })
})

describe('fórmulas y características', () => {
  it('evalúa fórmulas con variables y funciones', () => {
    const vars = (n: string) => ({ pb: 3, wis: 2, 'nivel:Paladin': 4 } as Record<string, number>)[n] ?? 0
    expect(evaluar('max(1,wis)', vars)).toBe(2)
    expect(evaluar('5*nivel:Paladin', vars)).toBe(20)
    expect(evaluar('escala(nivel:Paladin,3,4,7,5)', vars)).toBe(4)
    expect(evaluar('10+pb*2', vars)).toBe(16)
  })
  it('compra de puntos y 4d6', () => {
    expect(costeCompra({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })).toBe(27)
    expect(sumar4d6([1, 6, 6, 5])).toBe(17)
  })
})
