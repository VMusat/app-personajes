// Tipos de los datos de 5etools. Son laxos a propósito: el formato de 5etools es muy amplio
// y solo tipamos lo que usa la app. Todo lo demás se conserva tal cual para renderizar el texto.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Crudo = Record<string, any>

export type Caracteristica = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export const CARACTERISTICAS: Caracteristica[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** Entidad de 5etools enriquecida por la app. */
export interface Entidad extends Crudo {
  name: string
  source: string
  /** Clave única en minúsculas: «nombre|fuente». */
  _clave: string
  /** Nombre que se muestra (el del setting si existe). */
  _nombre: string
  /** Texto del setting que explica qué es en el mundo de la campaña. */
  _setting?: string
}

export interface Clase extends Entidad {
  hd: { number: number; faces: number }
  proficiency: Caracteristica[]
  classFeatures: (string | { classFeature: string; gainSubclassFeature?: boolean })[]
  subclassTitle: string
  casterProgression?: 'full' | '1/2' | '1/3' | 'pact' | 'artificer'
  spellcastingAbility?: Caracteristica
  _fuentePoder?: string
}

export interface Subclase extends Entidad {
  shortName: string
  className: string
  classSource: string
  subclassFeatures: string[]
}

export interface Rasgo extends Entidad {
  className: string
  classSource: string
  level: number
  subclassShortName?: string
  subclassSource?: string
  entries: unknown[]
  /** Clave de referencia, en el mismo formato que usa 5etools para enlazarlo. */
  _ref: string
}

export interface Conjuro extends Entidad {
  level: number
  school: string
  /** Clases (nombre en inglés) en cuya lista está. */
  _clases: string[]
}

export interface Datos {
  version: string
  clases: Clase[]
  subclases: Subclase[]
  /** Rasgos de clase y de subclase por su clave de referencia. */
  rasgos: Record<string, Rasgo>
  especies: Entidad[]
  trasfondos: Entidad[]
  dotes: Entidad[]
  conjuros: Conjuro[]
  opcionales: Entidad[]
  objetos: Entidad[]
  habilidades: { nombre: string; clave: string; caracteristica: Caracteristica }[]
  idiomas: Entidad[]
  condiciones: Entidad[]
  propiedadesArma: Crudo[]
  maestrias: Entidad[]
}
