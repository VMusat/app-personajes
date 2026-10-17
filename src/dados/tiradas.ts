// Fórmulas de dados: «1d20+5», «2d6+1d4+3», con ventaja/desventaja y críticos.
export interface Termino {
  tipo: 'dados' | 'fijo'
  n: number
  caras: number
  signo: 1 | -1
}

export interface PeticionTirada {
  etiqueta: string
  formula: string
  /** Tirada de d20 (prueba, salvación, ataque): admite ventaja y desventaja. */
  d20?: boolean
  ventaja?: 'ventaja' | 'desventaja'
  critico?: boolean
  /** Daño asociado (para lanzar tras un ataque). */
  dano?: { formula: string; tipo: string }
  personaje?: string
  /** Se llama con el resultado (p. ej. para guardar una tirada de HP). */
  alTerminar?: (r: ResultadoTirada) => void
}

export interface ResultadoTirada {
  id: string
  etiqueta: string
  formula: string
  total: number
  /** Valores de cada dado por término. */
  dados: { caras: number; valores: number[]; descartados?: number[]; signo?: 1 | -1 }[]
  modificador: number
  natural?: number
  ventaja?: 'ventaja' | 'desventaja'
  critico?: boolean
  pifia?: boolean
  fecha: number
  personaje?: string
  dano?: { formula: string; tipo: string }
}

export function parsearFormula(f: string): Termino[] {
  const limpia = f.replace(/\s+/g, '').toLowerCase()
  const res: Termino[] = []
  const re = /([+-]?)(\d*d\d+|\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(limpia))) {
    const signo = m[1] === '-' ? -1 : 1
    const t = m[2]
    if (t.includes('d')) {
      const [n, c] = t.split('d')
      res.push({ tipo: 'dados', n: n ? Number(n) : 1, caras: Number(c), signo })
    } else res.push({ tipo: 'fijo', n: Number(t), caras: 0, signo })
  }
  return res
}

/** Un dado justo: usa el generador criptográfico del navegador (sin sesgo de módulo). */
export function tirarDado(caras: number): number {
  const c = globalThis.crypto
  if (c?.getRandomValues) {
    const a = new Uint32Array(1)
    const limite = Math.floor(0x100000000 / caras) * caras
    let x: number
    do {
      c.getRandomValues(a)
      x = a[0]
    } while (x >= limite)
    return 1 + (x % caras)
  }
  return 1 + Math.floor(Math.random() * caras)
}

/** Nº total de dados que se tirarían (para limitar tiradas absurdas). */
export function cuantosDados(f: string): number {
  return parsearFormula(f).reduce((s, t) => s + (t.tipo === 'dados' ? t.n : 0), 0)
}

export function formulaValida(f: string): boolean {
  const t = parsearFormula(f)
  return t.length > 0 && t.every((x) => x.tipo === 'fijo' || (x.n > 0 && x.n <= 100 && x.caras > 0 && x.caras <= 1000)) && cuantosDados(f) <= 100
}

/** Dados físicos a lanzar (para la animación 3D): «2d20», «1d8» ... */
export function dadosALanzar(p: PeticionTirada): string[] {
  const res: string[] = []
  for (const t of parsearFormula(p.formula)) {
    if (t.tipo !== 'dados') continue
    let n = t.n
    if (p.d20 && t.caras === 20 && p.ventaja && n === 1) n = 2
    if (p.critico) n *= 2
    res.push(`${n}d${t.caras}`)
  }
  return res
}

/**
 * Calcula el resultado. `valores` son los dados ya lanzados (por la animación 3D), en el mismo orden que dadosALanzar;
 * si faltan, se tiran con Math.random.
 */
export function resolverTirada(p: PeticionTirada, valores?: number[][]): ResultadoTirada {
  const terminos = parsearFormula(p.formula)
  let total = 0
  let modificador = 0
  let natural: number | undefined
  const dados: ResultadoTirada['dados'] = []
  let i = 0
  for (const t of terminos) {
    if (t.tipo === 'fijo') {
      modificador += t.signo * t.n
      total += t.signo * t.n
      continue
    }
    let n = t.n
    const esD20 = p.d20 && t.caras === 20 && n === 1 && !!p.ventaja
    if (esD20) n = 2
    if (p.critico) n *= 2
    const vals = valores?.[i]?.length === n ? valores[i] : Array.from({ length: n }, () => tirarDado(t.caras))
    i++
    if (esD20) {
      const elegido = p.ventaja === 'ventaja' ? Math.max(...vals) : Math.min(...vals)
      const descartado = vals[0] === elegido ? vals[1] : vals[0]
      dados.push({ caras: 20, valores: [elegido], descartados: [descartado], signo: t.signo })
      total += t.signo * elegido
      natural = elegido
    } else {
      dados.push({ caras: t.caras, valores: vals, signo: t.signo })
      total += t.signo * vals.reduce((a, b) => a + b, 0)
      if (p.d20 && t.caras === 20 && t.n === 1) natural = vals[0]
    }
  }
  return {
    id: Math.random().toString(36).slice(2),
    etiqueta: p.etiqueta,
    formula: p.formula,
    total,
    dados,
    modificador,
    natural,
    ventaja: p.ventaja,
    critico: p.d20 ? natural === 20 : p.critico,
    pifia: p.d20 ? natural === 1 : undefined,
    fecha: Date.now(),
    personaje: p.personaje,
    dano: p.dano,
  }
}

export const conSigno = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
/** «1d20» + modificador: «1d20+5». */
export const formulaD20 = (mod: number) => `1d20${mod ? conSigno(mod) : ''}`
