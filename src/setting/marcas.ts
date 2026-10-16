// Genera las dotes de marca de aspecto (ver Reglas/Marcas de aspecto en la bóveda).
// Todas las marcas siguen la misma plantilla de la casa, en el formato de dotes de 5etools para que el motor
// las trate como cualquier otra dote:
//  - Marca manifiesta: Intuición de la marca (+1d4), rasgos propios, Magia de la marca y Conjuros de la marca.
//  - Marca plena: +1 a una característica, Intuición mejorada (d6) y la mejora propia del aspecto.
//  - Marca invertida (y plena invertida): la estructura de Aberrant Dragonmark con conjuros fijos y metamagia.
import marcas from './marcas.json'
import type { Crudo } from '../datos/tipos'

interface Extra {
  nombre: string
  texto: string
  efectos?: Crudo[]
  recurso?: { nombre: string; usos: number | string; recarga: string }
  usosPB?: boolean
}

export interface Aspecto {
  n: string
  carta: string
  realidad: string
  derecho: string
  invertida: string
  manifiesta: {
    habilidades: string[]
    herramientas?: string
    truco?: string
    gratis: string[]
    /** Cada conjuro gratis tiene su propio uso. */
    cada?: boolean
    /** Los conjuros gratis comparten un único uso (se elige al lanzar). */
    compartido?: boolean
    nivel3?: string
    extras?: Extra[]
    lista: Record<string, string[]>
  }
  /** Mejoras de la marca plena; «pb» = los conjuros gratis se pueden lanzar PB veces por Long Rest. */
  plena: Extra[] | 'pb'
}

export const ASPECTOS: Aspecto[] = marcas.aspectos as Aspecto[]
const INVERTIDAS = marcas.invertidas as Record<string, { truco: string; conjuro: string; metamagia: string; nota?: string }>
const NOMBRES_HAB = marcas.nombresHabilidad as Record<string, string>

export const nombreMarcaManifiesta = (aspecto: string) => `Marca manifiesta (${aspecto})`
export const nombreMarcaPlena = (aspecto: string) => `Marca plena (${aspecto})`
export const nombreMarcaInvertida = (aspecto: string) => `Marca invertida (${aspecto})`
export const nombreMarcaPlenaInvertida = (aspecto: string) => `Marca plena invertida (${aspecto})`

/** Dotes oficiales que el setting sustituye por las suyas. */
export function esDoteSustituida(f: Crudo): boolean {
  return (
    f.source === 'EFA' &&
    (/^(Greater )?Mark of /.test(f.name) || ['Aberrant Dragonmark', 'Greater Aberrant Mark', 'Boon of Siberys', 'Potent Dragonmark'].includes(f.name))
  )
}

const titulo = (ref: string) =>
  ref
    .split('|')[0]
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Of|And|Or|The|From)\b/g, (w) => w.toLowerCase())
const spell = (ref: string) => `{@spell ${titulo(ref)}|XPHB}`
const lista = (xs: string[], y = 'y') => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${y} ${xs[xs.length - 1]}`)
const bloque = (name: string, ...entries: unknown[]) => ({ type: 'entries', name, entries })

function textoMagia(m: Aspecto['manifiesta'], nombre: string): string[] {
  const t: string[] = []
  const truco = m.truco ? `Conoces el truco ${spell(m.truco)}. ` : ''
  const cierre = 'También puedes lanzarlo con tus espacios de conjuro del nivel adecuado. INT, WIS o CHA es tu característica para los conjuros de esta marca (elígela al tomar la dote).'
  if (m.gratis.length) {
    const gr = lista(m.gratis.map(spell), m.compartido ? 'o' : 'y')
    const usos = m.compartido
      ? 'Puedes lanzar uno de ellos (eliges cada vez) una vez sin gastar espacio'
      : m.cada || m.gratis.length > 1
        ? 'Puedes lanzar cada uno una vez sin gastar espacio'
        : 'Puedes lanzarlo una vez sin gastar espacio'
    t.push(`${truco}Siempre tienes preparado ${gr}. ${usos}, y recuperas ese uso al terminar un Long Rest. ${cierre}`)
    if (m.nivel3) t.push(`Al llegar a nivel 3 de personaje, también tienes siempre preparado ${spell(m.nivel3)} y puedes lanzarlo de la misma forma.`)
  } else if (m.nivel3) {
    t.push(`${truco}Al llegar a nivel 3 de personaje, siempre tienes preparado ${spell(m.nivel3)}. Puedes lanzarlo una vez sin gastar espacio, y recuperas ese uso al terminar un Long Rest. ${cierre}`)
  } else if (truco) t.push(truco.trim())
  return t.length ? t : [`Los conjuros de ${nombre} se añaden a tu lista.`]
}

function textoIntuicion(m: Aspecto['manifiesta'], dado: string): string {
  const habs = m.habilidades.map((h) => NOMBRES_HAB[h] ?? h)
  const partes = [habs.length ? `una prueba de ${lista(habs, 'o')}` : '', m.herramientas ? `una prueba con ${m.herramientas}` : ''].filter(Boolean)
  return `Cuando haces ${partes.join(' o ')}, puedes tirar {@dice ${dado}} y sumar el resultado.`
}

function tablaConjuros(nombre: string, l: Record<string, string[]>) {
  return bloque(
    'Conjuros de la marca',
    'Si tienes el rasgo Spellcasting o Pact Magic, estos conjuros se añaden a la lista de conjuros de tu clase.',
    { type: 'table', caption: nombre, colLabels: ['Nivel', 'Conjuros'], rows: Object.entries(l).map(([k, v]) => [k.slice(1), v.map(spell).join(', ')]) },
  )
}

const base = (name: string, category: string, extra: Crudo): Crudo => ({ name, source: 'SETTING', category, ...extra })

export function generarDotesMarca(dotesOficiales: Crudo[]): Crudo[] {
  const res: Crudo[] = []

  for (const a of ASPECTOS) {
    const m = a.manifiesta
    const manif = nombreMarcaManifiesta(a.derecho)
    const plena = nombreMarcaPlena(a.derecho)
    const marcaAsp = { aspecto: a.derecho, carta: `${a.n} · ${a.carta}`, invertida: false }

    // ── Marca manifiesta
    const prepared: Crudo = {}
    if (m.gratis.length) prepared._ = { daily: { [m.compartido ? '1' : '1e']: m.gratis } }
    if (m.nivel3) prepared['3'] = { daily: { '1': [m.nivel3] } }
    const extras = m.extras ?? []
    res.push(
      base(manif, 'O', {
        prerequisite: [{ aspecto: a.derecho }],
        additionalSpells: [
          {
            ability: { choose: ['int', 'wis', 'cha'] },
            ...(m.truco ? { known: { _: [`${m.truco}#c`] } } : {}),
            ...(Object.keys(prepared).length ? { prepared } : {}),
            expanded: m.lista,
          },
        ],
        _efectos: [
          ...(m.habilidades.length ? [{ tipo: 'dadoHabilidad', habilidades: m.habilidades, dado: '1d4', origen: manif }] : []),
          ...extras.flatMap((x) => x.efectos ?? []),
        ],
        _recursos: extras.filter((x) => x.recurso).map((x) => x.recurso),
        entries: [
          `La marca de ${a.derecho} (${a.n} · ${a.carta}) se ha hecho visible en tu piel. Obtienes estos beneficios:`,
          bloque('Intuición de la marca', textoIntuicion(m, '1d4')),
          ...extras.map((x) => bloque(x.nombre, x.texto)),
          bloque('Magia de la marca', ...textoMagia(m, manif)),
          tablaConjuros(manif, m.lista),
        ],
        _marca: { ...marcaAsp, tipo: 'manifiesta' },
      }),
    )

    // ── Marca plena
    const mejoras: Extra[] =
      a.plena === 'pb'
        ? [{ nombre: 'Magia mejorada', texto: `Puedes lanzar sin gastar espacio los conjuros de la Magia de la marca tantas veces como tu PB, y recuperas todos los usos al terminar un Long Rest.`, usosPB: true }]
        : a.plena
    res.push(
      base(plena, 'G', {
        prerequisite: [{ level: 4, feat: [`${manif.toLowerCase()}|setting`] }],
        ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }],
        _efectos: m.habilidades.length ? [{ tipo: 'dadoHabilidad', habilidades: m.habilidades, dado: '1d6', origen: plena, sustituye: manif }] : [],
        _recursos: mejoras.filter((x) => x.recurso).map((x) => x.recurso),
        ...(mejoras.some((x) => x.usosPB) ? { _usosMarcaPlena: { de: manif } } : {}),
        entries: [
          `Tu marca de ${a.derecho} alcanza su plenitud. Obtienes estos beneficios:`,
          bloque('Aumento de característica', 'Aumenta en 1 una característica a tu elección, hasta un máximo de 20.'),
          bloque('Intuición mejorada', `Cuando usas la Intuición de la marca, tiras {@dice 1d6} en lugar de {@dice 1d4}.`),
          ...mejoras.map((x) => bloque(x.nombre, x.texto)),
        ],
        _marca: { ...marcaAsp, tipo: 'plena' },
      }),
    )

    // ── Marca invertida: estructura de Aberrant Dragonmark con conjuros fijos y una metamagia
    const inv = INVERTIDAS[a.invertida]
    if (inv) {
      const nomInv = nombreMarcaInvertida(a.invertida)
      const marcaInv = { aspecto: a.invertida, carta: `${a.n} · ${a.carta} (invertida)`, invertida: true }
      res.push(
        base(nomInv, 'O', {
          prerequisite: [{ aspecto: a.invertida }],
          additionalSpells: [{ ability: 'con', known: { _: [`${inv.truco}#c`] }, prepared: { _: { rest: { '1': [inv.conjuro] } } } }],
          _recursos: [
            { nombre: 'Fortaleza invertida', usos: 1, recarga: 'largo' },
            { nombre: `Metamagia invertida (${inv.metamagia})`, usos: 1, recarga: 'largo' },
          ],
          entries: [
            `La marca de ${a.invertida} (${a.n} · ${a.carta}, del revés) se ha hecho visible en tu piel: fría al tacto y con el dibujo invertido. Obtienes estos beneficios:`,
            bloque('Fortaleza invertida', 'Cuando fallas una salvación de CON, puedes usar tu Reaction para tirar {@dice 1d4} y sumarlo a la salvación, lo que puede convertir el fallo en éxito. Una vez por Long Rest.'),
            bloque(
              'Magia invertida',
              `Conoces el truco ${spell(inv.truco)} y siempre tienes preparado ${spell(inv.conjuro)}. Puedes lanzar ${spell(inv.conjuro)} una vez sin gastar espacio, y recuperas ese uso al terminar un Short Rest o un Long Rest. También puedes lanzarlo con tus espacios de conjuro. CON es tu característica para los conjuros de esta marca.`,
            ),
            bloque(
              'Oleada invertida',
              `Cuando lanzas ${spell(inv.conjuro)} con esta marca, puedes gastar uno de tus Hit Point Dice y tirarlo. Si sale par, ganas tantos HP temporales como el resultado. Si sale impar, una criatura a 30 ft de ti (que no seas tú) sufre ese daño de Force; si no hay ninguna, lo sufres tú.`,
            ),
            bloque(
              'Metamagia invertida',
              `Una vez por Long Rest puedes aplicar la opción de Metamagia {@optfeature ${inv.metamagia}|XPHB} al truco o al conjuro de esta marca, sin gastar Sorcery Points.${inv.nota ? ` ${inv.nota}` : ''}`,
            ),
          ],
          _marca: { ...marcaInv, tipo: 'manifiesta' },
        }),
      )
      res.push(
        base(nombreMarcaPlenaInvertida(a.invertida), 'G', {
          prerequisite: [{ level: 4, feat: [`${nomInv.toLowerCase()}|setting`] }],
          ability: [{ con: 1 }],
          _recursos: [{ nombre: 'Inspiración invertida', usos: 'pb', recarga: 'largo' }],
          entries: [
            `Tu marca de ${a.invertida} alcanza su plenitud. Obtienes estos beneficios:`,
            bloque('Aumento de característica', 'Tu CON aumenta en 1, hasta un máximo de 20.'),
            bloque('Fortaleza mejorada', 'Cuando usas la Fortaleza invertida, tiras {@dice 1d6} en lugar de {@dice 1d4}, y recuperas su uso al terminar un Short Rest o un Long Rest.'),
            bloque(
              'Inspiración invertida',
              'Cuando lanzas un truco, puedes tirar uno o dos de tus Hit Point Dice sin gastar. Ganas tantos HP temporales como el resultado más tu modificador de CON, y una criatura a tu elección a 30 ft (que no seas tú) sufre ese daño de Force. Esos dados quedan gastados. Usos: tu PB por Long Rest.',
            ),
          ],
          _marca: { ...marcaInv, tipo: 'plena' },
        }),
      )
    }
  }

  // Don épico: Boon of Siberys renombrado Eco del Divino
  const sib = dotesOficiales.find((f) => f.name === 'Boon of Siberys' && f.source === 'EFA')
  if (sib) {
    const ren = (x: unknown): unknown =>
      typeof x === 'string' ? x.split('Boon of Siberys').join('Eco del Divino').replace(/Siberys Dragonmark Spells/g, 'Eco del Divino') : Array.isArray(x) ? x.map(ren) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ren(v)])) : x
    res.push({ ...(ren(sib) as Crudo), name: 'Eco del Divino', source: 'SETTING', prerequisite: [{ level: 19 }] })
  }
  return res
}
