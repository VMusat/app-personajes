// Mecánicas pasivas y recursos con usos de los rasgos de clase (5etools los describe solo en texto).
// Misma clave que la tabla manual: «Clase|Subclase|nivel|Nombre». Las fórmulas usan col:<Columna> de la tabla de la clase.
// Si un rasgo aparece varias veces (Action Surge a nivel 2 y 17), la última entrada alcanzada sustituye a la anterior
// porque el recurso se identifica por su nombre.
import type { Efecto } from './efectos'

const r = (nombre: string, usos: string | number, recarga: 'largo' | 'corto', extra: Partial<Extract<Efecto, { tipo: 'recurso' }>> = {}): Efecto =>
  ({ tipo: 'recurso', nombre, usos, recarga, ...extra }) as Efecto

export const MECANICAS: Record<string, Efecto[]> = {
  'Artificer||7|Flash of Genius': [r('Flash of Genius', 'max(1,int)', 'largo')],
  'Barbarian||1|Rage': [r('Rage', 'col:Rages', 'largo', { recargaCorta: 1 })],
  'Barbarian||1|Unarmored Defense': [{ tipo: 'caBase', nombre: 'Unarmored Defense', formula: '10+dex+con', sinArmadura: true, escudo: true }],
  'Barbarian||5|Fast Movement': [{ tipo: 'velocidad', valor: 10, condicion: 'sin armadura pesada' }],
  'Bard|Dance|3|Unarmored Defense': [{ tipo: 'caBase', nombre: 'Unarmored Defense', formula: '10+dex+cha', sinArmadura: true }],
  'Bard||1|Bardic Inspiration': [r('Bardic Inspiration', 'max(1,cha)', 'largo', { dado: 'col:Bardic_Die' })],
  'Bard||5|Font of Inspiration': [r('Bardic Inspiration', 'max(1,cha)', 'corto', { dado: 'col:Bardic_Die' })],
  'Cleric||2|Channel Divinity': [r('Channel Divinity', 'col:Channel_Divinity', 'largo', { recargaCorta: 1 })],
  'Paladin||3|Channel Divinity': [r('Channel Divinity', 'col:Channel_Divinity', 'largo', { recargaCorta: 1 })],
  'Paladin||1|Lay On Hands': [r('Lay On Hands (HP pool)', '5*nivel:Paladin', 'largo')],
  'Paladin||1|Lay on Hands': [r('Lay On Hands (HP pool)', '5*nivel:Paladin', 'largo')],
  'Druid||2|Wild Shape': [r('Wild Shape', 'col:Wild_Shape', 'largo', { recargaCorta: 1 })],
  'Fighter||1|Second Wind': [r('Second Wind', 'col:Second_Wind', 'largo', { recargaCorta: 1, dado: '1d10' })],
  'Fighter||2|Action Surge': [r('Action Surge', 1, 'corto')],
  'Fighter||17|Action Surge': [r('Action Surge', 2, 'corto')],
  'Fighter||9|Indomitable': [r('Indomitable', 1, 'largo')],
  'Fighter||13|Indomitable': [r('Indomitable', 2, 'largo')],
  'Fighter||17|Indomitable': [r('Indomitable', 3, 'largo')],
  'Fighter|Battle Master|3|Combat Superiority': [r('Superiority Dice', 'escala(nivel:Fighter,3,4,7,5,15,6)', 'corto', { dado: 'escala(nivel:Fighter,3,8,10,10,18,12)' })],
  'Fighter|Psi Warrior|3|Psionic Power': [r('Psionic Energy Dice', 'col:Number', 'largo', { recargaCorta: 1, dado: 'col:Die_Size' })],
  'Rogue|Soulknife|3|Psionic Power': [r('Psionic Energy Dice', 'col:Number', 'largo', { recargaCorta: 1, dado: 'col:Die_Size' })],
  'Monk||1|Martial Arts': [{ tipo: 'ataque', nombre: 'Unarmed Strike (Martial Arts)', dano: 'col:Martial_Arts', tipoDano: 'bludgeoning', car: 'mejorFuerzaDestreza', competente: true }],
  'Monk||1|Unarmored Defense': [{ tipo: 'caBase', nombre: 'Unarmored Defense', formula: '10+dex+wis', sinArmadura: true }],
  'Monk||2|Unarmored Movement': [{ tipo: 'velocidad', valor: 'col:Unarmored_Movement', condicion: 'sin armadura ni escudo' }],
  "Monk||2|Monk's Focus": [r('Focus Points', 'col:Focus_Points', 'corto')],
  'Sorcerer||2|Font of Magic': [r('Sorcery Points', 'col:Sorcery_Points', 'largo')],
  'Sorcerer||1|Innate Sorcery': [r('Innate Sorcery', 2, 'largo')],
  'Warlock||2|Magical Cunning': [r('Magical Cunning', 1, 'largo')],
  'Wizard||1|Arcane Recovery': [r('Arcane Recovery', 1, 'largo')],
  'Cleric||10|Divine Intervention': [r('Divine Intervention', 1, 'largo')],
  'Barbarian||20|Primal Champion': [
    { tipo: 'caracteristica', car: 'str', valor: 4, max: 25 },
    { tipo: 'caracteristica', car: 'con', valor: 4, max: 25 },
  ],
  'Monk||20|Body and Mind': [
    { tipo: 'caracteristica', car: 'dex', valor: 4, max: 25 },
    { tipo: 'caracteristica', car: 'wis', valor: 4, max: 25 },
  ],
}
