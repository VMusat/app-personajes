import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BESTIARIOS_5ETOOLS } from '../src/datos/fuentes'
import { bestiaPermitida, formaDeBestia, procesarBestias, textoBestia, type LimiteWildShape } from '../src/motor/formas'
import { gastarMonedas, moverEn, sumarMonedas } from '../src/motor/monedas'

const archivos = BESTIARIOS_5ETOOLS.map((a) => join('.cache-5etools', a))
const hayDatos = archivos.every(existsSync)

describe.skipIf(!hayDatos)('formas de Wild Shape', () => {
  const bestias = hayDatos ? procesarBestias(archivos.map((f) => JSON.parse(readFileSync(f, 'utf8')))) : []
  const nivel = (n: number, luna = false): LimiteWildShape => {
    const base = n >= 8 ? 1 : n >= 4 ? 0.5 : 0.25
    return { nivel: n, luna, crMax: luna ? Math.max(base, Math.floor(n / 3)) : base, vuelo: n >= 8, conocidas: 4, pgTemporales: n, caMinima: luna ? 16 : undefined }
  }

  it('sin dinosaurios ni enjambres, con nombre del setting', () => {
    expect(bestias.some((b) => /saurus|Rex|Swarm/.test(b.nombre))).toBe(false)
    const lobo = bestias.find((b) => b.nombre === 'Wolf')!
    expect(lobo).toMatchObject({ nombreEs: 'Lobo', cr: 0.25, ca: 12, velocidad: '40 ft', fue: 14, des: 15, con: 12, vuela: false })
    expect(lobo.entornos).toContain('Bosque Retorcido')
    expect(lobo.acciones[0].texto).toBe('Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.')
  })

  it('respeta el VD y el vuelo según el nivel', () => {
    const a2 = bestias.filter((b) => bestiaPermitida(b, nivel(2))).map((b) => b.nombre)
    expect(a2).toContain('Wolf')
    expect(a2).not.toContain('Hawk')
    expect(a2).not.toContain('Black Bear')
    expect(bestias.filter((b) => bestiaPermitida(b, nivel(8))).map((b) => b.nombre)).toEqual(expect.arrayContaining(['Brown Bear', 'Giant Bat']))
    expect(bestias.filter((b) => bestiaPermitida(b, nivel(6, true))).map((b) => b.nombre)).toContain('Polar Bear')
  })

  it('el Círculo de la Luna sube la AC a 13 + Sabiduría', () => {
    const oso = bestias.find((b) => b.nombre === 'Brown Bear')!
    expect(formaDeBestia(oso, nivel(6, true))).toMatchObject({ nombre: 'Oso pardo', ca: 16, fue: 17 })
    expect(formaDeBestia(oso).ca).toBe(11)
  })
})

describe('texto de 5etools', () => {
  it('quita las etiquetas de salvación y recarga', () => {
    expect(textoBestia('{@actSave dex} {@dc 13}. {@actSaveFail} 7 ({@damage 2d6}) Fire damage. {@recharge 5}')).toBe('Dexterity Saving Throw: DC 13. Failure: 7 (2d6) Fire damage. (Recharge 5–6)')
  })
})

describe('dinero', () => {
  const bolsa = () => ({ cp: 3, sp: 0, gp: 2, pp: 0 })
  it('suma y gasta las mismas monedas', () => {
    const m = bolsa()
    sumarMonedas(m, { gp: 5, sp: 4 })
    expect(m).toEqual({ cp: 3, sp: 4, gp: 7, pp: 0 })
    expect(gastarMonedas(m, { gp: 1, cp: 2 })).toBe(true)
    expect(m).toEqual({ cp: 1, sp: 4, gp: 6, pp: 0 })
  })
  it('paga con otras monedas y da el cambio', () => {
    const m = bolsa()
    expect(gastarMonedas(m, { sp: 3 })).toBe(true)
    expect(m).toEqual({ cp: 3, sp: 7, gp: 1, pp: 0 })
    const n = { cp: 0, sp: 15, gp: 0, pp: 0 }
    expect(gastarMonedas(n, { gp: 1 })).toBe(true)
    expect(n).toEqual({ cp: 0, sp: 5, gp: 0, pp: 0 })
  })
  it('no gasta si no llega', () => {
    const m = bolsa()
    expect(gastarMonedas(m, { gp: 3 })).toBe(false)
    expect(m).toEqual(bolsa())
  })
  it('mueve objetos en la lista', () => {
    const l = ['a', 'b', 'c', 'd']
    moverEn(l, 0, 2)
    expect(l).toEqual(['b', 'c', 'a', 'd'])
    moverEn(l, 3, 0)
    expect(l).toEqual(['d', 'b', 'c', 'a'])
  })
})
