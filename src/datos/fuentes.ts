// Origen de los datos de reglas: el mirror público de 5etools en GitHub.
// Se fija una versión (tag) para que una actualización del mirror no rompa personajes ya creados.
export const VERSION_5ETOOLS = 'v2.38.0'
export const URL_BASE_5ETOOLS = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${VERSION_5ETOOLS}/data/`

export const CLASES_5ETOOLS = [
  'artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
]

export const ARCHIVOS_5ETOOLS = [
  ...CLASES_5ETOOLS.map((c) => `class/class-${c}.json`),
  'spells/spells-xphb.json',
  'spells/spells-efa.json',
  'spells/spells-frhof.json',
  'spells/spells-au.json',
  'generated/gendata-spell-source-lookup.json',
  'races.json',
  'backgrounds.json',
  'feats.json',
  'optionalfeatures.json',
  'items.json',
  'items-base.json',
  'skills.json',
  'languages.json',
  'conditionsdiseases.json',
]

/** Fuentes permitidas por la adaptación (ver Reglas/Adaptación a D&D 2024 en la bóveda). */
export const FUENTES_PERMITIDAS = ['XPHB', 'XDMG', 'XMM', 'FRHoF', 'FRAiF', 'EFA', 'AU', 'SETTING']
/** Fuentes de las que salen clases y subclases jugables. */
export const FUENTES_CLASE = ['XPHB', 'EFA']
export const FUENTES_SUBCLASE = ['XPHB', 'FRHoF', 'EFA', 'AU']
/** Fuentes de especies, trasfondos, dotes, conjuros y rasgos opcionales. */
export const FUENTES_PERSONAJE = ['XPHB', 'FRHoF', 'EFA', 'AU', 'SETTING']
/** Arcana Unleashed: todo lo suyo lleva la etiqueta AU en la app. */
export const FUENTE_AU = 'AU'
export const esAU = (fuenteOClave: string | undefined) => !!fuenteOClave && /(^|\|)au($|[|;#])/i.test(fuenteOClave)
/** Fuentes de objetos. */
export const FUENTES_OBJETOS = ['XPHB', 'XDMG', 'FRHoF', 'FRAiF', 'EFA']
