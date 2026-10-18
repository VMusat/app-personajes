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

  it('Bladesong: +INT a la AC, +10 ft y ataques con INT; no funciona con armadura', () => {
    const { p, d } = crear('wizard|xphb', 3, { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 }, { 'cls:Wizard:sub': ['bladesinger|frhof'], 'tra:aumento': ['str:2', 'con:1'] })
    p.inventario.push({ id: 'r', origen: '5etools', ref: 'rapier|xphb', nombre: 'Rapier', cantidad: 1, equipado: true })
    const sin = derivar(p, d)
    expect(sin.activables.map((a) => a.nombre)).toContain('Bladesong')
    expect(sin.ca.valor).toBe(12)
    expect(sin.ataques.find((a) => a.nombre === 'Rapier')!.bonoAtaque).toBe(2 + 2)
    p.estado.activos = ['Bladesong']
    const con = derivar(p, d)
    expect(con.ca.valor).toBe(12 + 3)
    expect(con.velocidad.andar).toBe(40)
    const rapier = con.ataques.find((a) => a.nombre === 'Rapier')!
    expect(rapier.bonoAtaque).toBe(3 + 2)
    expect(rapier.dano).toBe('1d8+3')
    p.inventario.push({ id: 'a', origen: '5etools', ref: 'leather armor|xphb', nombre: 'Leather Armor', cantidad: 1, equipado: true })
    const armado = derivar(p, d)
    expect(armado.activables.find((a) => a.nombre === 'Bladesong')!.bloqueado).toBeTruthy()
    expect(armado.velocidad.andar).toBe(30)
  })

  it('Mage Armor preparado: AC 13 + DEX al activarlo, con los demás bonos', () => {
    const { p, d } = crear('wizard|xphb', 1, { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, { 'tra:aumento': ['str:2', 'con:1'] })
    p.elecciones['cls:Wizard:libro'] = [...p.elecciones['cls:Wizard:libro'].slice(0, 5), 'mage armor|xphb']
    p.elecciones['cls:Wizard:preparados'] = ['mage armor|xphb', ...p.elecciones['cls:Wizard:libro'].slice(0, 3)]
    p.estado.activos = ['Mage Armor']
    const h = derivar(p, d)
    expect(h.ca.valor).toBe(13 + 2)
    p.estado.activos = ['Mage Armor', 'Shield']
    p.elecciones['cls:Wizard:preparados'] = ['mage armor|xphb', 'shield|xphb']
    p.elecciones['cls:Wizard:libro'] = [...p.elecciones['cls:Wizard:libro'].slice(0, 4), 'mage armor|xphb', 'shield|xphb']
    expect(derivar(p, d).ca.valor).toBe(13 + 2 + 5)
  })

  it('el mago copia conjuros al libro además de los de nivel y puede prepararlos', () => {
    const { p, d } = crear('wizard|xphb', 3, { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, { 'tra:aumento': ['str:2', 'con:1'] })
    const libro = p.elecciones['cls:Wizard:libro']
    const nuevo = d.conjuros.find((c) => c.level === 2 && c._clases.includes('Wizard') && !libro.includes(c._clave))!
    p.elecciones['cls:Wizard:libroCopiados'] = [nuevo._clave]
    const r = derivar(p, d).resolucion
    expect(r.elecciones.find((e) => e.id === 'cls:Wizard:libro')!.valor).toEqual(libro) // los de nivel no cambian
    expect(r.elecciones.find((e) => e.id === 'cls:Wizard:libro')!.opciones.find((o) => o.valor === nuevo._clave)?.bloqueada).toBeTruthy()
    const prep = r.elecciones.find((e) => e.id === 'cls:Wizard:preparados')!
    expect(prep.opciones.some((o) => o.valor === nuevo._clave)).toBe(true)
    expect(prep.cambia).toBe('largo')
    expect(derivar(p, d).conjuros.some((c) => c.conjuro._clave === nuevo._clave)).toBe(true)
  })

  it('Rage suma Rage Damage a los ataques con STR', () => {
    const { p, d } = crear('barbarian|xphb', 3, { str: 16, dex: 14, con: 15, int: 8, wis: 10, cha: 8 })
    p.inventario.push({ id: 'g', origen: '5etools', ref: 'greataxe|xphb', nombre: 'Greataxe', cantidad: 1, equipado: true })
    const fuerza = derivar(p, d).car.str.mod
    expect(derivar(p, d).ataques.find((a) => a.nombre === 'Greataxe')!.dano).toBe(`1d12+${fuerza}`)
    p.estado.activos = ['Rage']
    const h = derivar(p, d)
    expect(h.ataques.find((a) => a.nombre === 'Greataxe')!.dano).toBe(`1d12+${fuerza + 2}`)
    expect(h.resistencias).toEqual(expect.arrayContaining(['bludgeoning', 'piercing', 'slashing']))
  })

  it('Speed de monje, explorador y especies', () => {
    expect(derivar(...Object.values(crear('monk|xphb', 2, { str: 10, dex: 15, con: 13, int: 8, wis: 14, cha: 10 })) as [never, never]).velocidad.andar).toBe(40)
    const exp = derivar(...Object.values(crear('ranger|xphb', 6, { str: 10, dex: 15, con: 13, int: 8, wis: 14, cha: 10 })) as [never, never])
    expect(exp.velocidad).toMatchObject({ andar: 40, trepar: 40, nado: 40 })
  })

  it('Martial Arts: el monje ataca con DEX y su dado con armas de monje', () => {
    const { p, d } = crear('monk|xphb', 5, { str: 10, dex: 16, con: 13, int: 8, wis: 14, cha: 10 })
    p.inventario.push({ id: 'q', origen: '5etools', ref: 'quarterstaff|xphb', nombre: 'Quarterstaff', cantidad: 1, equipado: true })
    const q = derivar(p, d).ataques.find((a) => a.nombre === 'Quarterstaff')!
    const dex = derivar(p, d).car.dex.mod
    expect(q.dano).toBe(`1d8+${dex}`)
    expect(q.bonoAtaque).toBe(dex + 3)
  })

  it('Warforged: +1 AC', () => {
    const { p, d } = crear('fighter|xphb', 1, { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 })
    const humano = derivar(p, d).ca.valor
    p.especie = 'warforged|efa'
    autocompletar(p, d)
    expect(derivar(p, d).ca.valor).toBe(humano + 1)
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
