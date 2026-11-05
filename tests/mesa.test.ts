import { describe, it, expect } from 'vitest'
import {
  alternarReloj, construirMesa, curarPj, dañarPj, formatoTiempo, nuevoReloj, restanteReloj, saludDe, sumarReloj,
} from '../src/almacen/mesa'
import { resumenAccion } from '../src/almacen/criaturas'
import { añadirApuntes } from '../src/ui/dm/editarSesion'
import { pantallaVacia } from '../src/almacen/pantalla'
import { ordenIniciativa } from '../src/ui/dm/iniciativa'
import { personajeVacio } from '../src/motor/personaje'

const estado = (pg: number | null, temp = 0) => ({ ...personajeVacio().estado, pgActuales: pg, pgTemporales: temp })

describe('daño y curación de los PJs', () => {
  it('gasta primero los PG temporales', () => {
    const e = estado(20, 5)
    expect(dañarPj(e, 30, 8)).toEqual([])
    expect(e).toMatchObject({ pgActuales: 17, pgTemporales: 0 })
  })

  it('avisa de la Concentración con la CD correcta', () => {
    const e = { ...estado(60), concentracion: 'Bless' }
    expect(dañarPj(e, 60, 9)).toEqual(['Concentración (Bless): salvación de CON CD 10'])
    expect(dañarPj(e, 60, 24)[0]).toContain('CD 12')
    expect(dañarPj(e, 60, 27)).toEqual(['Cae a 0 PG: inconsciente', 'Pierde la Concentración (Bless)'])
  })

  it('cae a 0, falla salvaciones de muerte y muere con daño masivo', () => {
    const e = estado(5)
    expect(dañarPj(e, 20, 7)).toEqual(['Cae a 0 PG: inconsciente'])
    expect(dañarPj(e, 20, 3, true)[0]).toContain('2 salvaciones de muerte falladas')
    expect(e.salvacionesMuerte.fallos).toBe(2)
    expect(dañarPj(estado(5), 20, 25)[0]).toContain('Muerte instantánea')
  })

  it('curar levanta al caído y reinicia las salvaciones', () => {
    const e = estado(0)
    e.salvacionesMuerte = { exitos: 1, fallos: 2 }
    curarPj(e, 20, 4)
    expect(e).toMatchObject({ pgActuales: 4, salvacionesMuerte: { exitos: 0, fallos: 0 } })
    curarPj(e, 20, 99)
    expect(e.pgActuales).toBe(20)
  })
})

describe('relojes', () => {
  it('cuenta atrás que se pone en marcha, se para y se alarga', () => {
    const r = nuevoReloj('r', 'Derrumbe', 'tiempo', 120, true)
    alternarReloj(r, 1000)
    expect(r.fin).toBe(121000)
    expect(restanteReloj(r, 31000)).toBe(90000)
    sumarReloj(r, 60, 31000)
    expect(restanteReloj(r, 31000)).toBe(150000)
    alternarReloj(r, 41000)
    expect(r.fin).toBeUndefined()
    expect(restanteReloj(r, 999999)).toBe(140000)
    expect(formatoTiempo(140000)).toBe('2:20')
    expect(formatoTiempo(3725000)).toBe('1:02:05')
  })
})

describe('la mesa de los jugadores', () => {
  it('no enseña las criaturas ocultas ni sus PG, y sí la salud a la vista', () => {
    const p = pantallaVacia()
    const plantilla = { nombre: 'Lobo', ca: 13, pgMax: 20, bonoIniciativa: 2 } as never
    p.criaturas = [
      { id: 'a', nombre: 'Lobo 1', plantilla, pg: 9, pgTemporales: 0, condiciones: ['Prone'] },
      { id: 'b', nombre: 'Lobo 2', plantilla, pg: 20, pgTemporales: 0, condiciones: [], oculta: true },
    ]
    p.combate = { activo: true, ronda: 2, turno: 'cr:a', valores: { 'cr:a': 15, 'pj:x': 12 }, desde: 0 }
    p.relojes = [nuevoReloj('r', 'Visible', 'pasos', 4, true), nuevoReloj('s', 'Secreto', 'pasos', 4, false)]
    const filas = ordenIniciativa(p, [{ id: 'x', nombre: 'Ana', bonoIniciativa: 1, aliados: [] }])
    const m = construirMesa(p, filas, [{ id: 'x', pg: 12, pgMax: 30, pgTemporales: 3, condiciones: [] }])
    expect(m.relojes.map((r) => r.nombre)).toEqual(['Visible'])
    expect(m.combate?.turno).toBe('cr:a')
    expect(m.combate?.filas).toEqual([
      { id: 'cr:a', tipo: 'criatura', nombre: 'Lobo 1', valor: 15, condiciones: ['Prone'], salud: 'malherido' },
      { id: 'pj:x', tipo: 'pj', nombre: 'Ana', valor: 12, condiciones: [], salud: 'malherido', pg: '12/30 +3' },
    ])
    p.mesaOculta = true
    expect(construirMesa(p, filas, []).combate).toBeUndefined()
  })

  it('describe la salud sin números', () => {
    expect([saludDe(20, 20), saludDe(11, 20), saludDe(10, 20), saludDe(0, 20)]).toEqual(['ileso', 'herido', 'malherido', 'caido'])
  })
})

describe('acciones de las criaturas', () => {
  it('lee ataque y daño, sumando las partes de un mismo golpe', () => {
    expect(resumenAccion({ nombre: 'Mordisco', texto: '+8, alcance 5 ft. 16 (2d10 + 5) perforante y 7 (2d6) necrótico.' })).toEqual({
      ataque: 8, dano: { formula: '2d10+5+2d6', tipo: 'perforante + necrótico' },
    })
  })

  it('lee la salvación sin confundir «con» con Constitución', () => {
    const r = resumenAccion({ nombre: 'Aullido (Recarga 5-6)', texto: 'Esfera de 30 ft con centro en él. Salvación de Sabiduría CD 15: 21 (6d6) psíquico. Si la supera, mitad de daño.' })
    expect(r).toEqual({ cd: 15, car: 'SAB', dano: { formula: '6d6', tipo: 'psíquico' } })
    expect(resumenAccion({ nombre: 'Bite', texto: 'Melee Attack Roll: +6, reach 5 ft. Hit: 9 (2d6 + 2) Piercing damage.' })).toMatchObject({ ataque: 6, dano: { formula: '2d6+2', tipo: 'piercing' } })
    expect(resumenAccion({ nombre: 'Multiataque', texto: 'Dos Mordiscos.' })).toEqual({})
  })
})

describe('apuntes en la nota de sesión', () => {
  it('crea la sección al final o añade al final de la que ya hay', () => {
    const a = añadirApuntes('# Sesión\n\n## Escena\n- [ ] algo\n\n', ['- 20:15 · uno'])
    expect(a).toBe('# Sesión\n\n## Escena\n- [ ] algo\n\n## Apuntes de la mesa\n- 20:15 · uno\n')
    const b = añadirApuntes(a + '\n## Secretos\nnada\n', ['- 20:30 · dos'])
    expect(b).toBe('# Sesión\n\n## Escena\n- [ ] algo\n\n## Apuntes de la mesa\n- 20:15 · uno\n- 20:30 · dos\n\n## Secretos\nnada\n')
  })
})
