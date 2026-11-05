// Sumar y gastar dinero. Al gastar, si no hay monedas de un tipo se pagan con otras y se da el cambio.
import type { Personaje } from './personaje'

export type Monedas = Personaje['monedas']
export type Moneda = 'cp' | 'sp' | 'gp' | 'pp'
export type Cantidades = Partial<Record<Moneda, number>>

/** Valor en puntas (cp). */
export const VALOR_MONEDA: Record<Moneda, number> = { cp: 1, sp: 10, gp: 100, pp: 1000 }
const DE_MENOR_A_MAYOR: Moneda[] = ['cp', 'sp', 'gp', 'pp']

export const valorTotal = (m: Cantidades) => DE_MENOR_A_MAYOR.reduce((t, k) => t + (m[k] ?? 0) * VALOR_MONEDA[k], 0)

export function sumarMonedas(m: Monedas, q: Cantidades) {
  for (const k of DE_MENOR_A_MAYOR) m[k] += Math.max(0, q[k] ?? 0)
}

/**
 * Gasta las cantidades indicadas. Primero con las mismas monedas; lo que falte, con monedas más pequeñas si alcanzan
 * y, si no, partiendo la moneda más pequeña que lo cubra: el cambio vuelve en monedas menores.
 * Devuelve false (sin tocar nada) si no hay dinero suficiente.
 */
export function gastarMonedas(m: Monedas, q: Cantidades): boolean {
  if (valorTotal(q) > valorTotal(m)) return false
  let deuda = 0
  for (const k of DE_MENOR_A_MAYOR) {
    const pide = Math.max(0, q[k] ?? 0)
    const paga = Math.min(m[k], pide)
    m[k] -= paga
    deuda += (pide - paga) * VALOR_MONEDA[k]
  }
  while (deuda > 0) {
    const menores = DE_MENOR_A_MAYOR.filter((x) => VALOR_MONEDA[x] <= deuda)
    if (menores.reduce((t, x) => t + m[x] * VALOR_MONEDA[x], 0) >= deuda) {
      // Alcanza con monedas más pequeñas que la deuda: de mayor a menor
      for (const k of [...menores].reverse()) {
        const n = Math.min(m[k], Math.floor(deuda / VALOR_MONEDA[k]))
        m[k] -= n
        deuda -= n * VALOR_MONEDA[k]
      }
      if (deuda === 0) break
    }
    // Se parte la moneda más pequeña que cubre lo que falta y se devuelve el cambio
    const k = DE_MENOR_A_MAYOR.find((x) => VALOR_MONEDA[x] > deuda && m[x] > 0)!
    const v = VALOR_MONEDA[k]
    m[k] -= 1
    let cambio = v - deuda
    deuda = 0
    for (const c of [...DE_MENOR_A_MAYOR].reverse()) {
      if (VALOR_MONEDA[c] >= v) continue
      const n = Math.floor(cambio / VALOR_MONEDA[c])
      m[c] += n
      cambio -= n * VALOR_MONEDA[c]
    }
  }
  return true
}

/** Mueve un elemento de una lista de la posición `de` a la posición `a`. */
export function moverEn<T>(lista: T[], de: number, a: number) {
  if (de === a || de < 0 || a < 0 || de >= lista.length || a >= lista.length) return
  const [x] = lista.splice(de, 1)
  lista.splice(a, 0, x)
}
