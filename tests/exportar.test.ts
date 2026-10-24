import { describe, it, expect } from 'vitest'
import { datosDePrueba } from './datos'
import { personajeVacio } from '../src/motor/personaje'
import { derivar } from '../src/motor/derivar'
import { dineroSetting, notaObsidian } from '../src/ui/hoja/exportar'
import { autocompletar } from './util'

function vedev() {
  const d = datosDePrueba()
  const p = personajeVacio()
  p.nombre = 'Vedev Ashir'
  p.jugador = 'Pablo'
  p.especie = 'halfling|xphb'
  p.trasfondo = 'criminal|xphb'
  p.aspecto = 'Temeridad'
  p.caracteristicas.base = { str: 8, dex: 14, con: 12, int: 15, wis: 8, cha: 8 }
  p.elecciones['tra:dote'] = ['marca']
  for (let i = 0; i < 3; i++) p.niveles.push({ clase: 'wizard|xphb' })
  p.elecciones['cls:Wizard:sub'] = ['bladesinger|frhof']
  autocompletar(p, d)
  p.detalles = { apariencia: 'Mediano inquieto.', personalidad: 'Se aburre enseguida.', ideales: 'Lo prohibido.', historia: 'Creció en el Tajo.', aliados: '- Los Ganchos\n- Casa Ylvaren' }
  p.notas = [{ id: 'n', titulo: 'Sesión 1', texto: 'Cruzó el portal.', fecha: '2026-10-20T10:00:00Z' }]
  p.inventario.push(
    { id: 'q', origen: '5etools', ref: 'quarterstaff|xphb', nombre: 'Quarterstaff', cantidad: 1, equipado: true },
    { id: 'b', origen: '5etools', ref: 'bag of holding|xdmg', nombre: 'Bag of Holding', cantidad: 1 },
  )
  p.monedas = { pp: 0, gp: 27, sp: 1, cp: 4 }
  return { p, d }
}

describe('nota para Obsidian', () => {
  it('vuelca la ficha completa con la plantilla de la bóveda', () => {
    const { p, d } = vedev()
    const nota = notaObsidian(p, derivar(p, d), d)
    // Frontmatter compatible con Campaña.base
    expect(nota).toMatch(/^---\ntipo: personaje\naliases: \[\]\ntags: \[\]\njugador: Pablo\nestado: vivo\nraza: Mediano\nclase: Mago \(Danzante del filo\) 3\nnivel: 3\n/)
    for (const s of ['## Concepto', '## Trasfondo', '## Ganchos y objetivos', '## Relaciones', '## Objetos destacados', '## Ficha', '## Notas del jugador', '## Notas del DM']) expect(nota).toContain(s)
    // Lo escrito por el jugador
    expect(nota).toContain('Mediano inquieto.')
    expect(nota).toContain('**Personalidad:** Se aburre enseguida.')
    expect(nota).toContain('Creció en el Tajo.')
    expect(nota).toContain('- Los Ganchos\n- Casa Ylvaren')
    expect(nota).toContain('**Sesión 1** (2026-10-20): Cruzó el portal.')
    // Ficha
    expect(nota).toContain('| Salvación |')
    expect(nota).toMatch(/Idiomas: Cerinés/)
    expect(nota).toMatch(/Percepción pasiva \d+/)
    expect(nota).toMatch(/Bladesong \(\d\/Long Rest\)/)
    expect(nota).toContain('### Marca de aspecto')
    expect(nota).toMatch(/\*\*Marca invertida \(Temeridad\)\*\* · marca manifiesta invertida/)
    expect(nota).toContain('Fortaleza invertida')
    expect(nota).toMatch(/Espacios: nivel 1: 4 · nivel 2: 2/)
    expect(nota).toMatch(/Level 1: .*\*Expeditious Retreat\*/)
    // Equipo, dinero del setting y objetos destacados
    expect(nota).toContain('- Quarterstaff (equipado)')
    expect(nota).toContain('- Dinero: 27 sellos (GP) · 1 estrella (SP) · 4 puntas (CP)')
    expect(nota.split('## Objetos destacados')[1].split('##')[0]).toContain('Bag of Holding')
  })

  it('dinero con los nombres del setting', () => {
    expect(dineroSetting({ pp: 2, gp: 1, sp: 0, cp: 10 })).toBe('2 PP · 1 sello (GP) · 10 puntas (CP)')
    expect(dineroSetting({ pp: 0, gp: 0, sp: 0, cp: 0 })).toBe('sin dinero')
  })
})
