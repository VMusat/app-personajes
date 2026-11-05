// Catálogo de criaturas del DM (Bestiario): la ficha completa de cada criatura y su formato en Obsidian.
//
// En la bóveda, la ficha va en la sección «## Estadísticas» de las notas de Bestiario/ (plantilla «Criatura»):
//
// ## Estadísticas
// *Infernal Grande (Acechador), neutral malvado*
//
// - **CA:** 16 (armadura natural)
// - **PG:** 152 (16d10 + 64)
// - **Velocidad:** 50 ft
// - **Iniciativa:** +7
// - **Características:** FUE 20 · DES 16 · CON 18 · INT 14 · SAB 16 · CAR 16
// - **Salvaciones:** DES +6, SAB +6
// - **Sentidos:** visión verdadera 60 ft; Percepción pasiva 16
// - **VD:** 8 (XP 3900; BC +3)
//
// ### Rasgos / ### Acciones / ### Acciones adicionales / ### Reacciones
// - **Nombre (Recarga 5-6).** Texto.      «(N/día)» y «(Recarga X-6)» se cuentan solos en la Pantalla del DM.
// ### Acciones legendarias
// *Usos: 3 (4 en su guarida).*
// - **Nombre (Cuesta 2).** Texto.
// ### Acciones de guarida      (en la iniciativa 20, perdiendo los empates)
// ### Efectos regionales
// ### Sinergias
// - **Con [[Otra criatura]].** Qué ocurre cuando están juntas.
//
// El dominio de los acechadores va en su sección propia «## Dominio» (- **Ley.** / **Ventaja.** / **Pistas.** / **Romperla.**)
// y las tácticas en «## Tácticas».
import { parse, stringify } from 'yaml'
import type { Caracteristica } from '../datos/tipos'
import { CARACTERISTICAS } from '../datos/tipos'

export interface Entrada {
  nombre: string
  texto: string
}

export interface Criatura {
  id?: string
  nombre: string
  /** Línea de tipo: «Infernal Grande (Acechador), neutral malvado». */
  tipo?: string
  /** Frase que la resume. */
  resumen?: string
  etiqueta?: string
  tramo?: string
  habitat?: string
  vd?: string
  xp?: number
  bc?: number
  ca: number
  caTexto?: string
  pgMax: number
  /** Fórmula de PG para tirarlos («16d10+64»); si no hay, se usa pgMax. */
  pgFormula?: string
  bonoIniciativa: number
  velocidad?: string
  caracteristicas?: Partial<Record<Caracteristica, number>>
  salvaciones?: string
  habilidades?: string
  vulnerabilidades?: string
  resistencias?: string
  inmunidades?: string
  sentidos?: string
  percepcionPasiva?: number
  lenguas?: string
  equipo?: string
  rasgos?: Entrada[]
  acciones?: Entrada[]
  adicionales?: Entrada[]
  reacciones?: Entrada[]
  legendarias?: { usos: number; usosGuarida?: number; texto?: string; acciones: Entrada[] }
  guarida?: { texto?: string; acciones: Entrada[]; efectos: Entrada[] }
  /** Dominio de los acechadores: Ley, Ventaja, Pistas, Romperla. */
  dominio?: Entrada[]
  /** Qué pasa cuando comparte escena con otras criaturas (o PJs): nombre = con quién. */
  sinergias?: Entrada[]
  tacticas?: string
  /** Rasgos y acciones en texto libre (fichas antiguas, escritas a mano en la Pantalla). */
  texto?: string
  notaObsidian?: string
  actualizado?: string
}

export const criaturaVacia = (): Criatura => ({ nombre: '', ca: 10, pgMax: 10, bonoIniciativa: 0 })

export const SECCIONES_ENTRADAS = [
  { clave: 'rasgos', titulo: 'Rasgos' },
  { clave: 'acciones', titulo: 'Acciones' },
  { clave: 'adicionales', titulo: 'Acciones adicionales' },
  { clave: 'reacciones', titulo: 'Reacciones' },
] as const

const ABREV_ES: Record<Caracteristica, string> = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' }
const CAR_DE: Record<string, Caracteristica> = {
  FUE: 'str', STR: 'str', DES: 'dex', DEX: 'dex', CON: 'con', INT: 'int', SAB: 'wis', WIS: 'wis', CAR: 'cha', CHA: 'cha',
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
/** Quita los enlaces de Obsidian: [[a|b]] → b, [[a]] → a. */
export const sinEnlaces = (s: string) => s.replace(/\[\[([^\]|\\]+)\\?\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')

// ── Usos, recargas y costes, leídos del nombre de cada entrada

/** «(3/día)», «(1/Day Each)» → 3. */
export function usosPorDia(nombre: string): number | undefined {
  const m = /\((\d+)\s*\/\s*(d[ií]a|day)/i.exec(nombre)
  return m ? Number(m[1]) : undefined
}

/** «(Recarga 5-6)», «(Recharge 6)» → 5 / 6. */
export function recarga(nombre: string): number | undefined {
  const m = /\((?:recarga|recharge)\s*(\d)/i.exec(nombre)
  return m ? Number(m[1]) : undefined
}

/** «(Cuesta 2 acciones)», «(Costs 2 Actions)» → 2. */
export function coste(nombre: string): number {
  const m = /\((?:cuesta|costs?)\s*(\d)/i.exec(nombre)
  return m ? Number(m[1]) : 1
}

/** Clave estable de una entrada para guardar sus usos en el escenario. */
export const claveEntrada = (seccion: string, e: Entrada) => `${seccion}:${e.nombre.replace(/\s*\(.*$/, '').trim()}`

/** Todas las entradas con su sección (para contar usos y recargas). */
export function entradas(c: Criatura): { seccion: string; e: Entrada }[] {
  const out: { seccion: string; e: Entrada }[] = []
  for (const s of SECCIONES_ENTRADAS) for (const e of c[s.clave] ?? []) out.push({ seccion: s.clave, e })
  for (const e of c.legendarias?.acciones ?? []) out.push({ seccion: 'legendarias', e })
  return out
}

/** Nombres con los que tiene sinergia (sin enlaces ni el «Con» inicial). */
export const nombreSinergia = (e: Entrada) => sinEnlaces(e.nombre).replace(/^con\s+/i, '').replace(/[.:]$/, '').trim()

export function sinergiaActiva(e: Entrada, presentes: string[]): boolean {
  const n = norm(nombreSinergia(e))
  return !!n && presentes.some((p) => {
    const q = norm(p)
    return q === n || q.startsWith(n + ' ') || n.split(/\s*(?:,|\by\b|\bo\b)\s*/).some((x) => x && (q === x || q.startsWith(x + ' ')))
  })
}

// ── Importar desde Obsidian

function secciones(cuerpo: string, nivel: number): Record<string, string> {
  const res: Record<string, string> = {}
  const re = new RegExp(`^#{${nivel}}\\s+(.+)$`)
  let actual = '_'
  for (const linea of cuerpo.split('\n')) {
    const m = re.exec(linea)
    if (m) {
      actual = norm(m[1])
      res[actual] = ''
    } else res[actual] = (res[actual] ?? '') + linea + '\n'
  }
  return res
}

/** Entradas «- **Nombre.** texto» de una sección; lo que va antes de la primera es la introducción. */
export function leerEntradas(texto: string): { intro: string; entradas: Entrada[] } {
  const out: Entrada[] = []
  const intro: string[] = []
  for (const linea of texto.split('\n')) {
    const l = linea.replace(/^>\s?/, '')
    const m = /^\s*(?:[-*]\s+)?\*\*(.+?)\*\*\s*(.*)$/.exec(l)
    if (m && /^\s*[-*]\s+\*\*|^\*\*/.test(l.trimStart())) {
      let nombre = m[1].trim()
      let resto = m[2]
      // «**Nombre.** texto», «**Nombre:** texto» o «**Nombre**. texto»
      if (/[.:]$/.test(nombre)) nombre = nombre.slice(0, -1).trim()
      else resto = resto.replace(/^[.:]\s*/, '')
      out.push({ nombre, texto: resto.trim() })
    } else if (l.trim() && !/^<!--.*-->$/.test(l.trim())) {
      if (out.length) out[out.length - 1].texto += '\n' + l.trim().replace(/^[-*]\s+/, '• ')
      else intro.push(l.trim())
    }
  }
  return { intro: intro.join('\n').trim(), entradas: out.filter((e) => e.nombre) }
}

const numero = (s: string | undefined) => {
  const m = /-?\d+/.exec(s ?? '')
  return m ? Number(m[0]) : undefined
}

/** Lee la ficha («## Estadísticas» o «## Ficha») y lo demás que usa la app. */
export function importarCriatura(nombreArchivo: string, texto: string, existente?: Criatura): Criatura {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto.replace(/\r\n/g, '\n'))
  let fm: Record<string, unknown> = {}
  try {
    fm = (m ? parse(m[1]) : {}) ?? {}
  } catch {
    fm = {}
  }
  const cuerpo = (m ? m[2] : texto.replace(/\r\n/g, '\n')).replace(/<!--[\s\S]*?-->/g, '').replace(/%%[\s\S]*?%%/g, '')
  const titulo = /^#\s+(.+)$/m.exec(cuerpo)?.[1]?.trim()
  const sec = secciones(cuerpo, 2)
  const c: Criatura = { ...criaturaVacia(), id: existente?.id }
  c.nombre = titulo && titulo !== '{{title}}' ? titulo : nombreArchivo.replace(/\.md$/i, '')
  c.resumen = /^>\s+(?!\[!)(.+)$/m.exec(sec._ ?? '')?.[1]?.trim()
  const fmTexto = (k: string) => (fm[k] === null || fm[k] === undefined || fm[k] === '' ? undefined : sinEnlaces(String(fm[k])))
  c.etiqueta = fmTexto('etiqueta')
  c.tramo = fmTexto('tramo')
  c.habitat = fmTexto('habitat')
  c.vd = fmTexto('vd')

  const ficha = sec['estadisticas'] ?? sec['ficha'] ?? ''
  const sub = secciones(ficha, 3)
  const cabecera = sub._ ?? ''
  const tipo = /^\s*\*([^*].*?)\*\s*$/m.exec(cabecera)?.[1]
  c.tipo = tipo?.trim() ?? ([fmTexto('tipo_criatura'), c.etiqueta && `(${c.etiqueta})`].filter(Boolean).join(' ') || undefined)

  for (const e of leerEntradas(cabecera).entradas) {
    const k = norm(e.nombre)
    const v = sinEnlaces(e.texto).trim()
    if (!v || v === '—' || v === '-') continue
    if (k === 'ca' || k === 'ac' || k === 'armor class') {
      c.ca = numero(v) ?? c.ca
      c.caTexto = /\((.+)\)/.exec(v)?.[1]
    } else if (k === 'pg' || k === 'hp' || k === 'hit points' || k === 'puntos de golpe') {
      c.pgMax = numero(v) ?? c.pgMax
      const f = /\(([\dd\s+-]+)\)/i.exec(v)?.[1]
      c.pgFormula = f ? f.replace(/\s+/g, '') : undefined
    } else if (k === 'velocidad' || k === 'speed') c.velocidad = v
    else if (k === 'iniciativa' || k === 'initiative') c.bonoIniciativa = numero(v) ?? 0
    else if (k.startsWith('caracteristicas') || k === 'ability scores') {
      const cars: Partial<Record<Caracteristica, number>> = {}
      for (const x of v.matchAll(/\b(FUE|STR|DES|DEX|CON|INT|SAB|WIS|CAR|CHA)\b\s*(\d+)/gi)) cars[CAR_DE[x[1].toUpperCase()]] = Number(x[2])
      c.caracteristicas = cars
    } else if (k === 'salvaciones' || k === 'saving throws' || k === 'saves') c.salvaciones = v
    else if (k === 'habilidades' || k === 'skills') c.habilidades = v
    else if (k.startsWith('vulnerabilidad')) c.vulnerabilidades = v
    else if (k.startsWith('resistencia')) c.resistencias = v
    else if (k.startsWith('inmunidad') || k.startsWith('immunit')) c.inmunidades = c.inmunidades ? `${c.inmunidades}; ${v}` : v
    else if (k === 'sentidos' || k === 'senses') {
      c.sentidos = v
      c.percepcionPasiva = numero(/(?:percepcion pasiva|passive perception|percepcion)\s*(\d+)/i.exec(norm(v))?.[1])
    } else if (k === 'lenguas' || k === 'idiomas' || k === 'languages') c.lenguas = v
    else if (k === 'equipo' || k === 'gear') c.equipo = v
    else if (k === 'vd' || k === 'cr' || k === 'desafio') {
      c.vd = /^[\d/]+/.exec(v)?.[0] ?? c.vd
      c.xp = numero(/XP\s*([\d.,]+)/i.exec(v)?.[1]?.replace(/[.,]/g, ''))
      c.bc = numero(/(?:BC|PB)\s*([+-]?\d+)/i.exec(v)?.[1])
    }
  }
  if (!/iniciativa|initiative/i.test(cabecera) && c.caracteristicas?.dex !== undefined) c.bonoIniciativa = Math.floor((c.caracteristicas.dex - 10) / 2)

  const lista = (...claves: string[]) => {
    const t = claves.map((k) => sub[k]).find((x) => x !== undefined)
    return t === undefined ? undefined : leerEntradas(t)
  }
  for (const [clave, nombres] of [
    ['rasgos', ['rasgos', 'traits']],
    ['acciones', ['acciones', 'actions']],
    ['adicionales', ['acciones adicionales', 'bonus actions']],
    ['reacciones', ['reacciones', 'reactions']],
  ] as const) {
    const l = lista(...nombres)
    if (l?.entradas.length) c[clave] = l.entradas
  }
  const leg = lista('acciones legendarias', 'legendary actions')
  if (leg && (leg.entradas.length || leg.intro)) {
    const usos = numero(/(?:usos|uses)[^\d]*(\d+)/i.exec(leg.intro)?.[1]) ?? 3
    const usosGuarida = numero(/(\d+)[^\d]*(?:en su guarida|in (?:its |their )?lair)/i.exec(leg.intro)?.[1])
    const texto = leg.intro.replace(/^\*?(?:usos|uses)[^.]*\.\*?\s*/i, '').trim()
    c.legendarias = { usos, usosGuarida, texto: texto || undefined, acciones: leg.entradas }
  }
  const gu = lista('acciones de guarida', 'lair actions', 'guarida')
  const ef = lista('efectos regionales', 'regional effects')
  if (gu?.entradas.length || ef?.entradas.length || gu?.intro)
    c.guarida = { texto: gu?.intro || undefined, acciones: gu?.entradas ?? [], efectos: ef?.entradas ?? [] }
  const sin = lista('sinergias', 'synergies')
  if (sin?.entradas.length) c.sinergias = sin.entradas
  const libre = [sub['texto'], sub['notas']].filter(Boolean).join('\n').trim()
  if (libre) c.texto = libre

  const dom = sec['dominio'] ? leerEntradas(sec['dominio']).entradas : []
  if (dom.length) c.dominio = dom
  const tac = (sec['tacticas'] ?? '').split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).filter((l) => l && !/^<!--/.test(l))
  if (tac.length) c.tacticas = tac.join('\n')

  c.notaObsidian = nombreArchivo
  c.actualizado = new Date().toISOString()
  return c
}

// ── Exportar a Obsidian

const entradasMd = (es: Entrada[] | undefined) => (es ?? []).map((e) => `- **${e.nombre}.** ${e.texto.replace(/\n• /g, '\n  - ').replace(/\n(?! {2}- )/g, '\n  ')}`).join('\n')

/** La sección «## Estadísticas» de la nota. */
export function fichaMarkdown(c: Criatura): string {
  const l: string[] = []
  if (c.tipo) l.push(`*${c.tipo}*`, '')
  const linea = (k: string, v: string | number | undefined) => v !== undefined && v !== '' && l.push(`- **${k}:** ${v}`)
  linea('CA', `${c.ca}${c.caTexto ? ` (${c.caTexto})` : ''}`)
  linea('PG', `${c.pgMax}${c.pgFormula ? ` (${c.pgFormula.replace(/([+-])/g, ' $1 ')})` : ''}`)
  linea('Velocidad', c.velocidad)
  linea('Iniciativa', `${c.bonoIniciativa >= 0 ? '+' : ''}${c.bonoIniciativa}`)
  if (c.caracteristicas && Object.keys(c.caracteristicas).length)
    linea('Características', CARACTERISTICAS.filter((k) => c.caracteristicas?.[k] !== undefined).map((k) => `${ABREV_ES[k]} ${c.caracteristicas![k]}`).join(' · '))
  linea('Salvaciones', c.salvaciones)
  linea('Habilidades', c.habilidades)
  linea('Vulnerabilidades', c.vulnerabilidades)
  linea('Resistencias', c.resistencias)
  linea('Inmunidades', c.inmunidades)
  linea('Sentidos', [c.sentidos, c.percepcionPasiva !== undefined && !/pasiva/i.test(c.sentidos ?? '') ? `Percepción pasiva ${c.percepcionPasiva}` : ''].filter(Boolean).join('; '))
  linea('Lenguas', c.lenguas)
  linea('Equipo', c.equipo)
  if (c.vd) linea('VD', `${c.vd}${c.xp || c.bc ? ` (${[c.xp && `XP ${c.xp}`, c.bc && `BC +${c.bc}`].filter(Boolean).join('; ')})` : ''}`)
  for (const s of SECCIONES_ENTRADAS) if (c[s.clave]?.length) l.push('', `### ${s.titulo}`, entradasMd(c[s.clave]))
  if (c.legendarias) {
    l.push('', '### Acciones legendarias', `*Usos: ${c.legendarias.usos}${c.legendarias.usosGuarida ? ` (${c.legendarias.usosGuarida} en su guarida)` : ''}.*${c.legendarias.texto ? ` ${c.legendarias.texto}` : ''}`)
    if (c.legendarias.acciones.length) l.push(entradasMd(c.legendarias.acciones))
  }
  if (c.guarida) {
    l.push('', '### Acciones de guarida')
    if (c.guarida.texto) l.push(c.guarida.texto)
    if (c.guarida.acciones.length) l.push(entradasMd(c.guarida.acciones))
    if (c.guarida.efectos.length) l.push('', '### Efectos regionales', entradasMd(c.guarida.efectos))
  }
  if (c.sinergias?.length) l.push('', '### Sinergias', entradasMd(c.sinergias))
  if (c.texto) l.push('', '### Notas', c.texto)
  return l.join('\n')
}

/** Nota completa para Bestiario/ con la plantilla «Criatura». */
export function exportarCriatura(c: Criatura): string {
  const tipoCriatura = c.tipo?.split(/\s+/)[0]
  const fm = stringify({
    tipo: 'criatura', aliases: [], tags: [], tipo_criatura: tipoCriatura ?? null, etiqueta: c.etiqueta ?? null, vd: c.vd ?? null,
    tramo: c.tramo ?? null, base: null, habitat: c.habitat ?? null,
  })
  return [
    `---\n${fm}---`,
    `# ${c.nombre}`,
    '',
    `> ${c.resumen ?? 'Una frase que la resuma.'}`,
    '',
    '## Lo que se sabe públicamente',
    '- ',
    '',
    '## Estadísticas',
    fichaMarkdown(c),
    '',
    '## Tácticas',
    c.tacticas ? c.tacticas.split('\n').map((x) => `- ${x}`).join('\n') : '- ',
    '',
    '## Dominio',
    c.dominio?.length ? entradasMd(c.dominio) : '<!-- Solo acechadores: - **Ley.** / - **Ventaja.** / - **Pistas.** / - **Romperla.** (ver [[Tipos de criatura]]) -->',
    '',
    '## Ganchos',
    '- ',
    '',
    '## Secretos',
    '- ',
    '',
  ].join('\n')
}

// ── Resumen de una acción para la mesa: ataque, salvación y daño

export interface ResumenAccion {
  /** Bono de ataque. */
  ataque?: number
  /** Salvación que pide: CD y característica (FUE, DES…). */
  cd?: number
  car?: string
  /** Daño total de un golpe (las partes unidas con «y», «más» o «plus» se suman). */
  dano?: { formula: string; tipo: string }
}

// Nombres completos sin distinguir mayúsculas; abreviaturas solo en mayúsculas («con» y «fue» son palabras)
const CARS_TEXTO: [RegExp, RegExp, string][] = [
  [/\b(fuerza|strength)\b/i, /\b(FUE|STR)\b/, 'FUE'],
  [/\b(destreza|dexterity)\b/i, /\b(DES|DEX)\b/, 'DES'],
  [/\b(constituci[oó]n|constitution)\b/i, /\bCON\b/, 'CON'],
  [/\b(inteligencia|intelligence)\b/i, /\bINT\b/, 'INT'],
  [/(\bsabidur[ií]a|\bwisdom)\b/i, /\b(SAB|WIS)\b/, 'SAB'],
  [/\b(carisma|charisma)\b/i, /\b(CAR|CHA)\b/, 'CAR'],
]
/** La característica que se nombra primero en el texto. */
function carDe(s: string): string | undefined {
  let mejor: { car: string; i: number } | undefined
  for (const [nombre, abrev, car] of CARS_TEXTO)
    for (const re of [nombre, abrev]) {
      const i = s.search(re)
      if (i >= 0 && (!mejor || i < mejor.i)) mejor = { car, i }
    }
  return mejor?.car
}

export function resumenAccion(e: Entrada): ResumenAccion {
  const t = sinEnlaces(e.texto).replace(/[−–]/g, '-')
  const out: ResumenAccion = {}
  const a = /(?:^|[\s(])([+-]\d+)\s*(?=,|para impactar|to hit|\))/i.exec(t) ?? /(?:Roll|ataque|impactar):\s*([+-]\d+)/i.exec(t)
  if (a) out.ataque = Number(a[1])
  const cd = /\b(?:CD|DC)\s*(\d+)/.exec(t)
  if (cd) {
    out.cd = Number(cd[1])
    const alrededor = t.slice(Math.max(0, cd.index - 40), cd.index + 40)
    out.car = carDe(alrededor)
  }
  const re = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\)?\s*(?:de daño\s+|damage\s+)?([a-záéíóúñü]+)?/gi
  const partes: { formula: string; tipo?: string; ini: number; fin: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const tipo = m[2] && !/^(de|y|and|plus|m[aá]s|a|en|si|if|or|o)$/i.test(m[2]) ? m[2].toLowerCase() : undefined
    partes.push({ formula: m[1].replace(/\s+/g, ''), tipo, ini: m.index, fin: m.index + m[0].length })
  }
  if (partes.length) {
    const golpe = [partes[0]]
    for (let i = 1; i < partes.length; i++) {
      const entre = t.slice(partes[i - 1].fin, partes[i].ini)
      if (entre.length < 30 && !/[.;:]/.test(entre) && /\b(y|más|mas|plus|and)\b/i.test(entre)) golpe.push(partes[i])
      else break
    }
    out.dano = { formula: golpe.map((p) => p.formula).join('+'), tipo: golpe.map((p) => p.tipo).filter(Boolean).join(' + ') }
  }
  return out
}
