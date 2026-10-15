// Calcula la hoja de personaje a partir de la resolución (decisiones), el inventario y el estado de juego.
import type { Caracteristica, Conjuro, Crudo, Datos, Entidad } from '../datos/tipos'
import { CARACTERISTICAS } from '../datos/tipos'
import { claveDeRef } from '../datos/refs'
import type { Efecto, Recarga } from './efectos'
import { evaluar } from './formula'
import type { ItemInventario, Personaje } from './personaje'
import { bonoCompetencia, modificador } from './personaje'
import { resolver, columnaClase, type ConjuroObtenido, type InfoClase, type Resolucion, type RasgoObtenido } from './resolver'
import type { ObjetoCampaña } from '../almacen/objetosCampaña'

export interface HabilidadHoja {
  clave: string
  nombre: string
  car: Caracteristica
  bono: number
  competente: boolean
  pericia: boolean
  dados: string[]
}

export interface AtaqueHoja {
  id: string
  nombre: string
  bonoAtaque: number
  dano: string
  tipoDano: string
  alcance?: string
  propiedades: string[]
  maestria?: string
  origen: string
  versatil?: string
}

export interface ConjuroHoja {
  conjuro: Conjuro
  origen: string
  preparado: boolean
  siempre: boolean
  usos?: number | 'voluntad'
  recarga?: Recarga
  idRecurso?: string
  cd: number
  ataque: number
  car: Caracteristica
  ritual?: boolean
  recurso?: string
  cargas?: { idObjeto: string; coste: number }
}

export interface RecursoHoja {
  id: string
  nombre: string
  max: number
  recarga: Recarga
  recargaCorta?: number
  dado?: string
  origen: string
}

export interface Hoja {
  nivel: number
  pb: number
  car: Record<Caracteristica, { valor: number; mod: number; salvacion: number; competenteSalv: boolean }>
  habilidades: HabilidadHoja[]
  iniciativa: number
  ca: { valor: number; detalle: string }
  velocidad: Record<string, number>
  sentidos: { nombre: string; valor: number }[]
  percepcionPasiva: number
  pgMax: number
  dadosGolpe: { caras: number; total: number }[]
  competencias: { armas: string[]; armaduras: string[]; herramientas: string[]; idiomas: string[] }
  resistencias: string[]
  inmunidades: string[]
  inmunidadesCondicion: string[]
  ataques: AtaqueHoja[]
  lanzamiento: { clase: string; nombre: string; car: Caracteristica; cd: number; ataque: number; nivelMax: number }[]
  espacios: number[]
  pacto?: { n: number; nivel: number }
  conjuros: ConjuroHoja[]
  recursos: RecursoHoja[]
  rasgos: RasgoObtenido[]
  notas: { texto: string; origen: string }[]
  bonosCondicionales: { texto: string; origen: string }[]
  columnas: { clase: string; etiqueta: string; valor: string }[]
  sintonizados: number
  maestrias: string[]
  penalizacionD20: number
  carga: { peso: number; capacidad: number }
  resolucion: Resolucion
}

// Tabla de espacios de conjuro de lanzador completo (y de multiclase)
const ESPACIOS: number[][] = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

export function nivelLanzador(clases: InfoClase[]): number {
  const lanzadores = clases.filter((c) => c.lanzador && c.lanzador.progresion !== 'pact')
  if (lanzadores.length === 1) {
    const c = lanzadores[0]
    const p = c.lanzador!.progresion
    return p === 'full' ? c.nivel : p === '1/3' ? Math.ceil(c.nivel / 3) : Math.ceil(c.nivel / 2)
  }
  return lanzadores.reduce((s, c) => {
    const p = c.lanzador!.progresion
    return s + (p === 'full' ? c.nivel : p === '1/3' ? Math.floor(c.nivel / 3) : Math.ceil(c.nivel / 2))
  }, 0)
}

/** Efectos de un objeto del inventario si está activo (equipado o sintonizado). */
export function objetoActivo(it: ItemInventario, def: Crudo | undefined): boolean {
  const requiere = def?.reqAttune || def?.sintonizacion
  if (requiere) return !!it.sintonizado
  return !!it.equipado
}

function efectosDeObjeto5e(o: Crudo): Efecto[] {
  const ef: Efecto[] = []
  const n = (x: unknown) => parseInt(String(x), 10)
  if (o.bonusAc && !o.armor && o.type?.split('|')[0] !== 'S') ef.push({ tipo: 'bono', objetivo: 'ca', valor: n(o.bonusAc) })
  if (o.bonusSavingThrow) ef.push({ tipo: 'bono', objetivo: 'salvaciones', valor: n(o.bonusSavingThrow) })
  if (o.bonusAbilityCheck) ef.push({ tipo: 'bono', objetivo: 'pruebas', valor: n(o.bonusAbilityCheck) })
  if (o.bonusSpellAttack) ef.push({ tipo: 'bono', objetivo: 'ataqueConjuro', valor: n(o.bonusSpellAttack) })
  if (o.bonusSpellSaveDc) ef.push({ tipo: 'bono', objetivo: 'cdConjuros', valor: n(o.bonusSpellSaveDc) })
  if (o.ability?.static) for (const [c, v] of Object.entries(o.ability.static)) ef.push({ tipo: 'fijarCaracteristica', car: c as Caracteristica, valor: v as number })
  for (const c of CARACTERISTICAS) if (typeof o.ability?.[c] === 'number') ef.push({ tipo: 'caracteristica', car: c, valor: o.ability[c], max: 30 })
  for (const r of o.resist ?? []) if (typeof r === 'string') ef.push({ tipo: 'resistencia', valor: r })
  for (const r of o.immune ?? []) if (typeof r === 'string') ef.push({ tipo: 'inmunidad', valor: r })
  for (const r of o.conditionImmune ?? []) if (typeof r === 'string') ef.push({ tipo: 'inmunidadCondicion', valor: r })
  if (o.modifySpeed?.equal) for (const [m, v] of Object.entries(o.modifySpeed.equal)) ef.push({ tipo: 'velocidad', modo: modo(m), valor: v === 'walk' ? 'velocidad' : (v as number), fijar: true })
  if (o.modifySpeed?.bonus) for (const [m, v] of Object.entries(o.modifySpeed.bonus)) ef.push({ tipo: 'velocidad', modo: modo(m), valor: v as number })
  if (o.modifySpeed?.static) for (const [m, v] of Object.entries(o.modifySpeed.static)) ef.push({ tipo: 'velocidad', modo: modo(m), valor: v as number, fijar: true })
  return ef
}

type Modo = 'andar' | 'nado' | 'vuelo' | 'trepar' | 'excavar'
const modo = (m: string): Modo => (({ walk: 'andar', swim: 'nado', fly: 'vuelo', climb: 'trepar', burrow: 'excavar' }) as Record<string, Modo>)[m] ?? 'andar'

export function derivar(p: Personaje, d: Datos, catalogo: ObjetoCampaña[] = []): Hoja {
  const r = resolver(p, d)
  const nivel = Math.max(1, r.nivel)
  const pb = bonoCompetencia(nivel)
  const efectos: Efecto[] = [...r.efectos]
  const conjurosExtra: ConjuroObtenido[] = []
  const recursos: RecursoHoja[] = []

  // ── Objetos activos
  let sintonizados = 0
  const armaduras: { it: ItemInventario; o: Crudo }[] = []
  const armas: { it: ItemInventario; o: Crudo; extra?: ObjetoCampaña }[] = []
  for (const it of p.inventario) {
    const de5e = it.origen === '5etools' ? d.objetos.find((o) => o._clave === it.ref) : undefined
    const camp = it.origen === 'campaña' ? catalogo.find((o) => o.id === it.ref) : undefined
    const base = camp?.base ? d.objetos.find((o) => o._clave === claveDeRef(camp.base!)) : undefined
    const def: Crudo | undefined = de5e ?? (camp ? { ...base, reqAttune: camp.sintonizacion } : undefined)
    if (it.sintonizado) sintonizados++
    const tipoBase = String((de5e ?? base)?.type ?? '').split('|')[0]
    const esArmadura = ['LA', 'MA', 'HA', 'S'].includes(tipoBase)
    const esArma = !!(de5e ?? base)?.weapon
    if (esArmadura && it.equipado) armaduras.push({ it, o: { ...(de5e ?? base), ...(camp ? { bonusAc: (camp.efectos.find((e) => e.tipo === 'bono' && e.objetivo === 'ca') as { valor?: number } | undefined)?.valor } : {}) } })
    if (esArma) armas.push({ it, o: de5e ?? base!, extra: camp })
    if (!objetoActivo(it, def)) continue
    const nombre = it.nombre
    if (de5e) {
      efectos.push(...efectosDeObjeto5e(de5e).map((e) => ({ ...e, origen: nombre })))
      for (const s of (de5e.attachedSpells as string[]) ?? []) conjurosExtra.push({ clave: claveDeRef(s), origen: nombre, siempre: true })
      if (de5e.charges) recursos.push({ id: `obj:${it.id}`, nombre: `${nombre} (charges)`, max: Number(de5e.charges), recarga: 'amanecer', origen: nombre })
    }
    if (camp) {
      for (const e of camp.efectos) {
        if (e.tipo === 'conjuro') conjurosExtra.push({ clave: e.conjuro, origen: nombre, siempre: true, usos: e.usos as number | undefined, recarga: e.recarga, caracteristica: e.caracteristica })
        else if (!(esArmadura && e.tipo === 'bono' && e.objetivo === 'ca') && !(esArma && e.tipo === 'bono' && ['ataque', 'dano'].includes(e.objetivo)))
          efectos.push({ ...e, origen: nombre })
      }
      if (camp.cargas) recursos.push({ id: `obj:${it.id}`, nombre: `${nombre} (charges)`, max: camp.cargas.max, recarga: camp.cargas.recarga, origen: nombre })
    }
    for (const e of it.efectos ?? []) efectos.push({ ...e, origen: nombre })
  }

  // ── Características
  const base = { ...p.caracteristicas.base }
  const valores = {} as Record<Caracteristica, number>
  for (const c of CARACTERISTICAS) {
    let v = base[c] ?? 10
    // Un aumento no puede superar su máximo (20 normalmente), pero tampoco rebaja un valor ya mayor
    for (const a of r.aumentos.filter((a) => a.car === c)) v = Math.max(v, Math.min(v + a.valor, a.max))
    for (const e of efectos) if (e.tipo === 'caracteristica' && e.car === c) v = Math.min(v + e.valor, e.max ?? 20)
    for (const e of efectos) if (e.tipo === 'fijarCaracteristica' && e.car === c) v = Math.max(v, e.valor)
    valores[c] = v
  }
  const mod = (c: Caracteristica) => modificador(valores[c])
  let velocidadBase = 30
  const nivelesClase: Record<string, number> = Object.fromEntries(r.clases.map((c) => [c.clase.name, c.nivel]))
  const vars = (n: string) => {
    if (n === 'pb') return pb
    if (n === 'nivel') return nivel
    if ((CARACTERISTICAS as string[]).includes(n)) return mod(n as Caracteristica)
    if (n.startsWith('nivel:')) return nivelesClase[n.slice(6)] ?? 0
    if (n === 'velocidad') return velocidadBase
    return 0
  }
  const ev = (f: number | string | undefined) => evaluar(f, vars)
  const bonos = (obj: string) => efectos.filter((e) => e.tipo === 'bono' && e.objetivo === obj && !e.condicion).reduce((s, e) => s + ev((e as { valor: number | string }).valor), 0)
  const bonosCondicionales = efectos
    .filter((e) => e.tipo === 'bono' && e.condicion && e.condicion !== 'armadura')
    .map((e) => ({ texto: `${(e as { objetivo: string }).objetivo} +${ev((e as { valor: number | string }).valor)} (${e.condicion})`, origen: e.origen ?? '' }))

  // ── Competencias
  const comp = (cat: string) => [...new Set(efectos.filter((e) => e.tipo === 'competencia' && e.categoria === cat).map((e) => (e as { valor: string }).valor))]
  const salvComp = new Set(comp('salvacion'))
  const habComp = new Set(comp('habilidad'))
  const pericias = new Set(efectos.filter((e) => e.tipo === 'pericia').map((e) => (e as { valor: string }).valor))
  const agot = p.estado.agotamiento ?? 0
  const penalizacionD20 = -2 * agot

  const car = {} as Hoja['car']
  for (const c of CARACTERISTICAS) {
    const comp_ = salvComp.has(c)
    car[c] = { valor: valores[c], mod: mod(c), competenteSalv: comp_, salvacion: mod(c) + (comp_ ? pb : 0) + bonos('salvaciones') + bonos(`salvacion:${c}`) }
  }
  const dadosHab = efectos.filter((e) => e.tipo === 'dadoHabilidad') as Extract<Efecto, { tipo: 'dadoHabilidad' }>[]
  const sustituidos = new Set(dadosHab.map((x) => x.sustituye).filter(Boolean))
  const habilidades: HabilidadHoja[] = d.habilidades.map((h) => {
    const competente = habComp.has(h.clave)
    const pericia = competente && pericias.has(h.clave)
    return {
      clave: h.clave,
      nombre: h.nombre,
      car: h.caracteristica,
      competente,
      pericia,
      bono: mod(h.caracteristica) + (pericia ? 2 * pb : competente ? pb : 0) + bonos('pruebas') + bonos(`prueba:${h.caracteristica}`) + bonos(`habilidad:${h.clave}`),
      dados: dadosHab.filter((x) => x.habilidades.includes(h.clave) && !sustituidos.has(x.origen)).map((x) => x.dado),
    }
  })

  // ── Velocidad y sentidos
  const velEf = efectos.filter((e) => e.tipo === 'velocidad') as Extract<Efecto, { tipo: 'velocidad' }>[]
  for (const v of velEf.filter((v) => (v.modo ?? 'andar') === 'andar' && v.fijar)) velocidadBase = Number(ev(v.valor))
  const armaduraPuesta = armaduras.find((a) => ['LA', 'MA', 'HA'].includes(String(a.o.type).split('|')[0]))
  const escudo = armaduras.find((a) => String(a.o.type).split('|')[0] === 'S')
  const condicionVel = (c?: string) =>
    !c || (c === 'sin armadura pesada' ? String(armaduraPuesta?.o.type ?? '').split('|')[0] !== 'HA' : c === 'sin armadura ni escudo' ? !armaduraPuesta && !escudo : true)
  const velocidad: Record<string, number> = { andar: velocidadBase }
  for (const v of velEf) {
    const m = v.modo ?? 'andar'
    if (!condicionVel(v.condicion)) continue
    if (v.fijar && m !== 'andar') velocidad[m] = Math.max(velocidad[m] ?? 0, Number(ev(v.valor)))
    else if (!v.fijar) velocidad[m] = (velocidad[m] ?? (m === 'andar' ? velocidadBase : 0)) + Number(ev(v.valor))
  }
  if (armaduraPuesta?.o.strength && valores.str < Number(armaduraPuesta.o.strength)) velocidad.andar -= 10
  if (agot) for (const k of Object.keys(velocidad)) velocidad[k] = Math.max(0, velocidad[k] - 5 * agot)
  const sentidosMap: Record<string, number> = {}
  for (const e of efectos) if (e.tipo === 'sentido') sentidosMap[e.nombre] = Math.max(sentidosMap[e.nombre] ?? 0, Number(ev(e.valor)))
  // Drow: visión en la oscuridad 120
  if (p.elecciones['esp:variante']?.[0] === 'Drow') sentidosMap.Darkvision = Math.max(sentidosMap.Darkvision ?? 0, 120)

  // ── CA
  const opcionesCA: { valor: number; detalle: string }[] = []
  const bonoEscudo = escudo ? (Number(escudo.o.ac) || 2) + (parseInt(String(escudo.o.bonusAc ?? 0), 10) || 0) : 0
  const tieneArmaduraComp = (tipo: string) => comp('armadura').includes(({ LA: 'light', MA: 'medium', HA: 'heavy' } as Record<string, string>)[tipo])
  if (armaduraPuesta) {
    const t = String(armaduraPuesta.o.type).split('|')[0]
    const dex = t === 'LA' ? mod('dex') : t === 'MA' ? Math.min(2, mod('dex')) : 0
    const magia = parseInt(String(armaduraPuesta.o.bonusAc ?? 0), 10) || 0
    opcionesCA.push({ valor: Number(armaduraPuesta.o.ac) + dex + magia + bonoEscudo, detalle: `${armaduraPuesta.it.nombre}${escudo ? ' + shield' : ''}` })
  } else {
    opcionesCA.push({ valor: 10 + mod('dex') + bonoEscudo, detalle: `10 + DEX${escudo ? ' + shield' : ''}` })
    for (const e of efectos) {
      if (e.tipo !== 'caBase') continue
      if (escudo && !e.escudo) continue
      opcionesCA.push({ valor: ev(e.formula) + (escudo ? bonoEscudo : 0), detalle: e.nombre })
    }
  }
  const mejorCA = opcionesCA.sort((a, b) => b.valor - a.valor)[0]
  const caDefensa = armaduraPuesta ? efectos.filter((e) => e.tipo === 'bono' && e.objetivo === 'ca' && e.condicion === 'armadura').reduce((s, e) => s + ev((e as { valor: number }).valor), 0) : 0
  const ca = { valor: mejorCA.valor + bonos('ca') + caDefensa, detalle: mejorCA.detalle }
  if (armaduraPuesta && !tieneArmaduraComp(String(armaduraPuesta.o.type).split('|')[0])) ca.detalle += ' (sin competencia: desventaja en STR/DEX y sin conjuros)'

  // ── PG
  const pgNivel = bonos('pgPorNivel')
  const pgMax = Math.max(1, r.pgPorNivel.reduce((s, v) => s + v, 0) + nivel * (mod('con') + pgNivel) + bonos('pgMax'))
  const dadosGolpe = r.clases.map((c) => ({ caras: c.clase.hd.faces, total: c.nivel }))

  // ── Ataques
  const maestrias = efectos.filter((e) => e.tipo === 'nota' && e.texto.startsWith('maestria:')).map((e) => (e as { texto: string }).texto.slice(9))
  const armasComp = comp('arma')
  const ataques: AtaqueHoja[] = []
  const bonoCuerpo = bonos('ataque') + bonos('ataqueCuerpo')
  const bonoDist = bonos('ataque') + bonos('ataqueDistancia')
  for (const { it, o, extra } of armas) {
    if (!it.equipado) continue
    const props = ((o.property as string[]) ?? []).map((x) => (typeof x === 'string' ? x.split('|')[0] : (x as Crudo).uid?.split('|')[0]))
    const distancia = String(o.type).split('|')[0] === 'R'
    const fin = props.includes('F')
    const carAt: Caracteristica = fin ? (mod('dex') >= mod('str') ? 'dex' : 'str') : distancia ? 'dex' : 'str'
    const baseNombre = (o.baseItem ? String(o.baseItem).split('|')[0] : o.name).toLowerCase()
    const competente = armasComp.some((a) => a === o.weaponCategory || a === baseNombre || (a === 'martial ranged' && o.weaponCategory === 'martial' && distancia) || a.startsWith('martial melee') && o.weaponCategory === 'martial' && !distancia && !props.includes('2H') && !props.includes('H'))
    const magia = parseInt(String(o.bonusWeapon ?? 0), 10) || 0
    const magiaAt = magia + (parseInt(String(o.bonusWeaponAttack ?? 0), 10) || 0) + (extra ? extra.efectos.filter((e) => e.tipo === 'bono' && e.objetivo === 'ataque').reduce((s, e) => s + ev((e as { valor: number }).valor), 0) : 0)
    const magiaDa = magia + (parseInt(String(o.bonusWeaponDamage ?? 0), 10) || 0) + (extra ? extra.efectos.filter((e) => e.tipo === 'bono' && e.objetivo === 'dano').reduce((s, e) => s + ev((e as { valor: number }).valor), 0) : 0)
    const m = mod(carAt) + magiaDa + bonos('dano')
    const claveBase = o.baseItem ? claveDeRef(o.baseItem) : o._clave
    const tieneMaestria = maestrias.includes(claveBase) || maestrias.includes(o._clave)
    ataques.push({
      id: it.id,
      nombre: it.nombre,
      bonoAtaque: mod(carAt) + (competente ? pb : 0) + magiaAt + (distancia ? bonoDist : bonoCuerpo),
      dano: `${o.dmg1 ?? '1'}${m ? (m > 0 ? `+${m}` : m) : ''}`,
      versatil: o.dmg2 ? `${o.dmg2}${m ? (m > 0 ? `+${m}` : m) : ''}` : undefined,
      tipoDano: ({ S: 'slashing', P: 'piercing', B: 'bludgeoning' } as Record<string, string>)[o.dmgType] ?? o.dmgType ?? '',
      alcance: o.range ? `${o.range} ft` : props.includes('R') ? '10 ft' : '5 ft',
      propiedades: props,
      maestria: tieneMaestria && o.mastery ? String(o.mastery[0]).split('|')[0] : undefined,
      origen: extra ? 'Objeto de la campaña' : 'Inventario',
    })
  }
  ataques.push({ id: 'unarmed', nombre: 'Unarmed Strike', bonoAtaque: mod('str') + pb + bonoCuerpo, dano: `${Math.max(1, 1 + mod('str'))}`, tipoDano: 'bludgeoning', propiedades: [], origen: 'Reglas', alcance: '5 ft' })
  for (const e of efectos) {
    if (e.tipo !== 'ataque') continue
    const c: Caracteristica = e.car === 'mejorFuerzaDestreza' ? (mod('dex') >= mod('str') ? 'dex' : 'str') : e.car === 'conjuro' || !e.car ? 'str' : e.car
    const m = mod(c)
    ataques.push({
      id: `ef:${e.nombre}`, nombre: e.nombre, bonoAtaque: m + (e.competente !== false ? pb : 0) + ev(e.bonoAtaque ?? 0) + bonoCuerpo,
      dano: `${e.dano}${m ? (m > 0 ? `+${m}` : m) : ''}`, tipoDano: e.tipoDano, alcance: e.alcance ?? '5 ft', propiedades: [], origen: e.origen ?? '',
    })
  }
  // Unarmed Strike (Martial Arts) sustituye al ataque desarmado básico
  if (ataques.some((a) => a.id.startsWith('ef:Unarmed Strike'))) ataques.splice(ataques.findIndex((a) => a.id === 'unarmed'), 1)

  // ── Conjuros
  const lanzamiento: Hoja['lanzamiento'] = r.clases
    .filter((c) => c.lanzador)
    .map((c) => {
      const cc = c.lanzador!.caracteristica
      return { clase: c.clase.name, nombre: c.clase._nombre, car: cc, cd: 8 + pb + mod(cc) + bonos('cdConjuros'), ataque: pb + mod(cc) + bonos('ataqueConjuro'), nivelMax: 0 }
    })
  const nl = nivelLanzador(r.clases)
  const espacios = [...(ESPACIOS[Math.min(20, nl)] ?? [])]
  const brujo = r.clases.find((c) => c.lanzador?.progresion === 'pact')
  const pacto = brujo ? { n: Number(columnaClase(brujo.clase, brujo.subclase, 'Spell Slots', brujo.nivel)) || 1, nivel: Number(columnaClase(brujo.clase, brujo.subclase, 'Slot Level', brujo.nivel)) || 1 } : undefined
  for (const l of lanzamiento) l.nivelMax = l.clase === 'Warlock' ? pacto?.nivel ?? 1 : espacios.length

  const mejorMental = (['int', 'wis', 'cha'] as Caracteristica[]).sort((a, b) => mod(b) - mod(a))[0]
  const conjuros: ConjuroHoja[] = []
  const vistos = new Map<string, ConjuroHoja>()
  for (const c of [...r.conjuros, ...conjurosExtra]) {
    const cj = d.conjuros.find((x) => x._clave === c.clave)
    if (!cj) continue
    const l = lanzamiento.find((x) => x.clase === c.clase)
    const cc: Caracteristica = c.caracteristica ?? l?.car ?? lanzamiento[0]?.car ?? mejorMental
    const usos = typeof c.usos === 'string' && c.usos !== 'voluntad' ? Math.max(1, ev(c.usos)) : (c.usos as number | 'voluntad' | undefined)
    const clave = `${c.clave}|${c.origen}`
    const prev = vistos.get(c.clave)
    // Un mismo conjuro preparado por la clase y siempre preparado por otra fuente: se queda el «siempre»
    if (prev && !usos && !c.recurso && prev.origen !== c.origen && (prev.siempre || !c.siempre)) continue
    const h: ConjuroHoja = {
      conjuro: cj, origen: c.origen, preparado: c.siempre || !c.enLibro, siempre: c.siempre, usos, recarga: c.recarga,
      idRecurso: usos && usos !== 'voluntad' ? `conj:${clave}` : undefined,
      cd: 8 + pb + mod(cc) + bonos('cdConjuros'), ataque: pb + mod(cc) + bonos('ataqueConjuro'), car: cc, ritual: c.ritual, recurso: c.recurso,
    }
    if (c.enLibro) h.preparado = (p.elecciones[`cls:${c.clase}:preparados`] ?? []).includes(c.clave)
    if (prev && prev.origen !== c.origen && !prev.usos && (h.siempre || h.usos)) conjuros.splice(conjuros.indexOf(prev), 1)
    vistos.set(c.clave, h)
    conjuros.push(h)
    if (h.idRecurso) recursos.push({ id: h.idRecurso, nombre: `${cj.name} (${c.origen})`, max: usos as number, recarga: c.recarga ?? 'largo', origen: c.origen })
  }
  // Libro de hechizos del mago: los no preparados también aparecen
  for (const v of p.elecciones['cls:Wizard:libro'] ?? []) {
    if (conjuros.some((c) => c.conjuro._clave === v)) continue
    const cj = d.conjuros.find((x) => x._clave === v)
    const l = lanzamiento.find((x) => x.clase === 'Wizard')
    if (cj && l) conjuros.push({ conjuro: cj, origen: 'Spellbook', preparado: false, siempre: false, cd: l.cd, ataque: l.ataque, car: l.car })
  }
  conjuros.sort((a, b) => a.conjuro.level - b.conjuro.level || a.conjuro.name.localeCompare(b.conjuro.name))

  // ── Recursos
  for (const e of efectos) {
    if (e.tipo !== 'recurso') continue
    const id = `rec:${e.nombre}`
    const i = recursos.findIndex((x) => x.id === id)
    const rec: RecursoHoja = { id, nombre: e.nombre, max: Math.max(0, ev(e.usos)), recarga: e.recarga, recargaCorta: e.recargaCorta !== undefined ? ev(e.recargaCorta) : undefined, dado: e.dado, origen: e.origen ?? '' }
    if (i >= 0) recursos[i] = rec
    else recursos.push(rec)
  }
  for (const m of p.recursosManuales) recursos.push({ id: `man:${m.id}`, nombre: m.nombre, max: m.max, recarga: m.recarga, origen: 'Manual' })

  // ── Columnas informativas de la tabla de clase (Rage Damage, Sneak Attack, Martial Arts...)
  const columnas: Hoja['columnas'] = []
  for (const c of r.clases) {
    for (const g of [...(c.clase.classTableGroups ?? []), ...(c.subclase?.subclassTableGroups ?? [])] as Crudo[]) {
      if (g.title) continue // tablas de espacios
      for (const lab of g.colLabels as string[]) {
        const limpio = lab.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
        if (/Cantrips|Prepared|Spell Slots|Slot Level|Invocations/i.test(limpio)) continue
        const v = columnaClase(c.clase, c.subclase, limpio, c.nivel)
        if (v !== undefined && v !== 0 && v !== '—') columnas.push({ clase: c.clase._nombre, etiqueta: limpio, valor: String(v) })
      }
    }
  }

  const notas = efectos.filter((e) => e.tipo === 'nota' && !/^(maestria|plano):/.test(e.texto)).map((e) => ({ texto: (e as { texto: string }).texto, origen: e.origen ?? '' }))
  const dex = mod('dex')
  const percepcion = habilidades.find((h) => h.clave === 'perception')!
  const peso = p.inventario.reduce((s, it) => s + (it.peso ?? Number(d.objetos.find((o) => o._clave === it.ref)?.weight ?? 0)) * it.cantidad, 0)

  return {
    nivel,
    pb,
    car,
    habilidades,
    iniciativa: dex + bonos('iniciativa'),
    ca,
    velocidad,
    sentidos: Object.entries(sentidosMap).map(([nombre, valor]) => ({ nombre, valor })),
    percepcionPasiva: 10 + percepcion.bono + bonos('percepcionPasiva'),
    pgMax,
    dadosGolpe,
    competencias: { armas: armasComp, armaduras: comp('armadura'), herramientas: comp('herramienta'), idiomas: comp('idioma') },
    resistencias: [...new Set(efectos.filter((e) => e.tipo === 'resistencia').map((e) => (e as { valor: string }).valor))],
    inmunidades: [...new Set(efectos.filter((e) => e.tipo === 'inmunidad').map((e) => (e as { valor: string }).valor))],
    inmunidadesCondicion: [...new Set(efectos.filter((e) => e.tipo === 'inmunidadCondicion').map((e) => (e as { valor: string }).valor))],
    ataques,
    lanzamiento,
    espacios,
    pacto,
    conjuros,
    recursos,
    rasgos: r.rasgos,
    notas,
    bonosCondicionales,
    columnas,
    sintonizados,
    maestrias,
    penalizacionD20,
    carga: { peso, capacidad: valores.str * 15 },
    resolucion: r,
  }
}

export type { Entidad }
