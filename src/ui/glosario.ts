// Glosario de la interfaz. Las abreviaturas y unidades van siempre en inglés, como en 5etools
// (HP, AC, DC, ft, lb, GP...), aunque el resto de la interfaz esté en español.
import type { Caracteristica } from '../datos/tipos'

export const ABREV: Record<Caracteristica, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }
export const NOMBRE_CAR: Record<Caracteristica, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export const T = {
  hp: 'HP',
  hpTemp: 'HP temporales',
  hpMax: 'HP máximos',
  ac: 'AC',
  dc: 'DC',
  pb: 'PB',
  ft: 'ft',
  lb: 'lb',
  iniciativa: 'Iniciativa',
  velocidad: 'Velocidad',
  dadosGolpe: 'Hit Dice',
  percepcionPasiva: 'Percepción pasiva',
  ataqueConjuro: 'Spell attack',
  cdConjuros: 'Spell save DC',
  competencia: 'Competencia',
  pericia: 'Expertise',
  salvaciones: 'Saving throws',
  salvacionesMuerte: 'Death saves',
}

export const MONEDAS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const
export const NOMBRE_MONEDA: Record<(typeof MONEDAS)[number], string> = { pp: 'PP', gp: 'GP', ep: 'EP', sp: 'SP', cp: 'CP' }

export const ESCUELAS: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation',
}

export const RECARGA: Record<string, string> = { largo: 'Long Rest', corto: 'Short Rest', amanecer: 'Dawn', nunca: '—' }

export const CONDICIONES = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
]

export const NIVEL_CONJURO = (n: number) => (n === 0 ? 'Cantrips' : `Level ${n}`)

export const conSigno = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export const titulo = (s: string) => s.replace(/(^|\s|-)\S/g, (m) => m.toUpperCase())

/** Explicación de las etiquetas de los conjuros (se muestran al pasar el ratón o al tocarlas). */
export const TERMINOS_CONJURO: Record<'V' | 'S' | 'M' | 'R' | 'C', { nombre: string; texto: string }> = {
  V: { nombre: 'Verbal', texto: 'Verbal: hay que pronunciar palabras místicas en voz alta. No puedes lanzarlo si no puedes hablar (amordazado, en una zona de Silence...).' },
  S: { nombre: 'Somatic', texto: 'Somatic: requiere gestos con al menos una mano libre. Puede ser la mano que sostiene el foco o los componentes materiales.' },
  M: { nombre: 'Material', texto: 'Material: requiere los objetos indicados. Una bolsa de componentes o un foco sustituye a los que no tienen precio; los que tienen coste, o que el conjuro consume, hay que tenerlos de verdad.' },
  R: { nombre: 'Ritual', texto: 'Ritual: puedes lanzarlo como ritual, tardando 10 minutos más, sin gastar espacio de conjuro. Tienes que tenerlo preparado (el mago lo lanza desde su libro aunque no lo tenga preparado).' },
  C: { nombre: 'Concentration', texto: 'Concentration: el efecto dura mientras mantengas la concentración, hasta la duración máxima. Termina si lanzas otro conjuro de concentración, quedas Incapacitated o mueres. Al recibir daño, haz una salvación de CON (DC 10 o la mitad del daño, máximo DC 30).' },
}
