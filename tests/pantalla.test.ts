import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { leerSesion, type BloqueSesion, type ItemLista } from '../src/ui/dm/notaSesion'
import { ordenIniciativa, siguienteTurno, type PjMesa } from '../src/ui/dm/iniciativa'
import { pantallaVacia, tituloNota } from '../src/almacen/pantalla'
import type { Aliado } from '../src/motor/personaje'

const EJEMPLO = `---
tipo: sesion
---
# Sesión 99 - Prueba

## Escena 1
- [ ] Pulga intenta robar a Vitorino. 🎲
  - [ ] **El cuenco**
  - Un detalle sin tarea

> [!tirada]- Perception CD 13 · Ver a Pulga
> - **13-17:** la ve.
> - **18+:** ve el nudo.

> [!dm]- Lo que sabe el DM
> | PJ | CA |
> |---|---|
> | [[Marcos\\|el charlatán]] | 15 |

- [x] Ya hecha en Obsidian
`

const tareas = (bs: BloqueSesion[]): ItemLista[] =>
  bs.flatMap((b) =>
    b.tipo === 'lista' ? b.items.flatMap(function rec(i: ItemLista): ItemLista[] { return [i, ...i.hijos.flatMap(rec)] }).filter((i) => i.tarea !== undefined)
      : b.tipo === 'callout' ? tareas(b.hijos) : [],
  )

describe('nota de sesión', () => {
  const bs = leerSesion(EJEMPLO)

  it('quita el frontmatter y lee el título', () => {
    expect(bs[0]).toMatchObject({ tipo: 'titulo', nivel: 1, texto: 'Sesión 99 - Prueba' })
    expect(tituloNota(EJEMPLO, 'x.md')).toBe('Sesión 99 - Prueba')
  })

  it('numera las tareas, también las anidadas, y respeta las ya hechas', () => {
    const t = tareas(bs)
    expect(t.map((x) => x.tarea)).toEqual([0, 1, 2])
    expect(t[1].texto).toBe('**El cuenco**')
    expect(t[2].hechaEnNota).toBe(true)
  })

  it('lee los callouts plegados con su tipo y su título', () => {
    const c = bs.find((b) => b.tipo === 'callout' && b.clase === 'tirada')
    expect(c).toMatchObject({ plegado: true, titulo: 'Perception CD 13 · Ver a Pulga' })
  })

  it('no parte las celdas por la barra escapada de los enlaces', () => {
    const dm = bs.find((b) => b.tipo === 'callout' && b.clase === 'dm')
    const tabla = dm?.tipo === 'callout' ? dm.hijos.find((h) => h.tipo === 'tabla') : undefined
    expect(tabla?.tipo === 'tabla' && tabla.filas[0]).toEqual(['[[Marcos|el charlatán]]', '15'])
  })

  const nota = path.resolve(__dirname, '../../Campaign/Sesiones/Sesión 01 - El fallo de los portales.md')
  it.skipIf(!existsSync(nota))('lee la nota real de la Sesión 01', () => {
    const real = leerSesion(readFileSync(nota, 'utf8'))
    expect(tareas(real).length).toBeGreaterThan(40)
    const tipos = new Set<string>()
    const rec = (b: BloqueSesion[]) => b.forEach((x) => x.tipo === 'callout' && (tipos.add(x.clase), rec(x.hijos)))
    rec(real)
    for (const t of ['narracion', 'dialogo', 'tirada', 'reto', 'salvacion', 'dm']) expect(tipos).toContain(t)
  })
})

describe('iniciativa', () => {
  const aliado = (id: string, iniciativa: Aliado['iniciativa']): Aliado => ({ id, nombre: id, tipo: 'familiar', iniciativa, bonoIniciativa: 2, pg: 1, pgMax: 1, ca: 12 })
  const pjs: PjMesa[] = [
    { id: 'vatu', nombre: 'Vatu', bonoIniciativa: 1, aliados: [aliado('cañón', 'turno'), aliado('defensor', 'tras')] },
    { id: 'vito', nombre: 'Vitorino', bonoIniciativa: 1, aliados: [aliado('lechuza', 'propia')] },
  ]
  const p = pantallaVacia()
  p.criaturas = [
    { id: 'perro', nombre: 'Perro', plantilla: { nombre: 'Perro', ca: 12, pgMax: 39, bonoIniciativa: 2 }, pg: 39, pgTemporales: 0, condiciones: [] },
    { id: 'oculto', nombre: 'Jaggerjaw', plantilla: { nombre: 'Jaggerjaw', ca: 16, pgMax: 152, bonoIniciativa: 3 }, pg: 152, pgTemporales: 0, condiciones: [], oculta: true },
  ]
  p.combate.valores = { 'pj:vatu': 12, 'pj:vito': 18, 'cr:perro': 12, 'al:vito:lechuza': 5 }

  it('ordena de mayor a menor, con los aliados «tras» detrás de su PJ y sin las criaturas ocultas', () => {
    const f = ordenIniciativa(p, pjs)
    expect(f.map((x) => x.id)).toEqual(['pj:vito', 'cr:perro', 'pj:vatu', 'al:vatu:defensor', 'al:vito:lechuza'])
    expect(f.find((x) => x.id === 'pj:vatu')?.enSuTurno.map((a) => a.id)).toEqual(['cañón'])
  })

  it('avanza el turno y la ronda al dar la vuelta', () => {
    const f = ordenIniciativa(p, pjs)
    expect(siguienteTurno(f, undefined, 1)).toEqual({ turno: 'pj:vito', ronda: 1 })
    expect(siguienteTurno(f, 'al:vito:lechuza', 1)).toEqual({ turno: 'pj:vito', ronda: 2 })
    expect(siguienteTurno(f, 'pj:vito', 2, true)).toEqual({ turno: 'al:vito:lechuza', ronda: 1 })
  })
})
