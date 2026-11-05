// La mesa: lo que el DM comparte con los jugadores (iniciativa del combate y relojes visibles),
// los relojes y apuntes de la Pantalla del DM, y el daño y la curación que el DM aplica a los PJs.
import type { EstadoJuego } from '../motor/personaje'
import type { FilaIniciativa } from '../ui/dm/iniciativa'
import type { PantallaDM } from './pantalla'

/** Reloj de la Pantalla del DM: cuenta atrás en tiempo real o reloj de pasos (se marcan a mano). */
export interface Reloj {
  id: string
  nombre: string
  modo: 'tiempo' | 'pasos'
  /** Tiempo: duración en segundos. Pasos: número de pasos. */
  total: number
  /** Tiempo: milisegundos que quedan mientras está parado. */
  restante: number
  /** Tiempo: momento (ms desde 1970) en que acaba, si está en marcha. */
  fin?: number
  /** Pasos: pasos marcados. */
  hechos: number
  /** Los jugadores lo ven en la mesa. */
  visible: boolean
}

/** Apunte rápido del DM durante la sesión. */
export interface Apunte {
  id: string
  texto: string
  fecha: string
  /** Ronda del combate en que se apuntó. */
  ronda?: number
}

export type Salud = 'ileso' | 'herido' | 'malherido' | 'caido'

export const TEXTO_SALUD: Record<Salud, string> = { ileso: 'Ileso', herido: 'Herido', malherido: 'Malherido', caido: 'Caído' }

/** Salud a la vista: los jugadores no ven los PG de las criaturas, solo cómo están (malherido: la mitad o menos). */
export function saludDe(pg: number, max: number): Salud {
  if (pg <= 0) return 'caido'
  if (pg >= max) return 'ileso'
  return pg * 2 <= max ? 'malherido' : 'herido'
}

export interface FilaPublica {
  id: string
  tipo: FilaIniciativa['tipo']
  nombre: string
  valor?: number
  salud?: Salud
  /** PG a la vista (solo PJs y sus aliados). */
  pg?: string
  condiciones: string[]
}

export interface MesaPublica {
  combate?: { ronda: number; turno?: string; filas: FilaPublica[] }
  relojes: Reloj[]
  actualizado: string
}

export interface PjPublico {
  id: string
  pg: number
  pgMax: number
  pgTemporales: number
  condiciones: string[]
}

/** Lo que ven los jugadores: el orden de iniciativa (sin criaturas ocultas ni PG de criaturas) y los relojes visibles. */
export function construirMesa(p: PantallaDM, filas: FilaIniciativa[], pjs: PjPublico[]): Omit<MesaPublica, 'actualizado'> {
  const relojes = (p.relojes ?? []).filter((r) => r.visible)
  if (!p.combate.activo || p.mesaOculta) return { relojes }
  const out: FilaPublica[] = filas.map((f) => {
    if (f.tipo === 'pj') {
      const pj = pjs.find((x) => `pj:${x.id}` === f.id)
      return {
        id: f.id, tipo: f.tipo, nombre: f.nombre, valor: f.valor, condiciones: pj?.condiciones ?? [],
        salud: pj ? saludDe(pj.pg, pj.pgMax) : undefined,
        pg: pj ? `${pj.pg}/${pj.pgMax}${pj.pgTemporales ? ` +${pj.pgTemporales}` : ''}` : undefined,
      }
    }
    if (f.tipo === 'aliado' && f.aliado)
      return { id: f.id, tipo: f.tipo, nombre: f.nombre, valor: f.valor, condiciones: f.aliado.condiciones ?? [], salud: saludDe(f.aliado.pg, f.aliado.pgMax), pg: `${f.aliado.pg}/${f.aliado.pgMax}` }
    if (f.tipo === 'guarida') return { id: f.id, tipo: f.tipo, nombre: 'Guarida', valor: f.valor, condiciones: [] }
    const c = f.criatura!
    return { id: f.id, tipo: f.tipo, nombre: f.nombre, valor: f.valor, condiciones: c.condiciones, salud: saludDe(c.pg, c.plantilla.pgMax) }
  })
  // Sin valores undefined: Firestore no los admite y además así la comparación es estable
  return { combate: JSON.parse(JSON.stringify({ ronda: p.combate.ronda, turno: p.combate.turno, filas: out })), relojes }
}

// ── Relojes

export const restanteReloj = (r: Reloj, ahora: number) => (r.fin !== undefined ? Math.max(0, r.fin - ahora) : r.restante)

export function formatoTiempo(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function nuevoReloj(id: string, nombre: string, modo: Reloj['modo'], total: number, visible: boolean): Reloj {
  return { id, nombre, modo, total, restante: modo === 'tiempo' ? total * 1000 : 0, hechos: 0, visible }
}

/** Pone en marcha o para una cuenta atrás. */
export function alternarReloj(r: Reloj, ahora: number) {
  if (r.modo !== 'tiempo') return
  if (r.fin !== undefined) {
    r.restante = restanteReloj(r, ahora)
    delete r.fin
  } else if (r.restante > 0) r.fin = ahora + r.restante
}

/** Suma (o resta) segundos a una cuenta atrás, en marcha o parada. */
export function sumarReloj(r: Reloj, segundos: number, ahora: number) {
  const nuevo = Math.max(0, restanteReloj(r, ahora) + segundos * 1000)
  if (r.fin !== undefined) r.fin = ahora + nuevo
  else r.restante = nuevo
}

export function reiniciarReloj(r: Reloj) {
  delete r.fin
  r.restante = r.total * 1000
  r.hechos = 0
}

// ── Daño y curación de los PJs (reglas de 2024)

/**
 * Aplica daño a un PJ: primero se gastan los PG temporales. Devuelve los avisos para el DM:
 * salvación de Concentración, salvaciones de muerte falladas si ya estaba a 0 y muerte instantánea.
 */
export function dañarPj(e: EstadoJuego, pgMax: number, n: number, critico = false): string[] {
  const avisos: string[] = []
  if (n <= 0) return avisos
  const antes = e.pgActuales ?? pgMax
  const absorbe = Math.min(e.pgTemporales, n)
  e.pgTemporales -= absorbe
  const resto = n - absorbe
  if (!resto) return avisos
  if (antes === 0) {
    if (resto >= pgMax) avisos.push('Muerte instantánea: el daño iguala o supera sus PG máximos')
    else {
      const f = critico ? 2 : 1
      e.salvacionesMuerte.fallos = Math.min(3, e.salvacionesMuerte.fallos + f)
      avisos.push(`A 0 PG: ${f > 1 ? '2 salvaciones de muerte falladas' : '1 salvación de muerte fallada'}${e.salvacionesMuerte.fallos >= 3 ? ' (muere)' : ''}`)
    }
  } else {
    e.pgActuales = Math.max(0, antes - resto)
    if (e.pgActuales === 0) {
      if (resto - antes >= pgMax) avisos.push('Muerte instantánea: el daño sobrante iguala o supera sus PG máximos')
      else avisos.push('Cae a 0 PG: inconsciente')
    }
  }
  if (e.concentracion && e.pgActuales === 0) {
    avisos.push(`Pierde la Concentración (${e.concentracion})`)
    delete e.concentracion
  } else if (e.concentracion) avisos.push(`Concentración (${e.concentracion}): salvación de CON CD ${Math.min(30, Math.max(10, Math.floor(resto / 2)))}`)
  return avisos
}

export function curarPj(e: EstadoJuego, pgMax: number, n: number) {
  if (n <= 0) return
  e.pgActuales = Math.min(pgMax, (e.pgActuales ?? pgMax) + n)
  if (e.pgActuales > 0) e.salvacionesMuerte = { exitos: 0, fallos: 0 }
}
