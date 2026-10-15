// Utilidades de test: rellenar elecciones automáticamente.
import { resolver, type Eleccion } from '../src/motor/resolver'
import type { Personaje } from '../src/motor/personaje'
import type { Datos } from '../src/datos/tipos'

export function rellenar(e: Eleccion): string[] {
  if (e.tipo === 'aumento') {
    const alt = e.meta!.alternativas.find((a: { pesos?: number[] }) => a.pesos)
    return alt.pesos.map((p: number, i: number) => `${alt.de[i]}:${p}`)
  }
  if (e.tipo === 'pg') return [String(e.meta!.media)]
  const ya = new Set(e.valor)
  const nuevos = e.opciones.map((o) => o.valor).filter((v) => !ya.has(v))
  return [...e.valor, ...nuevos].slice(0, e.n)
}

/** Rellena elecciones pendientes hasta que no queden (o no se pueda avanzar). */
export function autocompletar(p: Personaje, d: Datos, preferir: Record<string, string> = {}): Eleccion[] {
  for (let i = 0; i < 60; i++) {
    const r = resolver(p, d)
    const pend = r.elecciones.filter((e) => !e.completa && e.opciones.length > 0 || (!e.completa && (e.tipo === 'aumento' || e.tipo === 'pg')))
    if (!pend.length) return r.elecciones.filter((e) => !e.completa)
    for (const e of pend) p.elecciones[e.id] = preferir[e.id] ? [preferir[e.id]] : rellenar(e)
  }
  return resolver(p, d).elecciones.filter((e) => !e.completa)
}

