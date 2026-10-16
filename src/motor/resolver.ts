// El resolvedor recorre todo lo que el personaje ha obtenido (especie, trasfondo, niveles de clase,
// dotes, rasgos y opciones) y produce:
//  - la lista de elecciones, con el valor guardado de cada una y si falta completarla;
//  - los efectos mecánicos, rasgos, conjuros y dotes resultantes.
// Las elecciones pendientes de un nivel son las que el asistente de subida de nivel pide rellenar.
import type { Caracteristica, Clase, Conjuro, Crudo, Datos, Entidad, Rasgo, Subclase } from '../datos/tipos'
import { CARACTERISTICAS } from '../datos/tipos'
import { claveDeRef, claveRasgoClase, claveRasgoSubclase } from '../datos/refs'
import type { Efecto, Formula, Recarga } from './efectos'
import type { Personaje } from './personaje'
import { modificador } from './personaje'
import { RASGOS_MANUALES, claveManual, type EleccionManual } from './rasgosManuales'
import { DOTES_MANUALES } from './dotesManuales'
import { MECANICAS, MECANICAS_ESPECIE } from './mecanicas'
import { filtrarConjuros, parsearFiltro, resolverBloque, type FiltroConjuros } from './conjurosAdicionales'
import { evaluar } from './formula'
import campaña from '../setting/campaña.json'
import { ASPECTOS, nombreMarcaInvertida, nombreMarcaManifiesta, nombreMarcaPlena } from '../setting/marcas'

export interface Opcion {
  valor: string
  etiqueta: string
  detalle?: string
  grupo?: string
  /** No se puede elegir porque ya se tiene por otra vía (p. ej. un conjuro de la especie o de una dote). */
  bloqueada?: string
}

/** Conjuro que el personaje ya tiene por otra vía, para mostrarlo en las listas de su clase. */
export interface ConjuroFijo {
  clave: string
  nombre: string
  nivel: number
  origen: string
  /** «siempre preparado», «en tu libro», «1/Long Rest»... */
  como: string
}

export type TipoEleccionMotor =
  | 'subclase' | 'dote' | 'aumento' | 'variante' | 'caracteristicaConjuro' | 'pg' | 'opcional' | 'rasgo'
  | 'equipo' | 'trucos' | 'preparados' | 'libro' | 'conjuro' | 'habilidad' | 'pericia' | 'herramienta'
  | 'idioma' | 'maestria' | 'resistencia' | 'salvacion' | 'opcion' | 'texto' | 'plano' | 'alternativa'

export interface Eleccion {
  id: string
  tipo: TipoEleccionMotor
  etiqueta: string
  /** Texto que agrupa la elección («Guerrero nivel 3», «Especie», «Dote: Alert»...). */
  origen: string
  /** Nivel de personaje en el que aparece (0: creación del personaje). */
  nivel: number
  n: number
  opciones: Opcion[]
  valor: string[]
  completa: boolean
  cambia?: 'largo' | 'corto' | 'nivel'
  meta?: Crudo
}

export interface RasgoObtenido {
  nombre: string
  origen: string
  nivel: number
  entries: unknown[]
  tipo: 'clase' | 'subclase' | 'especie' | 'trasfondo' | 'dote' | 'opcional' | 'marca'
  ref?: string
}

export interface ConjuroObtenido {
  clave: string
  origen: string
  /** Siempre preparado (no cuenta para el límite de preparados). */
  siempre: boolean
  /** Usos sin espacio: número, «voluntad» o fórmula que depende de las características finales. */
  usos?: number | 'voluntad' | string
  recarga?: Recarga
  caracteristica?: Caracteristica
  ritual?: boolean
  /** Clase (nombre inglés) cuya característica de conjuros usa, si no hay una propia. */
  clase?: string
  recurso?: string
  /** Conjuro añadido al libro de hechizos (mago): se puede preparar, no está siempre preparado. */
  enLibro?: boolean
}

export interface InfoClase {
  clase: Clase
  nivel: number
  subclase?: Subclase
  /** Lanzador: progresión y característica (de la clase o de la subclase). */
  lanzador?: { progresion: string; caracteristica: Caracteristica; lista: string; fuente: Crudo }
}

export interface Resolucion {
  nivel: number
  elecciones: Eleccion[]
  efectos: Efecto[]
  rasgos: RasgoObtenido[]
  conjuros: ConjuroObtenido[]
  dotes: Entidad[]
  opcionales: Entidad[]
  clases: InfoClase[]
  /** Aumentos de característica con su máximo. */
  aumentos: { car: Caracteristica; valor: number; max: number; origen: string }[]
  /** Conjuros añadidos a la lista de cada clase (marcas, secretos mágicos...). */
  listasAmpliadas: Record<string, string[]>
  /** Opción de equipo inicial elegida en cada origen. */
  equipo: { origen: string; items: Crudo[] }[]
  /** PG ganados por nivel (sin CON). */
  pgPorNivel: number[]
  /** Tamaño de la especie (elegido si la especie permite varios). */
  tamaño?: { valor: 'S' | 'M'; nombre: string; altura?: string }
}

const NOMBRE_CAR: Record<Caracteristica, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

const titulo = (s: string) => s.replace(/(^|\s|-)\S/g, (m) => m.toUpperCase())

/** Contexto mutable durante una resolución. */
class Ctx {
  r: Resolucion
  vistos = new Set<string>()
  p: Personaje
  d: Datos
  constructor(p: Personaje, d: Datos) {
    this.p = p
    this.d = d
    this.r = {
      nivel: p.niveles.length,
      elecciones: [],
      efectos: [],
      rasgos: [],
      conjuros: [],
      dotes: [],
      opcionales: [],
      clases: [],
      aumentos: [],
      listasAmpliadas: {},
      equipo: [],
      pgPorNivel: [],
      tamaño: undefined,
    }
  }

  /** Registra una elección y devuelve sus valores válidos. */
  elegir(e: Omit<Eleccion, 'valor' | 'completa'>, validar = true): string[] {
    const guardado = this.p.elecciones[e.id] ?? []
    if (e.tipo === 'idioma') {
      // Idiomas que ya conoce (cerinés, los de su especie, los de otros rasgos): se muestran y no se pueden repetir
      const conocidos = this.r.efectos.filter((x) => x.tipo === 'competencia' && x.categoria === 'idioma') as { valor: string; origen?: string }[]
      e = {
        ...e,
        opciones: e.opciones.map((o) => {
          const ya = conocidos.find((c) => c.valor === o.valor)
          return ya && !guardado.includes(o.valor) ? { ...o, bloqueada: `Ya lo conoces (${ya.origen})` } : o
        }),
        meta: { ...e.meta, conocidos: conocidos.map((c) => ({ nombre: c.valor, origen: c.origen ?? '' })) },
      }
    }
    const validos = new Set(e.opciones.map((o) => o.valor))
    const valor = validar && e.tipo !== 'texto' && e.tipo !== 'pg' && e.tipo !== 'aumento'
      ? guardado.filter((v) => validos.has(v)).slice(0, e.n)
      : guardado
    const completa = e.tipo === 'aumento' ? !!e.meta?.valido?.(valor) : valor.length >= Math.min(e.n, e.opciones.length || e.n)
    this.r.elecciones.push({ ...e, valor, completa })
    return valor
  }

  efecto(e: Efecto, origen: string) {
    if (e.tipo === 'conjuro') {
      const prev = this.r.conjuros.find((c) => c.clave === e.conjuro && c.siempre)
      const usos = e.usos as number | string | undefined
      if (prev) Object.assign(prev, { usos: usos ?? prev.usos, recarga: e.recarga ?? prev.recarga })
      else this.r.conjuros.push({ clave: e.conjuro, origen: e.origen ?? origen, siempre: e.siempre ?? true, usos, recarga: e.recarga, caracteristica: e.caracteristica })
      return
    }
    this.r.efectos.push({ ...e, origen: e.origen ?? origen })
  }

  vars(nivelClase?: Record<string, number>) {
    return (n: string) => {
      if (n === 'pb') return 2 + Math.floor((Math.max(1, this.r.nivel) - 1) / 4)
      if (n === 'nivel') return this.r.nivel
      if ((CARACTERISTICAS as string[]).includes(n)) return modificador(this.p.caracteristicas.base[n as Caracteristica] ?? 10)
      if (n.startsWith('nivel:')) return nivelClase?.[n.slice(6)] ?? 0
      return 0
    }
  }
}

// ── Utilidades de proficiencias de 5etools

const HERRAMIENTAS_ARTESANO = [
  "alchemist's supplies", "brewer's supplies", "calligrapher's supplies", "carpenter's tools", "cartographer's tools",
  "cobbler's tools", "cook's utensils", "glassblower's tools", "jeweler's tools", "leatherworker's tools", "mason's tools",
  "painter's supplies", "potter's tools", "smith's tools", "tinker's tools", "weaver's tools", "woodcarver's tools",
]
const INSTRUMENTOS = ['bagpipes', 'drum', 'dulcimer', 'flute', 'horn', 'lute', 'lyre', 'pan flute', 'shawm', 'viol']
const JUEGOS = ['dice set', 'dragonchess set', 'playing card set', 'three-dragon ante set']
const OTRAS_HERRAMIENTAS = ['disguise kit', 'forgery kit', 'herbalism kit', "navigator's tools", "poisoner's kit", "thieves' tools"]
export const TODAS_HERRAMIENTAS = [...HERRAMIENTAS_ARTESANO, ...OTRAS_HERRAMIENTAS, ...INSTRUMENTOS, ...JUEGOS]
const TIPOS_DANO = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']

function opcionesHerramienta(tipo: string): string[] {
  if (tipo === 'anyArtisansTool' || tipo === 'artesano') return HERRAMIENTAS_ARTESANO
  if (tipo === 'anyMusicalInstrument') return INSTRUMENTOS
  if (tipo === 'anyGamingSet') return JUEGOS
  return TODAS_HERRAMIENTAS
}

function idiomasDisponibles(tipo: 'estandar' | 'todas'): Opcion[] {
  const l = campaña.lenguas
  const est = l.estandar.map((x) => ({ valor: x.nombre, etiqueta: x.nombre, detalle: x.donde, grupo: 'Estándar' }))
  if (tipo === 'estandar') return est
  return [...est, ...l.raras.map((x) => ({ valor: x.nombre, etiqueta: x.nombre, detalle: x.donde, grupo: 'Raras' }))]
}

/** Traduce un idioma de 5etools al del setting. */
export function idiomaSetting(nombre: string): string {
  const n = nombre.toLowerCase()
  const l = campaña.lenguas
  if (n === 'common') return l.comun.nombre
  const todos = [...l.estandar, ...l.raras] as { nombre: string; original?: string }[]
  return todos.find((x) => x.original?.toLowerCase() === n)?.nombre ?? titulo(nombre)
}

export function nombreHabilidad(d: Datos, clave: string): string {
  return d.habilidades.find((h) => h.clave === clave)?.nombre ?? titulo(clave)
}

// ── Recorrido principal

export function resolver(p: Personaje, d: Datos): Resolucion {
  const ctx = new Ctx(p, d)
  const especie = d.especies.find((e) => e._clave === p.especie)
  const trasfondo = d.trasfondos.find((t) => t._clave === p.trasfondo)

  // Idiomas base: cerinés (común), los propios de la especie (setting) y dos estándar
  ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: campaña.lenguas.comun.nombre }, 'Lengua común')
  for (const l of (especie?._idiomas as string[]) ?? []) ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: l }, `Especie: ${especie!._nombre}`)
  for (const v of ctx.elegir({
    id: 'base:idiomas', tipo: 'idioma', etiqueta: 'Idiomas (dos estándar)', origen: 'Personaje', nivel: 0, n: 2,
    opciones: idiomasDisponibles('estandar'),
  })) ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: v }, 'Personaje')

  if (especie) procesarEspecie(ctx, especie)
  if (trasfondo) procesarTrasfondo(ctx, trasfondo)
  procesarMarcaCampaña(ctx)
  procesarClases(ctx)
  return ctx.r
}

/** Marca un recurso con el rasgo, dote o especie del que sale (para mostrarlo junto al rasgo). */
const conRasgo = (e: Efecto, rasgo: string): Efecto => (e.tipo === 'recurso' && !e.rasgo ? { ...e, rasgo } : e)

function procesarEspecie(ctx: Ctx, e: Entidad) {
  const origen = `Especie: ${e._nombre}`
  for (const x of e.entries ?? []) {
    if (typeof x !== 'object' || !x.name) continue
    const m = MECANICAS_ESPECIE[`${e.name}|${x.name}`]
    if (m?.nivelMin && ctx.r.nivel < m.nivelMin) continue
    ctx.r.rasgos.push({ nombre: x.name, origen, nivel: m?.nivelMin ?? 0, entries: x.entries ?? [], tipo: 'especie' })
    for (const ef of m?.efectos ?? []) ctx.efecto(conRasgo(ef, x.name), origen)
    if (m?.eleccion) {
      const [v] = ctx.elegir({
        id: `esp:${x.name}`, tipo: 'opcion', etiqueta: m.eleccion.etiqueta, origen, nivel: 0, n: 1,
        opciones: Object.keys(m.eleccion.opciones).map((k) => ({ valor: k, etiqueta: k })),
      })
      for (const ef of m.eleccion.opciones[v] ?? []) ctx.efecto(conRasgo(ef, x.name), origen)
    }
  }
  ctx.efecto({ tipo: 'velocidad', valor: typeof e.speed === 'number' ? e.speed : e.speed?.walk ?? 30, fijar: true }, origen)
  if (typeof e.speed === 'object') {
    for (const [modo, v] of Object.entries(e.speed as Crudo)) {
      const m = { swim: 'nado', fly: 'vuelo', climb: 'trepar', burrow: 'excavar' }[modo] as 'nado' | undefined
      if (m) ctx.efecto({ tipo: 'velocidad', modo: m, valor: v === true ? 'velocidad' : Number(v), fijar: true }, origen)
    }
  }
  if (e.darkvision) ctx.efecto({ tipo: 'sentido', nombre: 'Darkvision', valor: e.darkvision }, origen)
  // Tamaño: algunas especies dejan elegir entre Medium y Small (en 2024 no cambia las reglas de combate,
  // pero sí el espacio que ocupa, a quién puede agarrar y cómo lo ve el mundo)
  const tamaños = tamañosEspecie(e)
  if (tamaños.length > 1) {
    const [v] = ctx.elegir({
      id: 'esp:tamaño', tipo: 'opcion', etiqueta: 'Tamaño', origen, nivel: 0, n: 1,
      opciones: tamaños.map((t) => ({ valor: t.valor, etiqueta: t.nombre, detalle: t.altura ? `Unos ${t.altura} de altura` : undefined })),
    })
    ctx.r.tamaño = tamaños.find((t) => t.valor === v)
  } else ctx.r.tamaño = tamaños[0]
  // Variante (linaje / legado / ascendencia)
  const nombres = (e.additionalSpells ?? []).map((b: Crudo) => b.name).filter(Boolean)
  let bloques: Crudo[] = e.additionalSpells ?? []
  if (nombres.length > 1) {
    const [v] = ctx.elegir({ id: 'esp:variante', tipo: 'variante', etiqueta: 'Linaje', origen, nivel: 0, n: 1, opciones: nombres.map((n: string) => ({ valor: n, etiqueta: n })) })
    bloques = bloques.filter((b) => b.name === v)
  }
  procesarProficiencias(ctx, e, 'esp', origen, 0)
  procesarAdicionales(ctx, bloques, 'esp', origen, ctx.r.nivel, 0)
  // Dotes de la especie (humano: una dote de origen)
  procesarDotesDe(ctx, e.feats, 'esp', origen, 0)
}

/** Tamaños posibles de una especie, con la altura que da 5etools («Medium (about 4-7 feet tall)»). */
export function tamañosEspecie(e: Crudo): { valor: 'S' | 'M'; nombre: string; altura?: string }[] {
  const texto = JSON.stringify(e.sizeEntry ?? '')
  return ((e.size as string[]) ?? ['M']).map((s) => {
    const nombre = s === 'S' ? 'Small' : s === 'M' ? 'Medium' : s
    const m = new RegExp(`${nombre} \\(about ([^)]+?) feet tall\\)`).exec(texto)
    return { valor: s as 'S' | 'M', nombre, altura: m ? `${m[1].replace(/[-–]/, '–')} ft` : undefined }
  })
}

function procesarTrasfondo(ctx: Ctx, t: Entidad) {
  const origen = `Trasfondo: ${t._nombre}`
  ctx.r.rasgos.push({ nombre: t._nombre, origen, nivel: 0, entries: t.entries ?? [], tipo: 'trasfondo' })
  procesarAumento(ctx, t.ability, 'tra:aumento', origen, 0, 'Aumentos de característica del trasfondo')
  procesarProficiencias(ctx, t, 'tra', origen, 0)
  // Dote de origen: la del trasfondo o la marca manifiesta del aspecto
  const dotes = (t.feats ?? []) as Crudo[]
  const original = dotes.flatMap((f) => Object.keys(f))[0]
  const marca = ctx.p.aspecto ? marcaManifiesta(ctx.d, ctx.p.aspecto) : undefined
  if (original && marca && !original.endsWith('|setting')) {
    const dOrig = buscarDote(ctx.d, original)
    const [v] = ctx.elegir({
      id: 'tra:dote', tipo: 'alternativa', etiqueta: 'Dote de origen', origen, nivel: 0, n: 1,
      opciones: [
        { valor: 'original', etiqueta: dOrig?._nombre ?? original },
        { valor: 'marca', etiqueta: marca._nombre, detalle: 'Marca manifiesta de tu aspecto en lugar de la dote del trasfondo' },
      ],
    })
    if (v === 'marca') procesarDote(ctx, marca, 'tra:marca', origen, 0)
    else if (v === 'original') procesarDotesDe(ctx, dotes, 'tra', origen, 0)
  } else {
    procesarDotesDe(ctx, dotes, 'tra', origen, 0)
  }
  if (t.startingEquipment) procesarEquipo(ctx, t.startingEquipment, 'tra:equipo', origen)
}

/**
 * Regla de campaña (secreta para los jugadores hasta que ocurre): al llegar a nivel 4 la marca despierta.
 * Quien no tenía marca manifiesta la obtiene; quien ya la tenía obtiene la marca plena. Es una dote gratis.
 */
export const NIVEL_DESPERTAR = 4
function procesarMarcaCampaña(ctx: Ctx) {
  if (ctx.r.nivel < NIVEL_DESPERTAR || !ctx.p.aspecto) return
  const origen = 'Despertar de la marca'
  const yaTiene = ctx.r.dotes.some((f) => f._marca?.tipo === 'manifiesta')
  if (!yaTiene) {
    const m = marcaManifiesta(ctx.d, ctx.p.aspecto)
    if (m) procesarDote(ctx, m, 'camp:marca', origen, NIVEL_DESPERTAR)
  } else {
    const aspecto = ctx.r.dotes.find((f) => f._marca?.tipo === 'manifiesta')!._marca
    const plena = ctx.d.dotes.find((f) => f._marca?.tipo === 'plena' && f._marca.aspecto === aspecto.aspecto && f._marca.invertida === aspecto.invertida)
    if (plena) procesarDote(ctx, plena, 'camp:plena', origen, NIVEL_DESPERTAR)
  }
}

export function aspectoEsInvertido(aspecto: string): boolean {
  return ASPECTOS.some((a) => a.invertida === aspecto)
}

export function marcaManifiesta(d: Datos, aspecto: string): Entidad | undefined {
  const inv = aspectoEsInvertido(aspecto)
  const nombre = inv ? nombreMarcaInvertida(aspecto) : nombreMarcaManifiesta(aspecto)
  return d.dotes.find((f) => f.name === nombre)
}

export function marcaPlena(d: Datos, aspecto: string): Entidad | undefined {
  return d.dotes.find((f) => f.name === nombreMarcaPlena(aspecto))
}

function buscarDote(d: Datos, ref: string): Entidad | undefined {
  const [n, s] = ref.split('|')
  // «magic initiate; cleric|xphb» → versión de la dote base
  const base = n.split(';')[0]
  return d.dotes.find((f) => f._clave === claveDeRef(`${n}|${s ?? 'xphb'}`)) ?? d.dotes.find((f) => f._clave === claveDeRef(`${base}|${s ?? 'xphb'}`))
}

function procesarDotesDe(ctx: Ctx, feats: Crudo[] | undefined, id: string, origen: string, nivel: number) {
  for (const [i, f] of (feats ?? []).entries()) {
    if (f.anyFromCategory) {
      const cats: string[] = f.anyFromCategory.category
      for (let k = 0; k < (f.anyFromCategory.count ?? 1); k++) elegirDote(ctx, `${id}:dote${i}${k || ''}`, cats, origen, nivel, 'Dote de origen')
      continue
    }
    for (const ref of Object.keys(f)) {
      if (ref === 'marca manifiesta|setting' || ref === 'marca invertida|setting') {
        // La marca del aspecto del alma (al derecho o invertida, según el aspecto elegido)
        const necesitaInvertida = ref === 'marca invertida|setting'
        const m = ctx.p.aspecto && (!necesitaInvertida || aspectoEsInvertido(ctx.p.aspecto)) ? marcaManifiesta(ctx.d, ctx.p.aspecto) : undefined
        if (m) procesarDote(ctx, m, `${id}:marca`, origen, nivel)
        else
          ctx.elegir({
            id: `${id}:aspecto`, tipo: 'texto', origen, nivel, n: 1, opciones: [],
            etiqueta: necesitaInvertida ? 'Este trasfondo necesita una marca invertida: marca «Marca invertida» al elegir el aspecto del alma.' : 'Elige primero el aspecto del alma.',
          })
        continue
      }
      const dote = buscarDote(ctx.d, ref)
      if (dote) {
        // «magic initiate; cleric» fija la lista de conjuros
        const lista = ref.split('|')[0].split(';')[1]?.trim()
        procesarDote(ctx, dote, `${id}:${dote._clave}`, origen, nivel, lista)
      }
    }
  }
}

function cumplePrerrequisitos(ctx: Ctx, f: Entidad, nivel: number): boolean {
  if (!f.prerequisite) return true
  return (f.prerequisite as Crudo[]).some((pr) => {
    if (pr.level !== undefined) {
      const lv = typeof pr.level === 'number' ? pr.level : pr.level.level
      if (nivel < lv) return false
    }
    if (pr.aspecto && pr.aspecto !== ctx.p.aspecto) return false
    if (pr.feat && !(pr.feat as string[]).every((fr) => ctx.r.dotes.some((x) => x._clave === claveDeRef(fr)))) return false
    if (pr.featCategory && !ctx.r.dotes.some((x) => x._marca?.tipo === 'manifiesta')) return false
    if (pr.ability) {
      const ok = (pr.ability as Crudo[]).some((a) => Object.entries(a).every(([car, min]) => valorCaracteristica(ctx, car as Caracteristica) >= (min as number)))
      if (!ok) return false
    }
    if (pr.spellcasting2020 || pr.spellcastingFeature) {
      if (!ctx.r.clases.some((c) => c.lanzador)) return false
    }
    if (pr.proficiency) {
      const ok = (pr.proficiency as Crudo[]).every((x) =>
        Object.entries(x).every(([cat, val]) => ctx.r.efectos.some((e) => e.tipo === 'competencia' && e.categoria === (cat === 'armor' ? 'armadura' : 'arma') && e.valor === val)),
      )
      if (!ok) return false
    }
    if (pr.feature) {
      // Estilos de combate: solo desde el rasgo Fighting Style (los ofrece featProgression)
      return false
    }
    if (pr.otherSummary) return false
    return true
  })
}

function valorCaracteristica(ctx: Ctx, car: Caracteristica): number {
  const base = ctx.p.caracteristicas.base[car] ?? 10
  return base + ctx.r.aumentos.filter((a) => a.car === car).reduce((s, a) => s + a.valor, 0)
}

function elegirDote(ctx: Ctx, id: string, categorias: string[], origen: string, nivel: number, etiqueta: string, ignorarPrerreq = false) {
  const tieneFeature = categorias.some((c) => c.startsWith('FS'))
  const opciones = ctx.d.dotes
    .filter((f) => categorias.includes(f.category))
    .filter((f) => ignorarPrerreq || tieneFeature || cumplePrerrequisitos(ctx, f, nivel || ctx.r.nivel))
    .filter((f) => f.repeatable || !ctx.r.dotes.some((x) => x._clave === f._clave) || (ctx.p.elecciones[id] ?? []).includes(f._clave))
    // Solo una marca manifiesta por personaje
    .filter((f) => !(f._marca?.tipo === 'manifiesta' && ctx.r.dotes.some((x) => x._marca?.tipo === 'manifiesta' && x._clave !== f._clave)))
    .map((f) => ({ valor: f._clave, etiqueta: f._nombre, grupo: catNombre(f.category) }))
  const [v] = ctx.elegir({ id, tipo: 'dote', etiqueta, origen, nivel, n: 1, opciones })
  const dote = ctx.d.dotes.find((f) => f._clave === v)
  if (dote) procesarDote(ctx, dote, `${id}/${dote._clave}`, origen, nivel)
}

function catNombre(c: string): string {
  return ({ O: 'Origen', G: 'Generales', FS: 'Estilo de combate', 'FS:P': 'Estilo de combate (paladín)', 'FS:R': 'Estilo de combate (explorador)', EB: 'Dones épicos', D: 'Marcas' } as Record<string, string>)[c] ?? c
}

function procesarDote(ctx: Ctx, f: Entidad, id: string, origen: string, nivel: number, listaFija?: string) {
  ctx.r.dotes.push(f)
  const o = `Dote: ${f._nombre}`
  ctx.r.rasgos.push({ nombre: f._nombre, origen, nivel, entries: f.entries ?? [], tipo: f._marca ? 'marca' : 'dote' })
  if (f.ability) procesarAumento(ctx, f.ability, `${id}:aumento`, o, nivel, 'Aumento de característica', f.ability.find?.((a: Crudo) => a.max)?.max)
  procesarProficiencias(ctx, f, id, o, nivel)
  let bloques: Crudo[] = f.additionalSpells ?? []
  const nombres = bloques.map((b) => b.name).filter(Boolean)
  if (nombres.length > 1) {
    let elegido: string | undefined
    if (listaFija) elegido = nombres.find((n) => n.toLowerCase().startsWith(listaFija.toLowerCase()))
    if (!elegido) [elegido] = ctx.elegir({ id: `${id}:lista`, tipo: 'variante', etiqueta: 'Lista de conjuros', origen: o, nivel, n: 1, opciones: nombres.map((n) => ({ valor: n, etiqueta: n })) })
    bloques = bloques.filter((b) => b.name === elegido)
  }
  procesarAdicionales(ctx, bloques, id, o, ctx.r.nivel, nivel)
  for (const e of [...(DOTES_MANUALES[f._clave] ?? []), ...((f._efectos as Efecto[]) ?? [])]) ctx.efecto(conRasgo(e, f._nombre), o)
  for (const rc of (f._recursos as Crudo[]) ?? []) ctx.efecto({ tipo: 'recurso', nombre: rc.nombre, usos: rc.usos, recarga: rc.recarga, rasgo: f._nombre }, o)
  if (f._usosMarcaPlena) {
    // La marca plena convierte el conjuro gratis de la marca en PB usos por descanso largo
    for (const c of ctx.r.conjuros) if (c.origen === `Dote: ${f._usosMarcaPlena.de}` && c.usos === 1) c.usos = 'pb'
  }
  if (f.resist) procesarResistencias(ctx, f.resist, `${id}:resist`, o, nivel)
  for (const s of f.senses ?? []) for (const [k, v] of Object.entries(s as Crudo)) ctx.efecto({ tipo: 'sentido', nombre: titulo(k), valor: Number(v) }, o)
}

/** Aumentos de característica: fijos, a elegir o ponderados (trasfondos), con alternativas. */
function procesarAumento(ctx: Ctx, ability: Crudo[] | undefined, id: string, origen: string, nivel: number, etiqueta: string, max = 20) {
  if (!ability?.length) return
  const alternativas = ability.map((a) => {
    if (a.choose?.weighted) return { de: a.choose.weighted.from as Caracteristica[], pesos: a.choose.weighted.weights as number[] }
    if (a.choose) {
      const n = a.choose.count ?? 1
      const amount = a.choose.amount ?? 1
      return { de: a.choose.from as Caracteristica[], pesos: Array(n).fill(amount) as number[] }
    }
    const fijos = Object.entries(a).filter(([k]) => (CARACTERISTICAS as string[]).includes(k)) as [Caracteristica, number][]
    return { fijos }
  })
  const fijas = alternativas.length === 1 && 'fijos' in alternativas[0] ? alternativas[0].fijos! : undefined
  if (fijas) {
    for (const [car, v] of fijas) ctx.r.aumentos.push({ car, valor: v, max, origen })
    return
  }
  const valido = (vals: string[]) =>
    alternativas.some((alt) => {
      if (!('pesos' in alt) || !alt.pesos) return false
      const parsed = vals.map((v) => v.split(':')).map(([c, n]) => [c, Number(n)] as const)
      if (parsed.length !== alt.pesos.length) return false
      if (new Set(parsed.map(([c]) => c)).size !== parsed.length) return false
      if (!parsed.every(([c]) => alt.de!.includes(c as Caracteristica))) return false
      const a = parsed.map(([, n]) => n).sort().join(',')
      const b = [...alt.pesos].sort().join(',')
      return a === b
    })
  const valor = ctx.elegir({
    id, tipo: 'aumento', etiqueta, origen, nivel, n: 1,
    opciones: CARACTERISTICAS.map((c) => ({ valor: c, etiqueta: NOMBRE_CAR[c] })),
    meta: { alternativas, valido, max },
  })
  if (valido(valor)) for (const v of valor) {
    const [c, n] = v.split(':')
    ctx.r.aumentos.push({ car: c as Caracteristica, valor: Number(n), max, origen })
  }
}

function procesarResistencias(ctx: Ctx, resist: Crudo[], id: string, origen: string, nivel: number) {
  for (const [i, r] of resist.entries()) {
    if (typeof r === 'string') ctx.efecto({ tipo: 'resistencia', valor: r }, origen)
    else if (r.choose) {
      for (const v of ctx.elegir({ id: `${id}${i}`, tipo: 'resistencia', etiqueta: 'Resistencia', origen, nivel, n: r.choose.count ?? 1, opciones: (r.choose.from as string[]).map((x) => ({ valor: x, etiqueta: titulo(x) })) }))
        ctx.efecto({ tipo: 'resistencia', valor: v }, origen)
    }
  }
}

/** Competencias de 5etools: habilidades, herramientas, idiomas, armas, armaduras, salvaciones, pericias. */
function procesarProficiencias(ctx: Ctx, e: Crudo, id: string, origen: string, nivel: number) {
  const habilidades = ctx.d.habilidades.map((h) => ({ valor: h.clave, etiqueta: h.nombre }))
  const lista = (campo: string, f: (el: Crudo, sub: string) => void) => {
    const arr = e[campo] as Crudo[] | undefined
    if (!arr?.length) return
    if (arr.length === 1) return f(arr[0], `${id}:${campo}`)
    const [v] = ctx.elegir({
      id: `${id}:${campo}:alt`, tipo: 'alternativa', etiqueta: 'Elige una opción', origen, nivel, n: 1,
      opciones: arr.map((el, i) => ({ valor: String(i), etiqueta: resumenProf(el) })),
    })
    if (v !== undefined) f(arr[Number(v)], `${id}:${campo}:${v}`)
  }

  lista('skillProficiencies', (el, sub) => {
    for (const [k, v] of Object.entries(el)) {
      if (k === 'choose') {
        for (const x of ctx.elegir({ id: sub, tipo: 'habilidad', etiqueta: 'Competencia en habilidades', origen, nivel, n: v.count ?? 1, opciones: (v.from as string[]).map((s) => ({ valor: s, etiqueta: nombreHabilidad(ctx.d, s) })) }))
          ctx.efecto({ tipo: 'competencia', categoria: 'habilidad', valor: x }, origen)
      } else if (k === 'any') {
        for (const x of ctx.elegir({ id: `${sub}:any`, tipo: 'habilidad', etiqueta: 'Competencia en habilidades', origen, nivel, n: v, opciones: habilidades }))
          ctx.efecto({ tipo: 'competencia', categoria: 'habilidad', valor: x }, origen)
      } else if (v === true) ctx.efecto({ tipo: 'competencia', categoria: 'habilidad', valor: k }, origen)
    }
  })
  lista('toolProficiencies', (el, sub) => {
    for (const [k, v] of Object.entries(el)) {
      if (k === 'choose') {
        for (const x of ctx.elegir({ id: sub, tipo: 'herramienta', etiqueta: 'Herramientas', origen, nivel, n: v.count ?? 1, opciones: (v.from as string[]).map((s) => ({ valor: s, etiqueta: titulo(s) })) }))
          ctx.efecto({ tipo: 'competencia', categoria: 'herramienta', valor: x }, origen)
      } else if (typeof v === 'number') {
        for (const x of ctx.elegir({ id: `${sub}:${k}`, tipo: 'herramienta', etiqueta: 'Herramientas', origen, nivel, n: v, opciones: opcionesHerramienta(k).map((s) => ({ valor: s, etiqueta: titulo(s) })) }))
          ctx.efecto({ tipo: 'competencia', categoria: 'herramienta', valor: x }, origen)
      } else if (v === true) ctx.efecto({ tipo: 'competencia', categoria: 'herramienta', valor: k }, origen)
    }
  })
  lista('languageProficiencies', (el, sub) => {
    for (const [k, v] of Object.entries(el)) {
      if (k === 'anyStandard' || k === 'any') {
        for (const x of ctx.elegir({ id: `${sub}:${k}`, tipo: 'idioma', etiqueta: 'Idiomas', origen, nivel, n: v, opciones: idiomasDisponibles(k === 'any' ? 'todas' : 'estandar') }))
          ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: x }, origen)
      } else if (k === 'choose') {
        for (const x of ctx.elegir({ id: sub, tipo: 'idioma', etiqueta: 'Idiomas', origen, nivel, n: v.count ?? 1, opciones: (v.from as string[]).map((s) => ({ valor: idiomaSetting(s), etiqueta: idiomaSetting(s) })) }))
          ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: x }, origen)
      } else if (v === true) ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: idiomaSetting(k) }, origen)
    }
  })
  lista('skillToolLanguageProficiencies', (el, sub) => {
    for (const [i, ch] of ((el.choose as Crudo[]) ?? []).entries()) {
      const ops: Opcion[] = []
      if ((ch.from as string[]).includes('anySkill')) ops.push(...habilidades.map((h) => ({ ...h, valor: `habilidad:${h.valor}`, grupo: 'Habilidades' })))
      if ((ch.from as string[]).includes('anyTool')) ops.push(...TODAS_HERRAMIENTAS.map((t) => ({ valor: `herramienta:${t}`, etiqueta: titulo(t), grupo: 'Herramientas' })))
      if ((ch.from as string[]).includes('anyLanguage')) ops.push(...idiomasDisponibles('todas').map((t) => ({ ...t, valor: `idioma:${t.valor}` })))
      for (const x of ctx.elegir({ id: `${sub}:${i}`, tipo: 'habilidad', etiqueta: 'Habilidades o herramientas', origen, nivel, n: ch.count ?? 1, opciones: ops })) {
        const [cat, val] = x.split(/:(.*)/)
        ctx.efecto({ tipo: 'competencia', categoria: cat as 'habilidad', valor: val }, origen)
      }
    }
  })
  lista('expertise', (el, sub) => {
    for (const [k, v] of Object.entries(el)) {
      if (k === 'anyProficientSkill') {
        for (const x of ctx.elegir({ id: sub, tipo: 'pericia', etiqueta: 'Pericia', origen, nivel, n: v, opciones: habilidades, meta: { soloCompetentes: true } }))
          ctx.efecto({ tipo: 'pericia', valor: x }, origen)
      } else if (v === true) ctx.efecto({ tipo: 'pericia', valor: k }, origen)
    }
  })
  lista('savingThrowProficiencies', (el, sub) => {
    for (const [k, v] of Object.entries(el)) {
      if (k === 'choose') {
        for (const x of ctx.elegir({ id: sub, tipo: 'salvacion', etiqueta: 'Competencia en salvación', origen, nivel, n: v.count ?? 1, opciones: (v.from as Caracteristica[]).map((c) => ({ valor: c, etiqueta: NOMBRE_CAR[c] })) }))
          ctx.efecto({ tipo: 'competencia', categoria: 'salvacion', valor: x }, origen)
      } else if (v === true) ctx.efecto({ tipo: 'competencia', categoria: 'salvacion', valor: k }, origen)
    }
  })
  for (const el of (e.weaponProficiencies as Crudo[]) ?? []) for (const [k, v] of Object.entries(el)) if (v === true) ctx.efecto({ tipo: 'competencia', categoria: 'arma', valor: k.split('|')[0] }, origen)
  for (const el of (e.armorProficiencies as Crudo[]) ?? []) for (const [k, v] of Object.entries(el)) if (v === true) ctx.efecto({ tipo: 'competencia', categoria: 'armadura', valor: k }, origen)
  if (e.immune) for (const x of e.immune) if (typeof x === 'string') ctx.efecto({ tipo: 'inmunidad', valor: x }, origen)
  if (e.conditionImmune) for (const x of e.conditionImmune) if (typeof x === 'string') ctx.efecto({ tipo: 'inmunidadCondicion', valor: x }, origen)
  if (e.resist && id === 'esp') procesarResistencias(ctx, e.resist, `${id}:resist`, origen, nivel)
}

function resumenProf(el: Crudo): string {
  return Object.entries(el)
    .map(([k, v]) => (k === 'choose' ? `elegir ${v.count ?? 1} de ${(v.from as string[]).join(', ')}` : typeof v === 'number' ? `${v} × ${k}` : titulo(k)))
    .join(', ')
}

/** Conjuros adicionales (bloques ya filtrados por variante). */
function procesarAdicionales(ctx: Ctx, bloques: Crudo[], id: string, origen: string, nivel: number, nivelOrigen: number, clase?: string, aPj?: (nivelClase: number) => number) {
  bloques.forEach((b, bi) => {
    const r = resolverBloque(b, nivel)
    let car: Caracteristica | undefined
    if (r.caracteristica && typeof r.caracteristica === 'object') {
      ;[car] = ctx.elegir({
        id: `${id}:as${bi}:car`, tipo: 'caracteristicaConjuro', etiqueta: 'Característica para lanzar estos conjuros', origen, nivel: nivelOrigen, n: 1,
        opciones: r.caracteristica.elegir.map((c) => ({ valor: c, etiqueta: NOMBRE_CAR[c] })),
      }) as Caracteristica[]
    } else car = r.caracteristica as Caracteristica | undefined
    const añadir = (clave: string, x: { modo: string; usos?: number | 'car' | 'voluntad'; recarga?: Recarga; ritual?: boolean; recurso?: string }) => {
      const usos = x.usos === 'car' ? (car ? Math.max(1, modificador(valorCaracteristica(ctx, car))) : 1) : x.usos
      const nivelConj = ctx.d.conjuros.find((c) => c._clave === clave)?.level ?? 0
      // Los conjuros «conocidos» del mago (escuelas) van a su libro de hechizos
      const enLibro = clase === 'Wizard' && x.modo === 'conocido' && nivelConj > 0
      ctx.r.conjuros.push({ clave, origen, siempre: !enLibro, enLibro, usos, recarga: x.recarga, caracteristica: car, ritual: x.ritual, clase, recurso: x.recurso })
    }
    for (const f of r.fijos) añadir(f.clave, f)
    for (const { nivel: nv, i, e } of r.aElegir) {
      const libro = ctx.p.elecciones[`cls:Wizard:libro`] ?? []
      const opciones = filtrarConjuros(ctx.d, e.filtro, libro).map((c) => ({ valor: c._clave, etiqueta: c.name, grupo: c.level ? `Nivel ${c.level}` : 'Trucos' }))
      for (const v of ctx.elegir({ id: `${id}:as${bi}:${e.modo}:${nv}:${i}`, tipo: 'conjuro', etiqueta: etiquetaFiltro(e.filtro), origen, nivel: nv !== '_' && aPj && /^d+$/.test(nv) ? aPj(Number(nv)) : nivelOrigen, n: e.n, opciones, meta: { filtro: e.filtro } }))
        añadir(v, e)
    }
    for (const a of r.ampliaLista) {
      const objetivo = clase ?? '*'
      const lista = (ctx.r.listasAmpliadas[objetivo] ??= [])
      if (a.filtro) lista.push(...filtrarConjuros(ctx.d, a.filtro).map((c) => c._clave))
      lista.push(...a.conjuros)
    }
  })
}

const ESCUELA: Record<string, string> = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' }

/** «Spell (Evocation, level 0–2, Wizard)» a partir de un filtro de 5etools. */
function etiquetaFiltro(f: FiltroConjuros): string {
  if (f.lista) return 'Spell'
  const solo0 = f.niveles?.every((n) => n === 0)
  const partes = [
    f.escuelas?.map((e) => ESCUELA[e] ?? e).join('/'),
    !solo0 && f.niveles ? `level ${f.niveles.length > 1 ? `${Math.min(...f.niveles)}–${Math.max(...f.niveles)}` : f.niveles[0]}` : '',
    f.clases?.join('/'),
  ].filter(Boolean)
  return `${solo0 ? 'Cantrip' : 'Spell'}${partes.length ? ` (${partes.join(', ')})` : ''}`
}

function procesarEquipo(ctx: Ctx, se: Crudo[], id: string, origen: string) {
  for (const [i, bloque] of se.entries()) {
    const claves = Object.keys(bloque)
    if (claves.length === 1 && claves[0] === '_') {
      ctx.r.equipo.push({ origen, items: bloque._ })
      continue
    }
    const [v] = ctx.elegir({
      id: `${id}${i || ''}`, tipo: 'equipo', etiqueta: 'Equipo inicial', origen, nivel: 0, n: 1,
      opciones: claves.filter((k) => k !== '_').map((k) => ({ valor: k, etiqueta: `Opción ${k}`, detalle: resumenEquipo(ctx.d, bloque[k]) })),
    })
    if (bloque._) ctx.r.equipo.push({ origen, items: bloque._ })
    if (v) ctx.r.equipo.push({ origen, items: bloque[v] })
  }
}

export function resumenEquipo(d: Datos, items: Crudo[]): string {
  return items
    .map((it) => {
      if (it.value) return `${it.value / 100} GP`
      if (it.special) return it.special
      if (it.item) {
        const o = d.objetos.find((x) => x._clave === claveDeRef(it.item))
        return `${it.quantity ? `${it.quantity} × ` : ''}${it.displayName ?? o?.name ?? it.item.split('|')[0]}`
      }
      if (it.equipmentType) return `(${it.equipmentType})`
      return '?'
    })
    .join(', ')
}

// ── Clases

/** Valor de una columna de la tabla de la clase (o subclase) a un nivel. */
export function columnaClase(c: Clase, s: Subclase | undefined, nombre: string, nivel: number): number | string | undefined {
  for (const g of [...(c.classTableGroups ?? []), ...(s?.subclassTableGroups ?? [])] as Crudo[]) {
    const labels = (g.colLabels as string[]).map((l) => l.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1'))
    const i = labels.findIndex((l) => l.toLowerCase() === nombre.toLowerCase())
    if (i < 0) continue
    const fila = (g.rows ?? g.rowsSpellProgression)?.[nivel - 1]
    const v = fila?.[i]
    if (v === undefined) return undefined
    if (typeof v === 'object') return v.value ?? v.toRoll?.map((t: Crudo) => `${t.number}d${t.faces}`).join('+') ?? JSON.stringify(v)
    const s2 = String(v).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
    return /^[+-]?\d+$/.test(s2) ? Number(s2) : s2
  }
  return undefined
}

function progresion(p: Crudo | number[] | undefined, nivel: number): number {
  if (!p) return 0
  if (Array.isArray(p)) return p[nivel - 1] ?? 0
  let v = 0
  for (const [k, n] of Object.entries(p)) if (Number(k) <= nivel) v = Math.max(v, n as number)
  return v
}

function procesarClases(ctx: Ctx) {
  const { p, d } = ctx
  const nivelesClase: Record<string, number> = {}
  // Niveles finales por clase: las fórmulas de rasgos (columnas de la tabla) se evalúan con el nivel actual, no con el de adquisición
  const finales: Record<string, number> = {}
  for (const nv of p.niveles) {
    const c = d.clases.find((x) => x._clave === nv.clase)
    if (c) finales[c.name] = (finales[c.name] ?? 0) + 1
  }
  const primera = p.niveles[0]?.clase
  p.niveles.forEach((nv, idx) => {
    const c = d.clases.find((x) => x._clave === nv.clase)
    if (!c) return
    const L = (nivelesClase[c.name] = (nivelesClase[c.name] ?? 0) + 1)
    const nivelPj = idx + 1
    const origen = `${c._nombre} ${L}`
    const id = `cls:${c.name}`
    let info = ctx.r.clases.find((x) => x.clase === c)
    if (!info) {
      info = { clase: c, nivel: 0 }
      ctx.r.clases.push(info)
    }
    info.nivel = L

    // PG
    if (nivelPj === 1) ctx.r.pgPorNivel.push(c.hd.faces)
    else {
      const media = Math.floor(c.hd.faces / 2) + 1
      const [v] = ctx.elegir({
        id: `${id}:${L}:pg`, tipo: 'pg', etiqueta: `Hit Points (d${c.hd.faces})`, origen, nivel: nivelPj, n: 1,
        opciones: [{ valor: String(media), etiqueta: `Media (${media})` }], meta: { dado: c.hd.faces, media },
      })
      ctx.r.pgPorNivel.push(v ? Math.min(c.hd.faces, Math.max(1, Number(v))) : media)
    }

    // Nivel 1 de la clase: competencias
    if (L === 1) {
      if (nv.clase === primera) {
        for (const s of c.proficiency) ctx.efecto({ tipo: 'competencia', categoria: 'salvacion', valor: s }, origen)
        const sp = c.startingProficiencies ?? {}
        procesarProficiencias(ctx, { skillProficiencies: sp.skills, toolProficiencies: sp.toolProficiencies, armorProficiencies: sp.armorProficiencies }, id, origen, nivelPj)
        for (const w of sp.weapons ?? []) ctx.efecto({ tipo: 'competencia', categoria: 'arma', valor: String(w).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1').toLowerCase() }, origen)
        if (c.startingEquipment?.defaultData) procesarEquipo(ctx, c.startingEquipment.defaultData, `${id}:equipo`, origen)
      } else {
        const mc = c.multiclassing?.proficienciesGained ?? {}
        procesarProficiencias(ctx, { skillProficiencies: mc.skills, toolProficiencies: mc.toolProficiencies, armorProficiencies: mc.armorProficiencies }, `${id}:mc`, origen, nivelPj)
        for (const w of mc.weapons ?? []) ctx.efecto({ tipo: 'competencia', categoria: 'arma', valor: String(w).toLowerCase() }, origen)
      }
    }

    // Subclase
    const refsNivel = c.classFeatures.filter((cf) => Number((typeof cf === 'string' ? cf : cf.classFeature).split('|')[3]) === L)
    const tocaSubclase = c.classFeatures.find((cf) => typeof cf === 'object' && cf.gainSubclassFeature)
    const nivelSub = tocaSubclase ? Number((tocaSubclase as Crudo).classFeature.split('|')[3]) : 3
    if (L === nivelSub) {
      ctx.elegir({
        id: `${id}:sub`, tipo: 'subclase', etiqueta: c.subclassTitle, origen, nivel: nivelPj, n: 1,
        opciones: d.subclases.filter((s) => s.className === c.name && s.classSource === c.source).map((s) => ({ valor: s._clave, etiqueta: s._nombre, detalle: s._setting })),
      })
    }
    const sub = L >= nivelSub ? d.subclases.find((s) => s._clave === (p.elecciones[`${id}:sub`] ?? [])[0] && s.className === c.name) : undefined
    info.subclase = sub

    // Lanzador de conjuros (clase o subclase)
    const fuenteLanz = c.casterProgression ? c : sub?.casterProgression ? sub : undefined
    if (fuenteLanz) {
      const lista = c.casterProgression ? c.name : listaDeSubclase(sub!)
      info.lanzador = { progresion: fuenteLanz.casterProgression, caracteristica: fuenteLanz.spellcastingAbility, lista, fuente: fuenteLanz }
    }

    // Rasgos de clase del nivel
    for (const cf of refsNivel) {
      const ref = typeof cf === 'string' ? cf : cf.classFeature
      const r = d.rasgos[claveRasgoClase(ref)]
      if (r) procesarRasgo(ctx, r, nivelPj, info, finales)
    }
    if (sub) {
      for (const sf of sub.subclassFeatures) {
        if (Number(sf.split('|')[5]) !== L) continue
        const r = d.rasgos[claveRasgoSubclase(sf)]
        if (r) procesarRasgo(ctx, r, nivelPj, info, finales)
      }
    }

    // Dotes por progresión (estilos de combate, don épico)
    for (const fp of [...((c.featProgression as Crudo[]) ?? []), ...((sub?.featProgression as Crudo[]) ?? [])]) {
      const n = progresion(fp.progression, L) - progresion(fp.progression, L - 1)
      for (let k = 0; k < n; k++) elegirDote(ctx, `${id}:${L}:fp:${fp.name}${k || ''}`, fp.category, origen, nivelPj, fp.name)
    }
  })

  // Elecciones acumulativas (al final, cuando ya se conocen todos los niveles de cada clase)
  for (const info of ctx.r.clases) procesarAcumulativas(ctx, info, nivelesClase)
}

function listaDeSubclase(s: Subclase): string {
  const m = JSON.stringify(s.additionalSpells ?? []).match(/class=(\w+)/)
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : 'Wizard'
}

function procesarRasgo(ctx: Ctx, r: Rasgo, nivelPj: number, info: InfoClase, nivelesClase: Record<string, number>) {
  if (ctx.vistos.has(r._ref)) return
  ctx.vistos.add(r._ref)
  const c = info.clase
  const origen = `${c._nombre} ${r.level}${r.subclassShortName ? ` (${info.subclase?._nombre ?? r.subclassShortName})` : ''}`
  ctx.r.rasgos.push({ nombre: r.name, origen, nivel: nivelPj, entries: r.entries, tipo: r.subclassShortName ? 'subclase' : 'clase', ref: r._ref })
  const id = `r:${claveManual(r)}`
  const vars = (n: string) => {
    if (n.startsWith('col:')) return Number(columnaClase(c, info.subclase, n.slice(4), nivelesClase[c.name] ?? info.nivel)) || 0
    return ctx.vars(nivelesClase)(n)
  }

  // Mejora de característica: dote general (incluye Ability Score Improvement)
  if (r.name === 'Ability Score Improvement') {
    elegirDote(ctx, `cls:${c.name}:${r.level}:dote`, ['G'], origen, nivelPj, 'Dote o mejora de característica')
  }

  // Opciones estructuradas: «options» con rasgos de clase/subclase
  recorrerOpciones(r.entries, (opt, k) => {
    const refs = (opt.entries as Crudo[]).filter((x) => x.type === 'refClassFeature' || x.type === 'refSubclassFeature')
    if (!refs.length) return
    const rasgos = refs
      .map((x) => ctx.d.rasgos[x.type === 'refClassFeature' ? claveRasgoClase(x.classFeature) : claveRasgoSubclase(x.subclassFeature)])
      .filter(Boolean)
    const vals = ctx.elegir({
      id: `${id}:op${k}`, tipo: 'rasgo', etiqueta: r.name, origen, nivel: nivelPj, n: opt.count ?? 1,
      opciones: rasgos.map((x) => ({ valor: x._ref, etiqueta: x.name, detalle: textoPlano(x.entries).slice(0, 220) })),
    })
    for (const v of vals) {
      const elegido = ctx.d.rasgos[v]
      if (elegido) procesarRasgo(ctx, elegido, nivelPj, info, nivelesClase)
    }
  })
  // Sub-rasgos incluidos (refSubclassFeature fuera de «options»)
  for (const x of r.entries as Crudo[]) {
    if (typeof x === 'object' && x.type === 'refSubclassFeature') {
      const sr = ctx.d.rasgos[claveRasgoSubclase(x.subclassFeature)]
      if (sr) procesarRasgo(ctx, sr, nivelPj, info, nivelesClase)
    }
  }

  // Tabla manual y mecánicas
  for (const e of MECANICAS[claveManual(r)] ?? []) ctx.efecto(conRasgo(concretar(e, vars, c, info, nivelesClase[c.name]), r.name), origen)
  const m = RASGOS_MANUALES[claveManual(r)]
  if (m) {
    for (const e of m.efectos ?? []) ctx.efecto(concretar(e, vars, c, info, nivelesClase[c.name]), origen)
    for (const em of m.elecciones ?? []) procesarEleccionManual(ctx, em, `${id}:${em.id}`, origen, nivelPj, vars, info)
  }
}

/** Evalúa ya las fórmulas que dependen de la tabla o del nivel de clase (no las de características). */
function concretar(e: Efecto, vars: (n: string) => number, c: Clase, info: InfoClase, nivelFinal: number): Efecto {
  const dependeDeClase = (f: unknown) => typeof f === 'string' && /col:|nivel:|escala/.test(f) && !/(str|dex|con|int|wis|cha)/.test(f)
  const columna = (f: string) => String(columnaClase(c, info.subclase, f.slice(4).replace(/_/g, ' '), nivelFinal) ?? '')
  const o = { ...e } as Crudo
  for (const k of ['usos', 'valor', 'recargaCorta']) {
    if (dependeDeClase(o[k])) {
      if (String(o[k]).startsWith('col:') && k === 'valor') o[k] = parseInt(columna(o[k]).replace(/[^d-]/g, ''), 10) || 0
      else o[k] = evaluar(o[k], vars)
    }
  }
  for (const k of ['dado', 'dano']) {
    if (typeof o[k] === 'string' && o[k].startsWith('col:')) o[k] = columna(o[k]).toLowerCase()
    else if (typeof o[k] === 'string' && o[k].startsWith('escala')) o[k] = `d${evaluar(o[k], vars)}`
  }
  return o as Efecto
}

function recorrerOpciones(entries: unknown[], f: (opt: Crudo, k: number) => void) {
  let k = 0
  const visitar = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(visitar)
    if (!x || typeof x !== 'object') return
    const o = x as Crudo
    if (o.type === 'options') f(o, k++)
    else if (o.entries) visitar(o.entries)
  }
  visitar(entries)
}

export function textoPlano(entries: unknown): string {
  if (typeof entries === 'string') return entries.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
  if (Array.isArray(entries)) return entries.map(textoPlano).join(' ')
  if (entries && typeof entries === 'object') {
    const o = entries as Crudo
    return [o.name, textoPlano(o.entries ?? o.items ?? '')].filter(Boolean).join(': ')
  }
  return ''
}

function procesarEleccionManual(ctx: Ctx, em: EleccionManual, id: string, origen: string, nivel: number, vars: (n: string) => number, info: InfoClase) {
  const n = Math.max(0, Math.floor(evaluar(em.n as Formula, vars)))
  const hab = ctx.d.habilidades
  let opciones: Opcion[] = []
  const de = em.de
  switch (em.tipo) {
    case 'habilidad':
    case 'pericia':
      opciones = (Array.isArray(de) ? de : hab.map((h) => h.clave)).map((h) => ({ valor: h, etiqueta: nombreHabilidad(ctx.d, h) }))
      break
    case 'herramienta':
      opciones = opcionesHerramienta(de === 'artesano' ? 'artesano' : 'any').map((t) => ({ valor: t, etiqueta: titulo(t) }))
      break
    case 'idioma':
      opciones = idiomasDisponibles(de === 'estandar' ? 'estandar' : 'todas')
      break
    case 'resistencia':
      opciones = (Array.isArray(de) ? de : TIPOS_DANO).map((t) => ({ valor: t, etiqueta: titulo(t) }))
      break
    case 'opcion':
      opciones = (de as string[]).map((t) => ({ valor: t, etiqueta: t }))
      break
    case 'maestria':
      opciones = ctx.d.objetos
        .filter((o) => o.weapon && o.mastery && o.source === 'XPHB' && !o.baseItem)
        .map((o) => ({ valor: o._clave, etiqueta: `${o.name} (${String(o.mastery[0]).split('|')[0]})`, grupo: o.weaponCategory === 'martial' ? 'Martial' : 'Simple' }))
      break
    case 'conjuro': {
      const f: FiltroConjuros = parsearFiltro(em.filtro ?? '')
      const libro = ctx.p.elecciones['cls:Wizard:libro'] ?? []
      opciones = filtrarConjuros(ctx.d, f, libro).map((c) => ({ valor: c._clave, etiqueta: c.name, grupo: `Nivel ${c.level}` }))
      break
    }
    case 'plano': {
      opciones = ctx.d.objetos
        .filter((o) => (o.classFeatures as string[] | undefined)?.some((cf) => cf.toLowerCase().startsWith('replicate magic item|artificer')))
        .filter((o) => {
          const nv = Number(String((o.classFeatures as string[]).find((cf) => cf.toLowerCase().startsWith('replicate magic item'))).split('|')[3])
          return !nv || nv <= info.nivel
        })
        .map((o) => ({ valor: o._clave, etiqueta: o.name, grupo: titulo(o.rarity ?? '') }))
      break
    }
    case 'salvacion':
      opciones = CARACTERISTICAS.map((c) => ({ valor: c, etiqueta: NOMBRE_CAR[c] }))
      break
  }
  const vals = ctx.elegir({ id, tipo: em.tipo, etiqueta: em.etiqueta, origen, nivel, n, opciones, cambia: em.cambia, meta: em.tipo === 'pericia' && de === 'competentes' ? { soloCompetentes: true } : undefined })
  for (const v of vals) {
    switch (em.tipo) {
      case 'habilidad': ctx.efecto({ tipo: 'competencia', categoria: 'habilidad', valor: v }, origen); break
      case 'pericia':
        if (Array.isArray(de)) ctx.efecto({ tipo: 'competencia', categoria: 'habilidad', valor: v }, origen)
        ctx.efecto({ tipo: 'pericia', valor: v }, origen)
        break
      case 'herramienta': ctx.efecto({ tipo: 'competencia', categoria: 'herramienta', valor: v }, origen); break
      case 'idioma': ctx.efecto({ tipo: 'competencia', categoria: 'idioma', valor: v }, origen); break
      case 'resistencia': ctx.efecto({ tipo: 'resistencia', valor: v }, origen); break
      case 'salvacion': ctx.efecto({ tipo: 'competencia', categoria: 'salvacion', valor: v }, origen); break
      case 'opcion': for (const e of em.opciones?.[v] ?? []) ctx.efecto(e, origen); break
      case 'maestria': ctx.efecto({ tipo: 'nota', texto: `maestria:${v}` }, origen); break
      case 'plano': ctx.efecto({ tipo: 'nota', texto: `plano:${v}` }, origen); break
      case 'conjuro':
        ctx.r.conjuros.push({ clave: v, origen, siempre: !!em.comoConjuro?.siempre, usos: em.comoConjuro?.usos as number | undefined, recarga: em.comoConjuro?.recarga, clase: info.clase.name })
        break
    }
  }
}

/** Trucos, conjuros preparados, libro, invocaciones y arcanos: elecciones que crecen con el nivel. */
function procesarAcumulativas(ctx: Ctx, info: InfoClase, nivelesClase: Record<string, number>) {
  const { d, p } = ctx
  const c = info.clase
  const L = info.nivel
  const id = `cls:${c.name}`
  const origen = c._nombre
  const nivelPj = p.niveles.length
  const sub = info.subclase
  // Nivel de personaje en el que la clase alcanzó cada nivel de clase
  const aPj = (nc: number) => {
    let k = 0
    for (let i = 0; i < p.niveles.length; i++) if (p.niveles[i].clase === c._clave && ++k === nc) return i + 1
    return nivelPj
  }

  // Rasgos opcionales (invocaciones, maniobras, metamagia)
  for (const ofp of [...((c.optionalfeatureProgression as Crudo[]) ?? []), ...((sub?.optionalfeatureProgression as Crudo[]) ?? [])]) {
    const n = progresion(ofp.progression, L)
    if (!n) continue
    const tipos: string[] = ofp.featureType
    const opciones = d.opcionales
      .filter((o) => (o.featureType as string[]).some((t) => tipos.includes(t)))
      .filter((o) => cumplePrerrequisitoOpcional(ctx, o, L))
      .map((o) => ({ valor: o._clave, etiqueta: o.name, detalle: textoPlano(o.entries).slice(0, 200) }))
    const vals = ctx.elegir({ id: `${id}:opc:${tipos.join('+')}`, tipo: 'opcional', etiqueta: ofp.name, origen, nivel: nivelPj, n, opciones, cambia: 'nivel' })
    for (const v of vals) {
      const o = d.opcionales.find((x) => x._clave === v)
      if (!o) continue
      ctx.r.opcionales.push(o)
      ctx.r.rasgos.push({ nombre: o.name, origen: `${origen}: ${ofp.name}`, nivel: nivelPj, entries: o.entries ?? [], tipo: 'opcional' })
      procesarProficiencias(ctx, o, `${id}:opc:${o._clave}`, o.name, nivelPj)
      for (const e of DOTES_MANUALES[o._clave] ?? []) ctx.efecto(conRasgo(e, o.name), o.name)
      procesarAdicionales(ctx, o.additionalSpells ?? [], `${id}:opc:${o._clave}`, o.name, L, nivelPj, c.name)
    }
  }

  // Conjuros adicionales de clase y subclase (por nivel de clase)
  procesarAdicionales(ctx, (c.additionalSpells as Crudo[]) ?? [], `${id}:as`, origen, L, nivelPj, c.name, aPj)
  if (sub) {
    let bloques: Crudo[] = sub.additionalSpells ?? []
    const nombres = bloques.map((b) => b.name).filter(Boolean)
    if (nombres.length > 1) {
      const [v] = ctx.elegir({ id: `${id}:sub:variante`, tipo: 'variante', etiqueta: sub._nombre, origen: sub._nombre, nivel: nivelPj, n: 1, opciones: nombres.map((n) => ({ valor: n, etiqueta: n })), cambia: 'largo' })
      bloques = bloques.filter((b) => b.name === v)
    }
    procesarAdicionales(ctx, bloques, `${id}:sub:as`, sub._nombre, L, nivelPj, c.name, aPj)
  }

  const lz = info.lanzador
  if (!lz) return
  const fuente = lz.fuente
  const extraTrucos = ctx.r.efectos.filter((e) => e.tipo === 'trucosExtra' && e.clase === c.name).reduce((s, e) => s + (e as { valor: number }).valor, 0)
  const nTrucos = progresion(fuente.cantripProgression, L) + extraTrucos
  const maxNivel = nivelMaximoConjuro(info)
  const lista = new Set([...(ctx.r.listasAmpliadas[c.name] ?? []), ...(ctx.r.listasAmpliadas['*'] ?? [])])
  const deLista = (cj: Conjuro) => cj._clases.includes(lz.lista) || lista.has(cj._clave)

  // Conjuros que ya tiene por especie, trasfondo, dotes, subclase o rasgos: aparecen como ya aprendidos
  // (no cuentan para el límite) y no se pueden volver a elegir en las listas de la clase
  const fijos: ConjuroFijo[] = []
  for (const x of ctx.r.conjuros) {
    if (!x.siempre && !x.enLibro) continue
    if (fijos.some((y) => y.clave === x.clave)) continue
    const cj = d.conjuros.find((y) => y._clave === x.clave)
    if (!cj) continue
    const como = x.enLibro ? 'en tu libro' : x.usos === 'voluntad' ? 'a voluntad' : x.usos ? `siempre preparado, ${x.usos === 'pb' ? 'PB' : x.usos}/${x.recarga === 'corto' ? 'Short Rest' : 'Long Rest'} sin espacio` : cj.level === 0 ? 'conocido' : 'siempre preparado'
    fijos.push({ clave: x.clave, nombre: cj.name, nivel: cj.level, origen: x.origen, como })
  }
  const yaTiene = (cj: Conjuro) => {
    const fx = fijos.find((y) => y.clave === cj._clave)
    return fx ? `Ya lo tienes (${fx.origen})` : undefined
  }
  const opcion = (cj: Conjuro, grupo?: string): Opcion => ({ valor: cj._clave, etiqueta: cj.name, grupo, bloqueada: yaTiene(cj) })

  if (nTrucos) {
    ctx.elegir({
      id: `${id}:trucos`, tipo: 'trucos', etiqueta: 'Cantrips', origen, nivel: nivelPj, n: nTrucos, cambia: 'nivel',
      opciones: d.conjuros.filter((cj) => cj.level === 0 && deLista(cj)).map((cj) => opcion(cj)),
      meta: { fijos: fijos.filter((x) => x.nivel === 0) },
    }).forEach((v) => ctx.r.conjuros.push({ clave: v, origen, siempre: true, clase: c.name }))
  }

  // Libro de hechizos (mago): 6 al nivel 1 y 2 más por nivel
  let libro: string[] | undefined
  if (fuente.spellsKnownProgressionFixed) {
    const n = (fuente.spellsKnownProgressionFixed as number[]).slice(0, L).reduce((a, b) => a + b, 0)
    libro = ctx.elegir({
      id: `${id}:libro`, tipo: 'libro', etiqueta: 'Spellbook', origen, nivel: nivelPj, n, cambia: 'nivel',
      opciones: d.conjuros.filter((cj) => cj.level >= 1 && cj.level <= maxNivel && deLista(cj)).map((cj) => opcion(cj, `Nivel ${cj.level}`)),
      meta: { fijos: fijos.filter((x) => x.nivel > 0) },
    })
  }

  // Conjuros preparados
  const nPrep = progresion(fuente.preparedSpellsProgression, L)
  if (nPrep) {
    const desde = libro ? d.conjuros.filter((cj) => libro!.includes(cj._clave) || ctx.r.conjuros.some((x) => x.clave === cj._clave && x.enLibro))
      : d.conjuros.filter((cj) => cj.level >= 1 && cj.level <= maxNivel && deLista(cj))
    ctx.elegir({
      id: `${id}:preparados`, tipo: 'preparados', etiqueta: 'Prepared Spells', origen, nivel: nivelPj, n: nPrep,
      cambia: fuente.preparedSpellsChange === 'level' ? 'nivel' : 'largo',
      // Los del libro que da la subclase sí se pueden preparar: solo se bloquean los siempre preparados
      opciones: desde.filter((cj) => cj.level >= 1 && cj.level <= maxNivel).map((cj) => ({ ...opcion(cj, `Nivel ${cj.level}`), bloqueada: fijos.some((y) => y.clave === cj._clave && y.como !== 'en tu libro') ? yaTiene(cj) : undefined })),
      meta: { fijos: fijos.filter((x) => x.nivel > 0 && x.como !== 'en tu libro') },
    }).forEach((v) => ctx.r.conjuros.push({ clave: v, origen, siempre: false, clase: c.name }))
  }

  // Arcanos místicos (brujo)
  for (const [nv, porNivel] of Object.entries((fuente.spellsKnownProgressionFixedByLevel as Crudo) ?? {})) {
    if (Number(nv) > L) continue
    for (const [nivelConj, n] of Object.entries(porNivel as Crudo)) {
      ctx.elegir({
        id: `${id}:arcano:${nivelConj}`, tipo: 'conjuro', etiqueta: `Mystic Arcanum (level ${nivelConj})`, origen, nivel: nivelPj, n: n as number,
        opciones: d.conjuros.filter((cj) => cj.level === Number(nivelConj) && deLista(cj)).map((cj) => opcion(cj)),
      }).forEach((v) => ctx.r.conjuros.push({ clave: v, origen: `${origen}: Mystic Arcanum`, siempre: true, usos: 1, recarga: 'largo', clase: c.name }))
    }
  }
}

function cumplePrerrequisitoOpcional(ctx: Ctx, o: Entidad, nivelClase: number): boolean {
  if (!o.prerequisite) return true
  return (o.prerequisite as Crudo[]).some((pr) => {
    if (pr.level) {
      const lv = typeof pr.level === 'number' ? pr.level : pr.level.level
      if (nivelClase < lv) return false
    }
    if (pr.optionalfeature) {
      const elegidos = Object.entries(ctx.p.elecciones).filter(([k]) => k.includes(':opc:')).flatMap(([, v]) => v)
      if (!(pr.optionalfeature as string[]).some((r) => elegidos.includes(claveDeRef(r)))) return false
    }
    return true
  })
}

/** Nivel máximo de conjuro que la clase puede preparar, según su tabla de espacios. */
export function nivelMaximoConjuro(info: InfoClase): number {
  const lz = info.lanzador
  if (!lz) return 0
  const L = info.nivel
  if (lz.progresion === 'pact') return Math.min(5, Math.ceil(L / 2))
  const nivelLanzador = lz.progresion === 'full' ? L : lz.progresion === '1/3' ? Math.ceil(L / 3) : Math.ceil(L / 2)
  return Math.min(9, Math.ceil(nivelLanzador / 2))
}
