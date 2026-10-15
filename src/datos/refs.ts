// Claves de referencia con el formato de 5etools.
// classFeature:    «Nombre|Clase|FuenteClase|Nivel|Fuente?»
// subclassFeature: «Nombre|Clase|FuenteClase|Subclase|FuenteSubclase|Nivel|Fuente?»
// Las fuentes vacías valen PHB, como en 5etools.

const def = (s: string | undefined, d: string) => (s && s.trim() ? s : d)

export function claveEntidad(nombre: string, fuente: string): string {
  return `${nombre}|${fuente}`.toLowerCase()
}

/** Convierte «nombre|fuente» (con fuente opcional, y sufijo #c de truco) en clave. */
export function claveDeRef(ref: string, fuentePorDefecto = 'XPHB'): string {
  const [nombre, fuente] = ref.split('#')[0].split('|')
  return claveEntidad(nombre, def(fuente, fuentePorDefecto))
}

export function claveRasgoClase(ref: string): string {
  const [n, c, cs, nivel, f] = ref.split('|')
  const fc = def(cs, 'PHB')
  return `cf|${n}|${c}|${fc}|${nivel}|${def(f, fc)}`.toLowerCase()
}

export function claveRasgoSubclase(ref: string): string {
  const [n, c, cs, sc, ss, nivel, f] = ref.split('|')
  const fc = def(cs, 'PHB')
  const fs = def(ss, 'PHB')
  return `sf|${n}|${c}|${fc}|${sc}|${fs}|${nivel}|${def(f, fs)}`.toLowerCase()
}

export function claveDeRasgoCrudo(r: {
  name: string
  className: string
  classSource?: string
  level: number
  source: string
  subclassShortName?: string
  subclassSource?: string
}): string {
  if (r.subclassShortName !== undefined) {
    return claveRasgoSubclase(
      [r.name, r.className, r.classSource, r.subclassShortName, r.subclassSource, r.level, r.source].join('|'),
    )
  }
  return claveRasgoClase([r.name, r.className, r.classSource, r.level, r.source].join('|'))
}

/** Nivel de un rasgo a partir de su referencia. */
export function nivelDeRef(ref: string, deSubclase: boolean): number {
  const p = ref.split('|')
  return Number(deSubclase ? p[5] : p[3])
}
