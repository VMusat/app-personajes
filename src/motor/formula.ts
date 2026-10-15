// Evaluador de fórmulas pequeñas: números, + - * /, paréntesis, max/min/floor/ceil
// y variables: pb, nivel, str..cha (modificadores), nivel:<Clase> y col:<Columna de la tabla de clase>.
import type { Formula } from './efectos'

export type Variables = (nombre: string) => number

export function evaluar(f: Formula | undefined, vars: Variables): number {
  if (f === undefined) return 0
  if (typeof f === 'number') return f
  const s = f.trim()
  if (/^-?\d+$/.test(s)) return Number(s)
  let i = 0
  const espacio = () => {
    while (s[i] === ' ') i++
  }
  const expr = (): number => {
    let v = termino()
    for (;;) {
      espacio()
      if (s[i] === '+') (i++, (v += termino()))
      else if (s[i] === '-') (i++, (v -= termino()))
      else return v
    }
  }
  const termino = (): number => {
    let v = factor()
    for (;;) {
      espacio()
      if (s[i] === '*') (i++, (v *= factor()))
      else if (s[i] === '/') (i++, (v /= factor()))
      else return v
    }
  }
  const factor = (): number => {
    espacio()
    if (s[i] === '-') return i++, -factor()
    if (s[i] === '(') {
      i++
      const v = expr()
      espacio()
      i++ // )
      return v
    }
    const m = /^(\d+(\.\d+)?)/.exec(s.slice(i))
    if (m) return (i += m[0].length), Number(m[0])
    // Los espacios de los nombres de columna se escriben con «_»: col:Weapon_Mastery
    const id = /^[a-zA-Z_áéíóúñ][\w:áéíóúñ']*/.exec(s.slice(i))
    if (!id) throw new Error(`Fórmula no válida: ${s}`)
    const nombre = id[0]
    i += nombre.length
    espacio()
    if (s[i] === '(') {
      i++
      const args: number[] = []
      for (;;) {
        args.push(expr())
        espacio()
        if (s[i] === ',') i++
        else break
      }
      i++ // )
      if (nombre === 'escala') {
        // escala(x, umbral1, valor1, umbral2, valor2, ...): valor del mayor umbral alcanzado
        let v = 0
        for (let k = 1; k + 1 < args.length; k += 2) if (args[0] >= args[k]) v = args[k + 1]
        return v
      }
      const fn = { max: Math.max, min: Math.min, floor: Math.floor, ceil: Math.ceil }[nombre]
      if (!fn) throw new Error(`Función desconocida: ${nombre}`)
      return (fn as (...a: number[]) => number)(...args)
    }
    return vars(nombre.replace(/_/g, ' '))
  }
  return expr()
}
