// Interpreta el campo `additionalSpells` de 5etools (especies, dotes, clases, subclases, trasfondos).
import type { Caracteristica, Conjuro, Crudo, Datos } from '../datos/tipos'
import { claveDeRef } from '../datos/refs'
import type { Recarga } from './efectos'

export interface FiltroConjuros {
  niveles?: number[]
  clases?: string[]
  escuelas?: string[]
  /** Solo conjuros del libro de hechizos del personaje. */
  libro?: boolean
  /** Lista cerrada de conjuros. */
  lista?: string[]
}

/** «level=0;1|class=Wizard;Cleric|school=A» → filtro. */
export function parsearFiltro(f: string): FiltroConjuros {
  const r: FiltroConjuros = {}
  for (const parte of f.split('|')) {
    const [k, v] = parte.split('=')
    const vals = (v ?? '').split(';').map((x) => x.trim()).filter(Boolean)
    if (k === 'level') r.niveles = vals.map(Number)
    else if (k === 'class') r.clases = vals.map((c) => c[0].toUpperCase() + c.slice(1))
    else if (k === 'school') r.escuelas = vals
    else if (k === 'libro') r.libro = true
  }
  return r
}

export function filtrarConjuros(d: Datos, f: FiltroConjuros, libro: string[] = []): Conjuro[] {
  return d.conjuros.filter(
    (c) =>
      (!f.niveles || f.niveles.includes(c.level)) &&
      (!f.clases || f.clases.some((cl) => c._clases.includes(cl))) &&
      (!f.escuelas || f.escuelas.includes(c.school)) &&
      (!f.libro || libro.includes(c._clave)) &&
      (!f.lista || f.lista.includes(c._clave)),
  )
}

/** Un conjuro concedido (fijo) por un bloque de additionalSpells. */
export interface ConjuroFijo {
  clave: string
  modo: 'conocido' | 'preparado' | 'innato'
  usos?: number | 'car' | 'voluntad'
  recarga?: Recarga
  ritual?: boolean
  recurso?: string
}

/** Una elección de conjuro dentro de un bloque. */
export interface ConjuroAElegir {
  filtro: FiltroConjuros
  n: number
  modo: 'conocido' | 'preparado' | 'innato'
  usos?: number | 'car' | 'voluntad'
  recarga?: Recarga
}

export interface BloqueResuelto {
  fijos: ConjuroFijo[]
  aElegir: { nivel: string; i: number; e: ConjuroAElegir }[]
  ampliaLista: { filtro?: FiltroConjuros; conjuros: string[]; nivelConjuro?: number }[]
  caracteristica?: Caracteristica | { elegir: Caracteristica[] }
}

function esNivelAlcanzado(clave: string, nivel: number): boolean {
  if (clave === '_') return true
  if (/^s\d$/.test(clave)) return true // nivel de conjuro: se filtra al lanzar
  return Number(clave) <= nivel
}

/** Lee un bloque de additionalSpells hasta el nivel dado (de clase o de personaje). */
export function resolverBloque(b: Crudo, nivel: number): BloqueResuelto {
  const res: BloqueResuelto = { fijos: [], aElegir: [], ampliaLista: [] }
  if (b.ability) res.caracteristica = typeof b.ability === 'string' ? (b.ability as Caracteristica) : { elegir: b.ability.choose as Caracteristica[] }

  const leerLista = (
    lista: unknown[],
    modo: ConjuroFijo['modo'],
    nivelClave: string,
    extra: Partial<ConjuroFijo> = {},
  ) => {
    lista.forEach((x, i) => {
      if (typeof x === 'string') res.fijos.push({ clave: claveDeRef(x), modo, ...extra })
      else if (x && typeof x === 'object' && 'choose' in x) {
        const ch = (x as Crudo).choose
        if (typeof ch === 'string') {
          res.aElegir.push({ nivel: nivelClave, i, e: { filtro: parsearFiltro(ch), n: (x as Crudo).count ?? 1, modo, ...extra } as ConjuroAElegir })
        } else {
          res.aElegir.push({
            nivel: nivelClave, i,
            e: { filtro: { lista: (ch.from as string[]).map((s) => claveDeRef(s)) }, n: ch.count ?? 1, modo, ...extra } as ConjuroAElegir,
          })
        }
      }
    })
  }

  for (const modo of ['known', 'prepared', 'innate'] as const) {
    const m = b[modo]
    if (!m) continue
    const modoEs = modo === 'known' ? 'conocido' : modo === 'prepared' ? 'preparado' : 'innato'
    for (const [nivelClave, v] of Object.entries(m as Crudo)) {
      if (!esNivelAlcanzado(nivelClave, nivel)) continue
      if (Array.isArray(v)) {
        leerLista(v, modoEs, nivelClave, modo === 'innate' ? { usos: 'voluntad' } : {})
        continue
      }
      // Objeto de frecuencias: daily, rest, ritual, will, resource
      for (const [frec, w] of Object.entries(v as Crudo)) {
        if (frec === 'ritual') leerLista(w as unknown[], modoEs, nivelClave, { ritual: true })
        else if (frec === 'will') leerLista(w as unknown[], modoEs, nivelClave, { usos: 'voluntad' })
        else if (frec === '_' && Array.isArray(w)) leerLista(w, modoEs, nivelClave)
        else {
          for (const [veces, lista] of Object.entries(w as Crudo)) {
            const num = parseInt(veces, 10)
            const usos: ConjuroFijo['usos'] = Number.isNaN(num) ? 'car' : num
            const recarga: Recarga = frec === 'rest' ? 'corto' : 'largo'
            const extra: Partial<ConjuroFijo> = frec === 'resource' ? { recurso: b.resourceName ?? 'recurso', usos } : { usos, recarga }
            leerLista(lista as unknown[], modoEs, nivelClave, extra)
          }
        }
      }
    }
  }

  if (b.expanded) {
    for (const [nivelClave, v] of Object.entries(b.expanded as Crudo)) {
      const sp = /^s(\d)$/.exec(nivelClave)
      if (!sp && !esNivelAlcanzado(nivelClave, nivel)) continue
      const conjuros: string[] = []
      for (const x of v as unknown[]) {
        if (typeof x === 'string') conjuros.push(claveDeRef(x))
        else if (x && typeof x === 'object' && 'all' in x) res.ampliaLista.push({ filtro: parsearFiltro((x as Crudo).all), conjuros: [] })
      }
      if (conjuros.length) res.ampliaLista.push({ conjuros, nivelConjuro: sp ? Number(sp[1]) : undefined })
    }
  }
  return res
}
