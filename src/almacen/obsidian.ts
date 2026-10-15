// Importación y exportación de objetos de campaña como notas de Obsidian (plantilla «Objeto» de la bóveda).
// La parte mecánica va en la propiedad «mecanica» del frontmatter:
//
// mecanica:
//   tipo: anillo            # arma | armadura | escudo | maravilloso | anillo | varita | bastón | vara | poción | pergamino | otro
//   base: longsword|xphb    # objeto base de 5etools (armas y armaduras)
//   cargas: { max: 3, recarga: amanecer }
//   efectos:
//     - { tipo: bono, objetivo: ca, valor: 1 }
//     - { tipo: conjuro, conjuro: misty step|xphb, usos: 1, recarga: largo }
import { parse, stringify } from 'yaml'
import { objetoVacio, type ObjetoCampaña, type Rareza } from './objetosCampaña'
import type { Efecto } from '../motor/efectos'

const RAREZA_ES: Record<string, Rareza> = {
  común: 'common', comun: 'common', 'poco común': 'uncommon', 'poco comun': 'uncommon', raro: 'rare', 'muy raro': 'very rare',
  legendario: 'legendary', artefacto: 'artifact',
}
const RAREZA_A_ES: Record<Rareza, string> = { common: 'común', uncommon: 'poco común', rare: 'raro', 'very rare': 'muy raro', legendary: 'legendario', artifact: 'artefacto' }

function secciones(cuerpo: string): Record<string, string> {
  const res: Record<string, string> = {}
  let actual = '_'
  for (const linea of cuerpo.split('\n')) {
    const m = /^##\s+(.+)$/.exec(linea)
    if (m) {
      actual = m[1].trim().toLowerCase()
      res[actual] = ''
    } else res[actual] = (res[actual] ?? '') + linea + '\n'
  }
  return res
}

/** Quita la sintaxis de Obsidian que no tiene sentido en la app ([[enlace|texto]] → texto). */
const limpiar = (s: string) =>
  s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export function importarNota(nombreArchivo: string, texto: string, existente?: ObjetoCampaña): ObjetoCampaña {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto.replace(/\r\n/g, '\n'))
  const fm = (m ? parse(m[1]) : {}) ?? {}
  const cuerpo = m ? m[2] : texto
  const titulo = /^#\s+(.+)$/m.exec(cuerpo)?.[1]?.trim()
  const sec = secciones(cuerpo)
  const mec = (fm.mecanica ?? {}) as Partial<ObjetoCampaña> & { efectos?: Efecto[] }
  const o = existente ? { ...existente } : objetoVacio()
  o.nombre = titulo && titulo !== '{{title}}' ? titulo : nombreArchivo.replace(/\.md$/i, '')
  const r = String(fm.rareza ?? '').toLowerCase().trim()
  o.rareza = RAREZA_ES[r] ?? ((['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'] as string[]).includes(r) ? (r as Rareza) : o.rareza)
  o.sintonizacion = fm.sintonizacion === true || fm.sintonizacion === 'true'
  if (mec.tipo) o.tipo = mec.tipo
  if (mec.base) o.base = mec.base
  if (mec.cargas) o.cargas = mec.cargas
  if (mec.sintonizacionRequisito) o.sintonizacionRequisito = mec.sintonizacionRequisito
  o.efectos = (mec.efectos ?? []).map((e) => ({ ...e, valor: (e as { valor?: unknown }).valor }) as Efecto)
  o.descripcion = limpiar([sec['descripción'] ?? sec.descripcion ?? '', sec['propiedades mecánicas'] ?? ''].filter(Boolean).join('\n\n'))
  o.secreto = limpiar(sec.secretos ?? '') || undefined
  o.notaObsidian = nombreArchivo
  o.actualizado = new Date().toISOString()
  return o
}

export function exportarNota(o: ObjetoCampaña): string {
  const mecanica: Record<string, unknown> = { tipo: o.tipo }
  if (o.base) mecanica.base = o.base
  if (o.sintonizacionRequisito) mecanica.sintonizacionRequisito = o.sintonizacionRequisito
  if (o.cargas) mecanica.cargas = o.cargas
  if (o.efectos.length) mecanica.efectos = o.efectos.map((e) => Object.fromEntries(Object.entries(e).filter(([k, v]) => v !== undefined && k !== 'origen')))
  const fm = stringify({ tipo: 'objeto', aliases: [], tags: [], rareza: RAREZA_A_ES[o.rareza], sintonizacion: o.sintonizacion, portador: null, ubicacion: null, mecanica })
  return `---\n${fm}---\n# ${o.nombre}\n\n## Descripción\n${o.descripcion}\n\n## Propiedades mecánicas\n${describirEfectos(o)}\n\n## Historia\n\n## Secretos\n${o.secreto ? o.secreto : '- '}\n`
}

export function describirEfectos(o: ObjetoCampaña): string {
  const l: string[] = []
  if (o.sintonizacion) l.push(`- Requiere sintonización${o.sintonizacionRequisito ? ` ${o.sintonizacionRequisito}` : ''}.`)
  if (o.cargas) l.push(`- ${o.cargas.max} cargas; se recuperan ${o.cargas.recarga === 'amanecer' ? 'al amanecer' : o.cargas.recarga === 'largo' ? 'tras un descanso largo' : 'tras un descanso corto'}${o.cargas.recupera ? ` (${o.cargas.recupera})` : ''}.`)
  for (const e of o.efectos) l.push(`- ${describirEfecto(e)}`)
  return l.join('\n')
}

export function describirEfecto(e: Efecto): string {
  switch (e.tipo) {
    case 'bono': return `${Number(e.valor) >= 0 ? '+' : ''}${e.valor} a ${e.objetivo}${e.condicion ? ` (${e.condicion})` : ''}`
    case 'caracteristica': return `+${e.valor} ${e.car.toUpperCase()} (máx. ${e.max ?? 20})`
    case 'fijarCaracteristica': return `${e.car.toUpperCase()} pasa a ser ${e.valor}`
    case 'resistencia': return `Resistencia a ${e.valor}`
    case 'inmunidad': return `Inmunidad a ${e.valor}`
    case 'vulnerabilidad': return `Vulnerabilidad a ${e.valor}`
    case 'inmunidadCondicion': return `Inmunidad a la condición ${e.valor}`
    case 'competencia': return `Competencia (${e.categoria}): ${e.valor}`
    case 'pericia': return `Expertise: ${e.valor}`
    case 'conjuro': return `Conjuro: ${e.conjuro.split('|')[0]}${e.usos ? ` (${e.usos}/${e.recarga ?? 'largo'})` : ''}${e.cd ? `, DC ${e.cd}` : ''}`
    case 'ataque': return `Ataque: ${e.nombre} (${e.dano} ${e.tipoDano})`
    case 'velocidad': return `Velocidad ${e.modo ?? 'andar'} ${e.fijar ? '=' : '+'}${e.valor} ft`
    case 'sentido': return `${e.nombre} ${e.valor} ft`
    case 'recurso': return `${e.nombre}: ${e.usos} usos (${e.recarga})`
    case 'caBase': return `AC base: ${e.formula}`
    case 'nota': return e.texto
    default: return e.tipo
  }
}
