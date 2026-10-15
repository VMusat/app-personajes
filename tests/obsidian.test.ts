import { describe, it, expect } from 'vitest'
import { exportarNota, importarNota } from '../src/almacen/obsidian'

const NOTA = `---
tipo: objeto
aliases: []
tags: [misterio]
rareza: raro
sintonizacion: true
portador: "[[Selma Jamnei]]"
mecanica:
  tipo: anillo
  cargas: { max: 3, recarga: amanecer }
  efectos:
    - { tipo: bono, objetivo: ca, valor: 1 }
    - { tipo: conjuro, conjuro: misty step|xphb, usos: 1, recarga: largo }
---
# Anillo de la Rueda

## Descripción
Un anillo que gira solo. Lo forjó [[Calvin Oddvane|Calvin]].

## Propiedades mecánicas
Brilla cerca de la miasma.

## Historia
Nadie sabe.

## Secretos
- Es un fragmento de [[Cartas de Taro|Taro]].
`

describe('objetos desde Obsidian', () => {
  it('importa frontmatter, mecánica y secciones', () => {
    const o = importarNota('Anillo de la Rueda.md', NOTA)
    expect(o.nombre).toBe('Anillo de la Rueda')
    expect(o.rareza).toBe('rare')
    expect(o.sintonizacion).toBe(true)
    expect(o.tipo).toBe('anillo')
    expect(o.cargas).toEqual({ max: 3, recarga: 'amanecer' })
    expect(o.efectos).toHaveLength(2)
    expect(o.descripcion).toContain('Lo forjó Calvin.')
    expect(o.descripcion).toContain('Brilla cerca')
    expect(o.secreto).toContain('fragmento de Taro')
  })
  it('exporta y vuelve a importar igual', () => {
    const o = importarNota('Anillo de la Rueda.md', NOTA)
    const md = exportarNota(o)
    expect(md).toContain('rareza: raro')
    const o2 = importarNota('Anillo de la Rueda.md', md, o)
    expect(o2.efectos).toEqual(o.efectos)
    expect(o2.cargas).toEqual(o.cargas)
    expect(o2.rareza).toBe('rare')
  })
})
