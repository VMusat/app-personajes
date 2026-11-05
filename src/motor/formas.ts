// Formas de Wild Shape (reglas de 2024): las bestias de los bestiarios activos (XMM, XDMG) que admite el setting,
// el límite de VD y de vuelo según el nivel de druida (y el Círculo de la Luna), y la forma lista para la hoja.
import type { Crudo } from '../datos/tipos'
import type { Hoja } from './derivar'
import type { Forma } from './personaje'
import setting from '../setting/formas.json'

export interface EntradaForma {
  nombre: string
  texto: string
}

export interface Bestia {
  /** nombre|fuente de 5etools. */
  clave: string
  nombre: string
  /** Nombre en el setting. */
  nombreEs?: string
  cr: number
  crTexto: string
  tamaño: string
  ca: number
  pg: number
  velocidad: string
  vuela: boolean
  nada: boolean
  fue: number
  des: number
  con: number
  sentidos?: string
  habilidades?: string
  /** Dónde se encuentra (en el setting). */
  entornos: string[]
  rasgos: EntradaForma[]
  acciones: EntradaForma[]
}

const TAMAÑO: Record<string, string> = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' }
const SALVACION: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const EXCLUIDAS = new Set(setting.excluir.nombres)
const NOMBRES: Record<string, string> = setting.nombres
const ENTORNOS: Record<string, string> = setting.entornos

const crNumero = (cr: string) => (cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr))
export const textoCr = (cr: number) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr))

/** Texto de 5etools sin etiquetas, con los ataques en el formato que entiende TextoConDados. */
export function textoBestia(s: string): string {
  return s
    .replace(/\{@atkr ([^}]*)\}/g, (_, t: string) => `${t.split(',').map((x) => (x.trim() === 'r' ? 'Ranged' : 'Melee')).join(' or ')} Attack Roll:`)
    .replace(/\{@hit (-?\d+)\}/g, (_, n: string) => (Number(n) < 0 ? n : `+${n}`))
    .replace(/\{@h\}/g, 'Hit: ')
    .replace(/\{@dc (\d+)\}/g, 'DC $1')
    .replace(/\{@recharge (\d)\}/g, (_, n: string) => `(Recharge ${n}–6)`)
    .replace(/\{@recharge\}/g, '(Recharge 6)')
    .replace(/\{@actSave (\w+)\}/g, (_, c: string) => `${SALVACION[c] ?? c} Saving Throw:`)
    .replace(/\{@actSaveFail( \d+)?\}/g, 'Failure:')
    .replace(/\{@actSaveSuccess\}/g, 'Success:')
    .replace(/\{@actSaveSuccessOrFail\}/g, 'Failure or Success:')
    .replace(/\{@actTrigger\}/g, 'Trigger:')
    .replace(/\{@actResponse\}/g, 'Response:')
    .replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
    .replace(/\{@\w+\}/g, '')
}

function textoEntradas(e: unknown): string {
  if (typeof e === 'string') return textoBestia(e)
  if (Array.isArray(e)) return e.map(textoEntradas).filter(Boolean).join('\n')
  if (e && typeof e === 'object') {
    const o = e as Crudo
    if (o.items) return (o.items as unknown[]).map((i) => `• ${textoEntradas(i)}`).join('\n')
    const cuerpo = textoEntradas(o.entries ?? o.entry ?? '')
    return o.name ? `${textoBestia(String(o.name))}. ${cuerpo}` : cuerpo
  }
  return ''
}

const entradasDe = (lista: unknown, prefijo = ''): EntradaForma[] =>
  ((lista as Crudo[] | undefined) ?? []).map((x) => ({ nombre: prefijo + textoBestia(String(x.name ?? '')), texto: textoEntradas(x.entries) }))

function velocidadDe(v: Crudo | undefined): string {
  if (!v) return '30 ft'
  const pies = (x: unknown) => (typeof x === 'number' ? x : (x as Crudo)?.number)
  const partes: string[] = []
  if (v.walk !== undefined) partes.push(`${pies(v.walk)} ft`)
  for (const [k, n] of [['burrow', 'Burrow'], ['climb', 'Climb'], ['fly', 'Fly'], ['swim', 'Swim']] as const)
    if (v[k] !== undefined) partes.push(`${n} ${pies(v[k])} ft${v.canHover && k === 'fly' ? ' (hover)' : ''}`)
  return partes.join(', ')
}

/** Bestias de los bestiarios de 5etools (contenido de los archivos `bestiary-*.json`) que admite el setting. */
export function procesarBestias(archivos: Crudo[]): Bestia[] {
  const out: Bestia[] = []
  for (const a of archivos)
    for (const m of (a.monster as Crudo[] | undefined) ?? []) {
      const tipo = typeof m.type === 'string' ? m.type : m.type?.type
      // Sin enjambres (no son una sola bestia) ni las que excluye el setting
      if (tipo !== 'beast' || (m.type as Crudo)?.swarmSize || EXCLUIDAS.has(m.name) || m._copy) continue
      const crT = String(typeof m.cr === 'object' ? m.cr.cr : m.cr ?? '')
      if (!crT) continue
      const ac = Array.isArray(m.ac) ? m.ac[0] : m.ac
      const pasiva = m.passive !== undefined ? `Passive Perception ${m.passive}` : ''
      out.push({
        clave: `${m.name}|${m.source}`.toLowerCase(),
        nombre: m.name,
        nombreEs: NOMBRES[m.name],
        cr: crNumero(crT),
        crTexto: crT,
        tamaño: ((m.size as string[] | undefined) ?? ['M']).map((t) => TAMAÑO[t] ?? t).join('/'),
        ca: typeof ac === 'number' ? ac : Number(ac?.ac) || 10,
        pg: Number(m.hp?.average) || 1,
        velocidad: velocidadDe(m.speed),
        vuela: m.speed?.fly !== undefined,
        nada: m.speed?.swim !== undefined,
        fue: m.str, des: m.dex, con: m.con,
        sentidos: [...((m.senses as string[] | undefined) ?? []).map(textoBestia), pasiva].filter(Boolean).join(', ') || undefined,
        habilidades: m.skill ? Object.entries(m.skill as Record<string, string>).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} ${v}`).join(', ') : undefined,
        entornos: [...new Set(((m.environment as string[] | undefined) ?? []).map((e) => ENTORNOS[e] ?? e))],
        rasgos: entradasDe(m.trait),
        acciones: [...entradasDe(m.action), ...entradasDe(m.bonus, 'Bonus Action: '), ...entradasDe(m.reaction, 'Reaction: ')],
      })
    }
  return out.sort((a, b) => a.cr - b.cr || (a.nombreEs ?? a.nombre).localeCompare(b.nombreEs ?? b.nombre, 'es'))
}

export interface LimiteWildShape {
  nivel: number
  luna: boolean
  crMax: number
  vuelo: boolean
  /** Formas que conoce el druida. */
  conocidas: number
  pgTemporales: number
  /** Círculo de la Luna: AC mínima de la forma (13 + Sabiduría). */
  caMinima?: number
}

/** Límites de Wild Shape del PJ (tabla del druida de 2024 y Circle Forms del Círculo de la Luna). */
export function limiteWildShape(h: Hoja): LimiteWildShape | undefined {
  const c = h.resolucion.clases.find((x) => x.clase.name === 'Druid')
  if (!c || c.nivel < 2) return undefined
  const n = c.nivel
  const luna = c.subclase?.shortName === 'Moon' && n >= 3
  const base = n >= 8 ? 1 : n >= 4 ? 0.5 : 0.25
  return {
    nivel: n,
    luna,
    crMax: luna ? Math.max(base, Math.floor(n / 3)) : base,
    vuelo: n >= 8,
    conocidas: n >= 8 ? 8 : n >= 4 ? 6 : 4,
    pgTemporales: luna ? 3 * n : n,
    caMinima: luna ? 13 + h.car.wis.mod : undefined,
  }
}

export const bestiaPermitida = (b: Bestia, l: LimiteWildShape) => b.cr <= l.crMax && (l.vuelo || !b.vuela)

export const nombreBestia = (b: Bestia) => (b.nombreEs ? `${b.nombreEs} (${b.nombre})` : b.nombre)

/** La forma lista para guardar en la hoja. */
export function formaDeBestia(b: Bestia, l?: LimiteWildShape): Forma {
  const caLuna = l?.caMinima !== undefined && l.caMinima > b.ca
  return {
    nombre: b.nombreEs ?? b.nombre,
    ref: b.clave,
    cr: b.crTexto,
    tamaño: b.tamaño,
    ca: caLuna ? l!.caMinima : b.ca,
    velocidad: b.velocidad,
    fue: b.fue, des: b.des, con: b.con,
    sentidos: b.sentidos,
    habilidades: b.habilidades,
    rasgos: b.rasgos,
    acciones: b.acciones,
    notas: caLuna ? `AC 13 + Sabiduría (Circle Forms); la bestia tiene AC ${b.ca}` : undefined,
    desde: new Date().toISOString(),
  }
}
