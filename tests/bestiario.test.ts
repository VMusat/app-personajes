import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  coste, exportarCriatura, importarCriatura, recarga, sinergiaActiva, usosPorDia, type Criatura,
} from '../src/almacen/criaturas'
import { leerSesion, lineasDeTareas, type BloqueSesion } from '../src/ui/dm/notaSesion'
import { aHtml, borrar, cambiarTipo, escribirFila, insertar, reemplazar, trasladarTachadas } from '../src/ui/dm/editarSesion'
import { ordenIniciativa } from '../src/ui/dm/iniciativa'
import { pantallaVacia } from '../src/almacen/pantalla'

const NOTA = `---
tipo: criatura
etiqueta: acechador
tramo: 5-7
habitat: "[[Udegard]]"
---
# Lobo de prueba

> Un lobo que no debería existir.

## Estadísticas
*Monstruosidad Grande (Acechador), neutral malvado*

- **CA:** 15 (armadura natural)
- **PG:** 60 (8d10 + 16)
- **Velocidad:** 50 ft
- **Características:** FUE 18 · DES 14 · CON 14 · INT 6 · SAB 12 · CAR 8
- **Sentidos:** visión en la oscuridad 60 ft; Percepción pasiva 13
- **VD:** 4 (XP 1100; BC +2)

### Rasgos
- **Resistencia legendaria (2/día).** Si falla una salvación, puede superarla.

### Acciones
- **Mordisco.** +6, alcance 5 ft. 11 (2d6 + 4) perforante.
- **Aullido (Recarga 5-6).** Salvación de SAB CD 13.
  - Fallo: Asustado.

### Acciones legendarias
*Usos: 3 (4 en su guarida).* Al final del turno de otra criatura.
- **Mordisco.** Hace un Mordisco.
- **Salto (Cuesta 2).** Se mueve sin provocar.

### Acciones de guarida
En la iniciativa 20 (pierde los empates).
- **Niebla.** La guarida se llena de niebla.

### Efectos regionales
- **Silencio.** No cantan los pájaros.

### Sinergias
- **Con [[Jaggerjaw]].** Atacan juntos.

## Tácticas
- Rodea a su presa.

## Dominio
- **Ley.** Nada en la niebla puede ser dañado.
- **Romperla.** Disipar la niebla.
<!-- - **Pistas.** comentario que no cuenta -->
`

describe('Bestiario: formato de las notas', () => {
  const c = importarCriatura('Lobo de prueba.md', NOTA)

  it('lee la cabecera de la ficha', () => {
    expect(c).toMatchObject({
      nombre: 'Lobo de prueba', resumen: 'Un lobo que no debería existir.', tipo: 'Monstruosidad Grande (Acechador), neutral malvado',
      ca: 15, caTexto: 'armadura natural', pgMax: 60, pgFormula: '8d10+16', velocidad: '50 ft', percepcionPasiva: 13,
      vd: '4', xp: 1100, bc: 2, tramo: '5-7', habitat: 'Udegard', etiqueta: 'acechador',
    })
    expect(c.caracteristicas).toEqual({ str: 18, dex: 14, con: 14, int: 6, wis: 12, cha: 8 })
    expect(c.bonoIniciativa).toBe(2) // sin «Iniciativa», sale de DES
  })

  it('lee rasgos, acciones, legendarias, guarida, sinergias, dominio y tácticas', () => {
    expect(c.acciones?.map((e) => e.nombre)).toEqual(['Mordisco', 'Aullido (Recarga 5-6)'])
    expect(c.acciones?.[1].texto).toContain('• Fallo: Asustado.')
    expect(c.legendarias).toMatchObject({ usos: 3, usosGuarida: 4, texto: 'Al final del turno de otra criatura.' })
    expect(c.legendarias?.acciones).toHaveLength(2)
    expect(c.guarida?.acciones[0].nombre).toBe('Niebla')
    expect(c.guarida?.efectos[0].nombre).toBe('Silencio')
    expect(c.sinergias?.[0].nombre).toBe('Con [[Jaggerjaw]]')
    expect(c.dominio?.map((e) => e.nombre)).toEqual(['Ley', 'Romperla'])
    expect(c.tacticas).toBe('Rodea a su presa.')
  })

  it('cuenta usos por día, recargas y costes', () => {
    expect(usosPorDia('Resistencia legendaria (2/día)')).toBe(2)
    expect(usosPorDia('Spellcasting (1/Day Each)')).toBe(1)
    expect(recarga('Aullido (Recarga 5-6)')).toBe(5)
    expect(recarga('Breath (Recharge 6)')).toBe(6)
    expect(coste('Salto (Cuesta 2)')).toBe(2)
    expect(coste('Mordisco')).toBe(1)
  })

  it('detecta las sinergias activas por nombre', () => {
    expect(sinergiaActiva(c.sinergias![0], ['Jaggerjaw'])).toBe(true)
    expect(sinergiaActiva(c.sinergias![0], ['Jaggerjaw 2'])).toBe(true)
    expect(sinergiaActiva(c.sinergias![0], ['Perro'])).toBe(false)
  })

  it('exporta y vuelve a importar sin perder nada', () => {
    const otra = importarCriatura('Lobo de prueba.md', exportarCriatura(c))
    const sin = (x: Criatura) => ({ ...x, actualizado: undefined, notaObsidian: undefined, id: undefined })
    expect(sin(otra)).toEqual(sin(c))
  })

  const nota = path.resolve(__dirname, '../../Campaign/Bestiario/Jaggerjaw.md')
  it.skipIf(!existsSync(nota))('lee la ficha real de Jaggerjaw', () => {
    const j = importarCriatura('Jaggerjaw.md', readFileSync(nota, 'utf8'))
    expect(j).toMatchObject({ ca: 16, pgMax: 152, bonoIniciativa: 7, vd: '8' })
    expect(j.acciones?.some((e) => recarga(e.nombre) === 5)).toBe(true)
  })
})

const SESION = `# Sesión

## Escena 1
- [ ] Primera **línea**
  - [ ] Hija
- [ ] Segunda

> [!tirada]- Perception CD 13
> - **Éxito:** la ve.

| PJ | CA |
|---|---|
| [[Marcos\\|el charlatán]] | 15 |
`

describe('edición de la nota de sesión', () => {
  const bs = leerSesion(SESION)
  const lista = bs.find((b) => b.tipo === 'lista') as Extract<BloqueSesion, { tipo: 'lista' }>
  const callout = bs.find((b) => b.tipo === 'callout') as Extract<BloqueSesion, { tipo: 'callout' }>

  it('sabe dónde está cada elemento', () => {
    expect(lista.items[0].ref).toEqual({ n: 3, fin: 3, d: 6 })
    expect(lista.items[0].finArbol).toBe(4)
    expect(lista.items[0].hijos[0].prefijo).toBe('  - [ ] ')
    expect(callout).toMatchObject({ n: 7, fin: 8, prefijoCuerpo: '> ' })
    expect(lineasDeTareas(SESION)).toEqual([3, 4, 5])
  })

  it('cambia solo el texto de la línea, sin tocar su formato', () => {
    const c = reemplazar(SESION, lista.items[0].ref, 'Primera *cambiada*')
    expect(c.texto.split('\n')[3]).toBe('- [ ] Primera *cambiada*')
    const t = reemplazar(SESION, callout.ref!, 'Insight CD 12')
    expect(t.texto.split('\n')[7]).toBe('> [!tirada]- Insight CD 12')
  })

  it('inserta tarjetas separadas y líneas dentro de un callout', () => {
    const c = insertar(SESION, lista.fin, ['> [!narracion]- Narración', '> Texto'], '')
    const ls = c.texto.split('\n')
    expect(ls.slice(5, 10)).toEqual(['- [ ] Segunda', '', '> [!narracion]- Narración', '> Texto', ''])
    expect(c.primera).toBe(7)
    const d = insertar(SESION, callout.fin, ['> - Fallo: nada'], '>')
    expect(d.texto.split('\n').slice(9, 11)).toEqual(['>', '> - Fallo: nada'])
  })

  it('conserva lo tachado al insertar y borrar líneas', () => {
    const tachadas = [2] // «Segunda»
    const c = insertar(SESION, 3, ['- [ ] Nueva'], null)
    expect(trasladarTachadas(lineasDeTareas(SESION), lineasDeTareas(c.texto), tachadas, c.mapa)).toEqual([3])
    const b = borrar(SESION, 3, 4)
    expect(trasladarTachadas(lineasDeTareas(SESION), lineasDeTareas(b.texto), [0, 2], b.mapa)).toEqual([0])
  })

  it('cambia el tipo de una tarjeta y escribe celdas con enlaces', () => {
    expect(cambiarTipo(SESION, 7, 'reto').texto.split('\n')[7]).toBe('> [!reto]- Perception CD 13')
    const f = escribirFila(SESION, { n: 12, d: 0 }, ['[[Marcos|el charlatán]]', '16'])
    expect(f.texto.split('\n')[12]).toBe('| [[Marcos\\|el charlatán]] | 16 |')
  })

  it('muestra el formato al editar y conserva los enlaces', () => {
    expect(aHtml('Ve a **[[Puerto Ceniza|el puerto]]** <ya>')).toBe('Ve a <b><span class="wl" data-wl="Puerto Ceniza">el puerto</span></b> &lt;ya&gt;')
  })
})

describe('iniciativa con guarida', () => {
  it('añade la acción de guarida en la 20, perdiendo los empates', () => {
    const p = pantallaVacia()
    const c = importarCriatura('Lobo de prueba.md', NOTA)
    p.criaturas = [{ id: 'lobo', nombre: 'Lobo', plantilla: c, pg: 60, pgTemporales: 0, condiciones: [], enGuarida: true }]
    p.combate.valores = { 'cr:lobo': 20, 'pj:a': 20 }
    const f = ordenIniciativa(p, [{ id: 'a', nombre: 'Ana', bonoIniciativa: 1, aliados: [] }])
    expect(f.map((x) => x.id)).toEqual(['cr:lobo', 'pj:a', 'gu:lobo'])
  })
})
