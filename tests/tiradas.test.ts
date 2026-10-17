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

describe('dados justos y límites', () => {
  it('tirarDado da todos los valores posibles y ninguno fuera de rango', async () => {
    const { tirarDado } = await import('../src/dados/tiradas')
    for (const c of [4, 6, 8, 10, 12, 20, 100]) {
      const vistos = new Set<number>()
      for (let i = 0; i < c * 60; i++) {
        const v = tirarDado(c)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(c)
        vistos.add(v)
      }
      expect(vistos.size).toBe(c)
    }
  })
  it('combina varios dados y tipos y rechaza tiradas absurdas', () => {
    const r = resolverTirada({ etiqueta: 'x', formula: '3d6+2d8-1d4+2' })
    expect(r.dados.map((d) => `${d.valores.length}d${d.caras}${d.signo === -1 ? '-' : ''}`)).toEqual(['3d6', '2d8', '1d4-'])
    const suma = r.dados.reduce((s, d) => s + (d.signo === -1 ? -1 : 1) * d.valores.reduce((a, b) => a + b, 0), 0)
    expect(r.total).toBe(suma + 2)
    expect(formulaValida('101d6')).toBe(false)
    expect(formulaValida('60d6+50d4')).toBe(false)
  })
})
