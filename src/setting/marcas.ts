// Genera las dotes de marca de aspecto del setting (ver Reglas/Marcas de aspecto en la bóveda)
// en el mismo formato que las dotes de 5etools, para que el motor las trate igual que cualquier otra.
import marcas from './marcas.json'
import type { Crudo } from '../datos/tipos'

export interface Aspecto {
  n: string
  carta: string
  realidad: string
  derecho: string
  invertida: string
  oficial?: string
  nueva?: {
    habilidades: string[]
    truco?: string
    gratis: string[]
    gratisAlternativa?: string
    nivel3: string
    lista: Record<string, string[]>
  }
}

export const ASPECTOS: Aspecto[] = marcas.aspectos as Aspecto[]
const INVERTIDAS = marcas.invertidas as Record<string, { truco: string; conjuro: string; metamagia: string }>
const NOMBRES_HAB = marcas.nombresHabilidad as Record<string, string>

export const nombreMarcaManifiesta = (aspecto: string) => `Marca manifiesta (${aspecto})`
export const nombreMarcaPlena = (aspecto: string) => `Marca plena (${aspecto})`
export const nombreMarcaInvertida = (aspecto: string) => `Marca invertida (${aspecto})`
export const nombreMarcaPlenaInvertida = (aspecto: string) => `Marca plena invertida (${aspecto})`

/** Dotes oficiales que el setting sustituye por las suyas. */
export function esDoteSustituida(f: Crudo): boolean {
  return (
    f.source === 'EFA' &&
    (/^(Greater )?Mark of /.test(f.name) || ['Aberrant Dragonmark', 'Greater Aberrant Mark', 'Boon of Siberys'].includes(f.name))
  )
}

const titulo = (ref: string) =>
  ref
    .split('|')[0]
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Of|And|The|From)\b/g, (w) => w.toLowerCase())
const spell = (ref: string) => `{@spell ${titulo(ref)}|XPHB}`

/** Cambia en el texto las menciones a la dote original por la del setting. */
function renombrarTexto(x: unknown, de: string, a: string): unknown {
  if (typeof x === 'string') return x.split(`{@feat ${de}|EFA}`).join(a).split(de).join(a)
  if (Array.isArray(x)) return x.map((e) => renombrarTexto(e, de, a))
  if (x && typeof x === 'object') {
    const o: Crudo = {}
    for (const [k, v] of Object.entries(x)) o[k] = renombrarTexto(v, de, a)
    return o
  }
  return x
}

function base(nombre: string, categoria: string, extra: Crudo): Crudo {
  return { name: nombre, source: 'SETTING', category: categoria, ...extra }
}

export function generarDotesMarca(dotesOficiales: Crudo[]): Crudo[] {
  const oficial = (n: string) => dotesOficiales.find((f) => f.name === n && f.source === 'EFA')
  const res: Crudo[] = []

  for (const a of ASPECTOS) {
    const manif = nombreMarcaManifiesta(a.derecho)
    const plena = nombreMarcaPlena(a.derecho)
    const marcaAsp = { aspecto: a.derecho, carta: `${a.n} · ${a.carta}`, invertida: false }

    if (a.oficial) {
      const of = oficial(`Mark of ${a.oficial}`)
      const ofG = oficial(`Greater Mark of ${a.oficial}`)
      if (of) {
        res.push(
          base(manif, 'O', {
            ...renombrarTexto(of, `Mark of ${a.oficial}`, manif) as Crudo,
            name: manif,
            source: 'SETTING',
            category: 'O',
            prerequisite: [{ aspecto: a.derecho }],
            _marca: { ...marcaAsp, tipo: 'manifiesta', original: `Mark of ${a.oficial}` },
          }),
        )
      }
      if (ofG) {
        res.push({
          ...(renombrarTexto(renombrarTexto(ofG, `Mark of ${a.oficial}`, manif), `Greater ${manif}`, plena) as Crudo),
          name: plena,
          source: 'SETTING',
          category: 'G',
          prerequisite: [{ level: 4, feat: [`${manif.toLowerCase()}|setting`] }],
          _marca: { ...marcaAsp, tipo: 'plena', original: `Greater Mark of ${a.oficial}` },
        })
      }
    } else if (a.nueva) {
      const nv = a.nueva
      const habs = nv.habilidades.map((h) => NOMBRES_HAB[h] ?? h)
      const gratisTxt = nv.gratisAlternativa
        ? `${spell(nv.gratis[0])} o ${spell(nv.gratisAlternativa)} (eliges cada vez)`
        : nv.gratis.map(spell).join(' y ')
      const prepGratis = nv.gratisAlternativa ? [...nv.gratis, nv.gratisAlternativa] : nv.gratis
      const expanded: Crudo = {}
      for (const [k, v] of Object.entries(nv.lista)) expanded[k] = v
      const lista = Object.entries(nv.lista)
        .map(([k, v]) => [k.slice(1), v.map(spell).join(', ')])
      res.push(
        base(manif, 'O', {
          prerequisite: [{ aspecto: a.derecho }],
          additionalSpells: [
            {
              ability: { choose: ['int', 'wis', 'cha'] },
              ...(nv.truco ? { known: { _: [`${nv.truco}#c`] } } : {}),
              prepared: { _: { daily: { '1': prepGratis } }, '3': { daily: { '1': [nv.nivel3] } } },
              expanded,
            },
          ],
          _efectos: [{ tipo: 'dadoHabilidad', habilidades: nv.habilidades, dado: '1d4', origen: manif }],
          entries: [
            'You gain the following benefits.',
            {
              type: 'entries',
              name: `Intuición de ${a.derecho}`,
              entries: [
                `When you make an ability check using ${habs.join(' or ')}, you can roll {@dice 1d4} and add the number rolled to the ability check.`,
              ],
            },
            {
              type: 'entries',
              name: `Don de ${a.derecho}`,
              entries: [
                `${nv.truco ? `You know the ${spell(nv.truco)} cantrip. ` : ''}You always have ${gratisTxt} prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a {@variantrule Long Rest|XPHB}. You can also cast it using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for this feat's spells (choose when you select this feat).`,
                `When you reach character level 3, you also always have the ${spell(nv.nivel3)} spell prepared and can cast it the same way.`,
              ],
            },
            {
              type: 'entries',
              name: 'Spells of the Mark',
              entries: [
                `If you have the Spellcasting or Pact Magic class feature, the spells on the ${manif} table are added to that feature's spell list.`,
                { type: 'table', caption: manif, colLabels: ['Spell Level', 'Spells'], rows: lista },
              ],
            },
          ],
          _marca: { ...marcaAsp, tipo: 'manifiesta' },
        }),
      )
      res.push(
        base(plena, 'G', {
          prerequisite: [{ level: 4, feat: [`${manif.toLowerCase()}|setting`] }],
          ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }],
          _efectos: [{ tipo: 'dadoHabilidad', habilidades: nv.habilidades, dado: '1d6', origen: plena, sustituye: manif }],
          _usosMarcaPlena: { de: manif },
          entries: [
            'You gain the following benefits.',
            { type: 'entries', name: 'Ability Score Increase', entries: ['Increase one ability score of your choice by 1, to a maximum of 20.'] },
            { type: 'entries', name: `Intuición de ${a.derecho} mejorada`, entries: [`When you use the ${habs.join('/')} benefit of your ${manif} feat, you can roll {@dice 1d6} instead of {@dice 1d4}.`] },
            { type: 'entries', name: 'Don mejorado', entries: [`You can cast the free spell of your ${manif} feat without a spell slot a number of times equal to your {@variantrule Proficiency|XPHB|Proficiency Bonus}, and you regain all expended uses when you finish a {@variantrule Long Rest|XPHB}.`] },
          ],
          _marca: { ...marcaAsp, tipo: 'plena' },
        }),
      )
    }

    // Marca invertida: la dote Aberrant Dragonmark con el truco y el conjuro fijados por el aspecto invertido.
    const inv = INVERTIDAS[a.invertida]
    const ab = oficial('Aberrant Dragonmark')
    const nomInv = nombreMarcaInvertida(a.invertida)
    if (inv && ab) {
      const entradas = (ab.entries as Crudo[]).map((e) =>
        typeof e === 'object' && e.name === 'Aberrant Magic'
          ? {
              type: 'entries',
              name: 'Aberrant Magic',
              entries: [
                `You know the ${spell(inv.truco)} cantrip. You always have the ${spell(inv.conjuro)} spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a {@variantrule Short Rest|XPHB|Short} or {@variantrule Long Rest|XPHB}. You can also cast this spell using any spell slots you have. Constitution is your spellcasting ability for these spells.`,
              ],
            }
          : e,
      )
      entradas.push({
        type: 'entries',
        name: 'Metamagia invertida',
        entries: [
          `Once per {@variantrule Long Rest|XPHB}, you can apply the {@optfeature ${inv.metamagia}|XPHB} Metamagic option to the cantrip or the spell of this feat, without spending Sorcery Points.`,
        ],
      })
      res.push(
        base(nomInv, 'O', {
          prerequisite: [{ aspecto: a.invertida }],
          additionalSpells: [{ ability: 'con', known: { _: [`${inv.truco}#c`] }, prepared: { _: { rest: { '1': [inv.conjuro] } } } }],
          entries: entradas,
          _recursos: [
            { nombre: 'Aberrant Fortitude', usos: 1, recarga: 'largo' },
            { nombre: `Metamagia: ${inv.metamagia}`, usos: 1, recarga: 'largo' },
          ],
          _marca: { aspecto: a.invertida, carta: `${a.n} · ${a.carta} (invertida)`, invertida: true, tipo: 'manifiesta' },
        }),
      )
      const abG = oficial('Greater Aberrant Mark')
      if (abG) {
        res.push({
          ...(renombrarTexto(abG, 'Aberrant Dragonmark', nomInv) as Crudo),
          name: nombreMarcaPlenaInvertida(a.invertida),
          source: 'SETTING',
          category: 'G',
          prerequisite: [{ level: 4, feat: [`${nomInv.toLowerCase()}|setting`] }],
          _marca: { aspecto: a.invertida, carta: `${a.n} · ${a.carta} (invertida)`, invertida: true, tipo: 'plena' },
        })
      }
    }
  }

  // Don épico: Boon of Siberys renombrado Eco del Divino.
  const sib = oficial('Boon of Siberys')
  if (sib) {
    res.push({
      ...(renombrarTexto(sib, 'Boon of Siberys', 'Eco del Divino') as Crudo),
      name: 'Eco del Divino',
      source: 'SETTING',
      prerequisite: [{ level: 19 }],
    })
  }
  return res
}
