// Orden de iniciativa de la Pantalla del DM: PJs activos, sus aliados y las criaturas del escenario.
import type { CriaturaEscenario, PantallaDM } from '../../almacen/pantalla'
import type { Aliado } from '../../motor/personaje'

export interface PjMesa {
  id: string
  nombre: string
  bonoIniciativa: number
  aliados: Aliado[]
}

export interface FilaIniciativa {
  id: string
  tipo: 'pj' | 'criatura' | 'aliado' | 'guarida'
  nombre: string
  valor?: number
  bono: number
  /** PJ dueño (para los aliados). */
  dueño?: string
  criatura?: CriaturaEscenario
  aliado?: Aliado
  /** Aliados que actúan dentro de este turno. */
  enSuTurno: Aliado[]
}

export const idPj = (id: string) => `pj:${id}`
export const idCriatura = (id: string) => `cr:${id}`
export const idAliado = (pj: string, a: string) => `al:${pj}:${a}`
export const idGuarida = (id: string) => `gu:${id}`

/**
 * Filas ordenadas de mayor a menor iniciativa (empate: mayor bono; después, PJ antes que criatura).
 * Los aliados «tras» van justo detrás de su PJ con su mismo valor; los «turno» van dentro de la fila del PJ.
 * Las criaturas que luchan en su guarida y tienen acciones de guarida añaden una fila en la iniciativa 20, que pierde los empates.
 * Las filas sin valor quedan al final, en el orden en que se añadieron.
 */
export function ordenIniciativa(p: PantallaDM, pjs: PjMesa[]): FilaIniciativa[] {
  const v = p.combate.valores
  const filas: FilaIniciativa[] = []
  for (const pj of pjs) {
    filas.push({ id: idPj(pj.id), tipo: 'pj', nombre: pj.nombre, valor: v[idPj(pj.id)], bono: pj.bonoIniciativa, enSuTurno: pj.aliados.filter((a) => a.iniciativa === 'turno') })
    for (const a of pj.aliados.filter((a) => a.iniciativa === 'propia'))
      filas.push({ id: idAliado(pj.id, a.id), tipo: 'aliado', nombre: a.nombre, valor: v[idAliado(pj.id, a.id)], bono: a.bonoIniciativa ?? 0, dueño: pj.id, aliado: a, enSuTurno: [] })
  }
  for (const c of p.criaturas.filter((c) => !c.oculta))
    filas.push({ id: idCriatura(c.id), tipo: 'criatura', nombre: c.nombre, valor: v[idCriatura(c.id)], bono: c.plantilla.bonoIniciativa, criatura: c, enSuTurno: [] })
  // Una sola acción de guarida por tipo de criatura, aunque haya varias en la misma guarida
  const guaridas = new Set<string>()
  for (const c of p.criaturas.filter((c) => !c.oculta && c.enGuarida && c.pg > 0 && c.plantilla.guarida?.acciones.length)) {
    if (guaridas.has(c.plantilla.nombre)) continue
    guaridas.add(c.plantilla.nombre)
    filas.push({ id: idGuarida(c.id), tipo: 'guarida', nombre: `Guarida de ${c.plantilla.nombre}`, valor: 20, bono: -100, criatura: c, enSuTurno: [] })
  }

  const conValor = filas.filter((f) => f.valor !== undefined)
  const sinValor = filas.filter((f) => f.valor === undefined)
  conValor.sort((a, b) => b.valor! - a.valor! || b.bono - a.bono || (a.tipo === 'pj' ? -1 : 0) - (b.tipo === 'pj' ? -1 : 0))

  // Los aliados «tras» se insertan justo detrás de su PJ
  const out: FilaIniciativa[] = []
  for (const f of [...conValor, ...sinValor]) {
    out.push(f)
    if (f.tipo === 'pj') {
      const pj = pjs.find((x) => idPj(x.id) === f.id)!
      for (const a of pj.aliados.filter((a) => a.iniciativa === 'tras'))
        out.push({ id: idAliado(pj.id, a.id), tipo: 'aliado', nombre: a.nombre, valor: f.valor, bono: f.bono, dueño: pj.id, aliado: a, enSuTurno: [] })
    }
  }
  return out
}

/** Siguiente turno: avanza la fila y, al dar la vuelta, la ronda. */
export function siguienteTurno(filas: FilaIniciativa[], turno: string | undefined, ronda: number, atras = false): { turno?: string; ronda: number } {
  const validas = filas.filter((f) => f.valor !== undefined)
  if (!validas.length) return { turno: undefined, ronda }
  const i = validas.findIndex((f) => f.id === turno)
  if (i < 0) return { turno: validas[0].id, ronda }
  if (atras) return i === 0 ? { turno: validas[validas.length - 1].id, ronda: Math.max(1, ronda - 1) } : { turno: validas[i - 1].id, ronda }
  return i === validas.length - 1 ? { turno: validas[0].id, ronda: ronda + 1 } : { turno: validas[i + 1].id, ronda }
}
