// Convierte los JSON crudos de 5etools en el conjunto de datos de la app:
// filtra por las fuentes de la adaptación, resuelve copias y aplica la capa del setting.
import type { Clase, Conjuro, Crudo, Datos, Entidad, Rasgo, Subclase, Caracteristica } from './tipos'
import { FUENTES_CLASE, FUENTES_OBJETOS, FUENTES_PERSONAJE, FUENTES_SUBCLASE, VERSION_5ETOOLS, CLASES_5ETOOLS } from './fuentes'
import { claveDeRasgoCrudo, claveEntidad } from './refs'
import campaña from '../setting/campaña.json'
import especiesSetting from '../setting/especies.json'
import subclasesSetting from '../setting/subclases.json'
import trasfondosSetting from '../setting/trasfondos.json'
import { esDoteSustituida, generarDotesMarca } from '../setting/marcas'

export const VERSION_SETTING = `${campaña.version}`
export const VERSION_DATOS = `${VERSION_5ETOOLS}+s${VERSION_SETTING}+a3`

const ABREV: Record<string, Caracteristica> = {
  Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha',
}

/** Resuelve un `_copy` sencillo (sin `_mod`, o con los modos más comunes). */
function resolverCopia(e: Crudo, lista: Crudo[]): Crudo {
  if (!e._copy) return e
  const c = e._copy
  const orig = lista.find((x) => x.name === c.name && x.source === c.source)
  if (!orig) return e
  const base = resolverCopia(orig, lista)
  const res: Crudo = { ...base, ...e }
  delete res._copy
  if (c._mod) {
    for (const [campo, mods] of Object.entries(c._mod as Crudo)) {
      for (const m of [mods].flat() as Crudo[]) {
        const arr = [...(res[campo] ?? [])]
        if (m.mode === 'appendArr') res[campo] = [...arr, ...[m.items].flat()]
        else if (m.mode === 'prependArr') res[campo] = [...[m.items].flat(), ...arr]
        else if (m.mode === 'replaceArr') {
          const i = arr.findIndex((x) => (typeof x === 'object' ? x.name : x) === m.replace)
          if (i >= 0) arr.splice(i, 1, ...[m.items].flat())
          res[campo] = arr
        } else if (m.mode === 'removeArr') {
          const nombres = [m.names].flat()
          res[campo] = arr.filter((x) => !nombres.includes(typeof x === 'object' ? x.name : x))
        }
      }
    }
  }
  return res
}

/**
 * Corrige el oro del equipo inicial con el texto del libro: 5etools tiene algún valor mal
 * (la opción A del clérigo da 7 GP en el libro y 70 en los datos).
 */
function corregirOro(bloques: Crudo[] | undefined, texto: unknown): Crudo[] | undefined {
  if (!bloques) return bloques
  const t = JSON.stringify(texto ?? '')
  return bloques.map((b) => {
    const r: Crudo = { ...b }
    for (const k of Object.keys(b)) {
      const m = new RegExp(`\\(${k}\\)[^;(]*?(\\d+) GP`).exec(t)
      if (!m) continue
      const cp = Number(m[1]) * 100
      r[k] = (b[k] as Crudo[]).map((it) => (it.value !== undefined ? { ...it, value: cp } : it))
    }
    return r
  })
}

function entidad<T extends Entidad>(e: Crudo, nombre?: string, setting?: string): T {
  return { ...e, _clave: claveEntidad(e.name, e.source), _nombre: nombre ?? e.name, _setting: setting } as T
}

const enFuentes = (f: string[]) => (e: Crudo) => f.includes(e.source)

export function construirDatos(crudos: Record<string, Crudo>): Datos {
  const clases: Clase[] = []
  const subclases: Subclase[] = []
  const rasgos: Record<string, Rasgo> = {}
  const settingClases = campaña.clases as Record<string, { nombre: string; fuente: string; setting: string }>
  const settingSub = subclasesSetting as Record<string, { nombre: string; setting: string }>

  for (const nombreArchivo of CLASES_5ETOOLS) {
    const archivo = crudos[`class/class-${nombreArchivo}.json`]
    if (!archivo) continue
    for (const c of archivo.class ?? []) {
      if (!FUENTES_CLASE.includes(c.source)) continue
      const s = settingClases[`${c.name}|${c.source}`]
      if (!s) continue
      const ce = c.startingEquipment ? { ...c.startingEquipment, defaultData: corregirOro(c.startingEquipment.defaultData, c.startingEquipment.entries) } : undefined
      clases.push({ ...entidad<Clase>({ ...c, startingEquipment: ce }, s.nombre, s.setting), _fuentePoder: s.fuente })
    }
    for (const sc of archivo.subclass ?? []) {
      if (!FUENTES_SUBCLASE.includes(sc.source) || !FUENTES_CLASE.includes(sc.classSource)) continue
      const s = settingSub[`${sc.className}|${sc.shortName}|${sc.source}`]
      if (!s) continue
      subclases.push(entidad<Subclase>(resolverCopia(sc, archivo.subclass), s.nombre, s.setting))
    }
    for (const lista of [archivo.classFeature ?? [], archivo.subclassFeature ?? []]) {
      for (const r0 of lista as Crudo[]) {
        if (!FUENTES_CLASE.includes(r0.classSource)) continue
        const r = resolverCopia(r0, lista)
        const ref = claveDeRasgoCrudo(r as Rasgo)
        rasgos[ref] = { ...entidad<Rasgo>(r), _ref: ref }
      }
    }
  }

  // Especies
  const settingEsp = especiesSetting as Record<string, { nombre: string; origen: string; setting: string; idiomas?: string[] }>
  const especies = (crudos['races.json']?.race ?? [])
    .filter((r: Crudo) => settingEsp[`${r.name}|${r.source}`])
    .map((r: Crudo) => {
      const s = settingEsp[`${r.name}|${r.source}`]
      return { ...entidad(r, s.nombre, s.setting), _origen: s.origen, _idiomas: s.idiomas ?? [] }
    })

  // Trasfondos: los de 5etools renombrados al setting, salvo los de las casas de Eberron (los sustituyen
  // los trasfondos propios Marcado manifiesto y Marcado invertido)
  const ren = trasfondosSetting.renombrar as Record<string, { nombre: string; setting: string }>
  const excluidoTrasfondo = (b: Crudo) =>
    trasfondosSetting.excluir.some((x) => (x.startsWith('/') ? new RegExp(x.slice(1, -1)).test(b.name) : x === `${b.name}|${b.source}`))
  const trasfondos = [
    ...(crudos['backgrounds.json']?.background ?? [])
      .filter(enFuentes(FUENTES_PERSONAJE))
      .filter((b: Crudo) => !excluidoTrasfondo(b))
      .map((b: Crudo) => {
        const s = ren[`${b.name}|${b.source}`]
        const b2 = { ...b, startingEquipment: corregirOro(b.startingEquipment, b.entries) }
        return s ? entidad(b2, s.nombre, s.setting) : entidad(b2)
      }),
    ...trasfondosSetting.nuevos.map((b) => entidad(b as Crudo, b.name, b._setting)),
  ].sort((x, y) => x._nombre.localeCompare(y._nombre, 'es'))

  // Dotes: se quitan las prerrequisitos de campaña (Eberron, Faerûn) y se añaden las marcas del setting.
  const dotesCrudas: Crudo[] = crudos['feats.json']?.feat ?? []
  const excluidas = new Set((campaña.excluir.dotes as string[]).map((d) => d.toLowerCase()))
  const dotes = [
    ...dotesCrudas
      .filter(enFuentes(FUENTES_PERSONAJE))
      .filter((f) => !esDoteSustituida(f) && !excluidas.has(`${f.name}|${f.source}`.toLowerCase()))
      .map((f) => {
        const p = f.prerequisite?.map((x: Crudo) => {
          const y = { ...x }
          delete y.campaign
          return y
        }).filter((x: Crudo) => Object.keys(x).length)
        return entidad({ ...f, prerequisite: p?.length ? p : undefined })
      }),
    ...generarDotesMarca(dotesCrudas).map((f) => entidad(f)),
  ]

  // Conjuros, con las clases a cuya lista pertenecen
  const lookup = crudos['generated/gendata-spell-source-lookup.json'] ?? {}
  const conjuros: Conjuro[] = []
  for (const arch of ['spells/spells-xphb.json', 'spells/spells-efa.json', 'spells/spells-frhof.json']) {
    for (const sp of crudos[arch]?.spell ?? []) {
      const l = lookup[sp.source.toLowerCase()]?.[sp.name.toLowerCase()]
      const cls = new Set<string>()
      for (const fc of FUENTES_CLASE) for (const n of Object.keys(l?.class?.[fc] ?? {})) cls.add(n)
      conjuros.push({ ...entidad<Conjuro>(sp), _clases: [...cls] })
    }
  }

  const opcionales = (crudos['optionalfeatures.json']?.optionalfeature ?? []).filter(enFuentes(FUENTES_PERSONAJE)).map((o: Crudo) => entidad(o))

  const base = crudos['items-base.json'] ?? {}
  const itemsCrudos: Crudo[] = crudos['items.json']?.item ?? []
  const excluirObj = new Set((campaña.excluir.objetos as string[]).map((d) => d.toLowerCase()))
  const objetos = [
    ...(base.baseitem ?? []).filter(enFuentes(FUENTES_OBJETOS)),
    ...itemsCrudos.filter(enFuentes(FUENTES_OBJETOS)).map((i) => resolverCopia(i, itemsCrudos)),
  ]
    .filter((o: Crudo) => !excluirObj.has(`${o.name}|${o.source}`.toLowerCase()))
    .map((o: Crudo) => entidad(o))

  const habilidades = (crudos['skills.json']?.skill ?? [])
    .filter((s: Crudo) => s.source === 'XPHB')
    .map((s: Crudo) => ({ nombre: s.name, clave: s.name.toLowerCase(), caracteristica: s.ability as Caracteristica }))

  return {
    version: VERSION_DATOS,
    clases,
    subclases,
    rasgos,
    especies,
    trasfondos,
    dotes,
    conjuros,
    opcionales,
    objetos,
    habilidades,
    idiomas: (crudos['languages.json']?.language ?? []).filter((l: Crudo) => l.source === 'XPHB').map((l: Crudo) => entidad(l)),
    condiciones: (crudos['conditionsdiseases.json']?.condition ?? []).filter((l: Crudo) => l.source === 'XPHB').map((l: Crudo) => entidad(l)),
    propiedadesArma: (base.itemProperty ?? []).filter((p: Crudo) => p.source === 'XPHB'),
    maestrias: (base.itemMastery ?? []).filter((p: Crudo) => p.source === 'XPHB').map((m: Crudo) => entidad(m)),
  }
}

export { ABREV }
