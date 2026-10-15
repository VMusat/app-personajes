import { describe, it, expect } from 'vitest'
import { datosDePrueba } from './datos'
import { personajeVacio, type Personaje } from '../src/motor/personaje'
import { derivar } from '../src/motor/derivar'
import { autocompletar } from './util'

function crear(clase: string, nivel: number, base: Personaje['caracteristicas']['base'], extra: Record<string, string[]> = {}) {
  const d = datosDePrueba()
  const p = personajeVacio()
  p.especie = 'human|xphb'
  p.trasfondo = 'soldier|xphb'
  p.aspecto = 'Valor'
  p.caracteristicas.base = base
  Object.assign(p.elecciones, extra)
  for (let i = 0; i < nivel; i++) p.niveles.push({ clase })
  autocompletar(p, d)
  return { p, d }
}

describe('hoja derivada', () => {
  it('guerrero 5 con cota de malla y espada larga', () => {
    const { p, d } = crear('fighter|xphb', 5, { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, {
      'tra:aumento': ['str:2', 'con:1'],
      'cls:Fighter:1:fp:Fighting Style': ['defense|xphb'],
    })
    p.inventario.push(
      { id: 'a', origen: '5etools', ref: 'chain mail|xphb', nombre: 'Chain Mail', cantidad: 1, equipado: true },
      { id: 'b', origen: '5etools', ref: 'longsword|xphb', nombre: 'Longsword', cantidad: 1, equipado: true },
      { id: 'c', origen: '5etools', ref: 'shield|xphb', nombre: 'Shield', cantidad: 1, equipado: true },
    )
    const h = derivar(p, d)
    expect(h.pb).toBe(3)
    expect(h.car.str.valor).toBeGreaterThanOrEqual(17)
    expect(h.ca.valor).toBe(16 + 2 + 1) // cota + escudo + Defense
    const ls = h.ataques.find((a) => a.nombre === 'Longsword')!
    expect(ls.bonoAtaque).toBe(h.car.str.mod + 3)
    expect(ls.dano.startsWith('1d8')).toBe(true)
    expect(h.recursos.find((r) => r.nombre === 'Second Wind')?.max).toBe(3)
    expect(h.recursos.find((r) => r.nombre === 'Action Surge')?.max).toBe(1)
    // d10 al nivel 1 + 4 niveles de media (6) + 5 × CON
    expect(h.pgMax).toBe(10 + 4 * 6 + 5 * h.car.con.mod)
    expect(h.espacios).toEqual([])
  })

  it('bárbaro sin armadura usa Unarmored Defense y furias de la tabla', () => {
    const { p, d } = crear('barbarian|xphb', 3, { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 })
    const h = derivar(p, d)
    expect(h.ca.valor).toBe(10 + h.car.dex.mod + h.car.con.mod)
    expect(h.recursos.find((r) => r.nombre === 'Rage')?.max).toBe(3)
    expect(h.columnas.find((c) => c.etiqueta === 'Rage Damage')?.valor).toBe('2')
  })

  it('mago 5: espacios, CD y libro', () => {
    const { p, d } = crear('wizard|xphb', 5, { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, { 'tra:aumento': ['str:2', 'con:1'] })
    const h = derivar(p, d)
    expect(h.espacios).toEqual([4, 3, 2])
    const l = h.lanzamiento[0]
    expect(l.cd).toBe(8 + 3 + h.car.int.mod)
    expect(h.conjuros.filter((c) => c.conjuro.level === 0).length).toBeGreaterThanOrEqual(4)
    expect(h.conjuros.filter((c) => c.conjuro.level > 0 && c.preparado).length).toBeGreaterThanOrEqual(9)
  })

  it('brujo 5: magia de pacto', () => {
    const { p, d } = crear('warlock|xphb', 5, { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 })
    const h = derivar(p, d)
    expect(h.pacto).toEqual({ n: 2, nivel: 3 })
    expect(h.espacios).toEqual([])
  })

  it('paladín 2 + clérigo 3 (multiclase): espacios combinados', () => {
    const d = datosDePrueba()
    const p = personajeVacio()
    p.especie = 'human|xphb'; p.trasfondo = 'acolyte|xphb'; p.aspecto = 'Fe'
    p.caracteristicas.base = { str: 15, dex: 10, con: 13, int: 8, wis: 14, cha: 13 }
    p.niveles.push({ clase: 'paladin|xphb' }, { clase: 'paladin|xphb' }, { clase: 'cleric|xphb' }, { clase: 'cleric|xphb' }, { clase: 'cleric|xphb' })
    autocompletar(p, d)
    const h = derivar(p, d)
    // nivel de lanzador: 3 (clérigo) + 1 (paladín 2, mitad redondeando arriba) = 4
    expect(h.espacios).toEqual([4, 3])
    expect(h.lanzamiento.map((l) => l.clase).sort()).toEqual(['Cleric', 'Paladin'])
  })

  it('el objeto mágico de campaña aplica sus efectos al sintonizarlo', () => {
    const { p, d } = crear('rogue|xphb', 3, { str: 8, dex: 15, con: 14, int: 12, wis: 10, cha: 13 })
    const catalogo = [{
      id: 'anillo', nombre: 'Anillo de la Rueda', tipo: 'anillo' as const, rareza: 'rare' as const, sintonizacion: true, descripcion: '', actualizado: '',
      efectos: [
        { tipo: 'bono' as const, objetivo: 'ca' as const, valor: 1 },
        { tipo: 'bono' as const, objetivo: 'salvaciones' as const, valor: 1 },
        { tipo: 'conjuro' as const, conjuro: 'misty step|xphb', usos: 1, recarga: 'largo' as const },
        { tipo: 'resistencia' as const, valor: 'psychic' },
      ],
      cargas: { max: 3, recarga: 'amanecer' as const },
    }]
    const sin = derivar(p, d, catalogo)
    p.inventario.push({ id: 'x', origen: 'campaña', ref: 'anillo', nombre: 'Anillo de la Rueda', cantidad: 1 })
    expect(derivar(p, d, catalogo).ca.valor).toBe(sin.ca.valor) // sin sintonizar no hace nada
    p.inventario[0].sintonizado = true
    const con = derivar(p, d, catalogo)
    expect(con.ca.valor).toBe(sin.ca.valor + 1)
    expect(con.car.dex.salvacion).toBe(sin.car.dex.salvacion + 1)
    expect(con.conjuros.some((c) => c.conjuro.name === 'Misty Step' && c.usos === 1)).toBe(true)
    expect(con.resistencias).toContain('psychic')
    expect(con.recursos.some((r) => r.id === 'obj:x' && r.max === 3)).toBe(true)
    expect(con.sintonizados).toBe(1)
  })
})
