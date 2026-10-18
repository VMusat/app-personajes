// Conjuros con efectos temporales sobre la hoja (AC, Speed, ataques). Se activan desde la pestaña de combate
// cuando el personaje tiene el conjuro preparado o siempre disponible. Clave: «nombre|fuente» en minúsculas.
import type { Efecto } from './efectos'

type Activable = Extract<Efecto, { tipo: 'activable' }>

export const ACTIVABLES_CONJURO: Record<string, Omit<Activable, 'tipo' | 'nombre'>> = {
  'mage armor|xphb': {
    requisito: 'sin armadura',
    texto: 'Sin armadura, tu AC base es 13 + DEX (compatible con escudo).',
    efectos: [{ tipo: 'caBase', nombre: 'Mage Armor', formula: '13+dex', escudo: true }],
  },
  'shield|xphb': { texto: '+5 AC hasta el inicio de tu siguiente turno.', efectos: [{ tipo: 'bono', objetivo: 'ca', valor: 5 }] },
  'shield of faith|xphb': { texto: '+2 AC.', efectos: [{ tipo: 'bono', objetivo: 'ca', valor: 2 }] },
  'barkskin|xphb': { texto: 'Tu AC no puede ser inferior a 17.', efectos: [{ tipo: 'caMinima', valor: 17 }] },
  'haste|xphb': {
    texto: '+2 AC, Speed doble y ventaja en salvaciones de DEX.',
    efectos: [
      { tipo: 'bono', objetivo: 'ca', valor: 2 },
      { tipo: 'velocidad', valor: 0, multiplicar: 2 },
    ],
  },
  'longstrider|xphb': { texto: '+10 ft de Speed.', efectos: [{ tipo: 'velocidad', valor: 10 }] },
  'fly|xphb': { texto: 'Fly Speed de 60 ft.', efectos: [{ tipo: 'velocidad', modo: 'vuelo', valor: 60, fijar: true }] },
  'spider climb|xphb': { texto: 'Climb Speed igual a tu Speed.', efectos: [{ tipo: 'velocidad', modo: 'trepar', valor: 'velocidad', fijar: true }] },
  'shillelagh|xphb': {
    texto: 'Club o Quarterstaff: usa tu característica de lanzamiento para atacar y dañar; dado de daño d8 (d10 a nivel 5, d12 a nivel 11, 2d6 a nivel 17).',
    efectos: [{ tipo: 'carAtaque', car: 'conjuro', armas: ['club', 'quarterstaff'], dado: '{escala(nivel,1,1,17,2)}d{escala(nivel,1,8,5,10,11,12,17,6)}' }],
  },
  'divine favor|xphb': { texto: '+1d4 radiant al impactar con armas.', efectos: [{ tipo: 'danoExtra', dado: '1d4', tipoDano: 'radiant' }] },
  "hunter's mark|xphb": { texto: '+1d6 force al impactar a la criatura marcada.', efectos: [{ tipo: 'danoExtra', dado: '1d6', tipoDano: 'force' }] },
  'hex|xphb': { texto: '+1d6 necrotic al impactar a la criatura maldita.', efectos: [{ tipo: 'danoExtra', dado: '1d6', tipoDano: 'necrotic' }] },
  'spirit shroud|xphb': { texto: '+1d8 radiant, necrotic o cold al impactar a 10 ft o menos.', efectos: [{ tipo: 'danoExtra', dado: '1d8' }] },
  'magic weapon|xphb': {
    texto: '+1 al ataque y al daño con el arma tocada (+2 con espacio de nivel 3, +3 con nivel 6).',
    efectos: [
      { tipo: 'bono', objetivo: 'ataqueArma', valor: 1 },
      { tipo: 'bono', objetivo: 'danoArma', valor: 1 },
    ],
  },
  'elemental weapon|xphb': {
    texto: '+1 al ataque y +1d4 del tipo elegido con el arma tocada.',
    efectos: [
      { tipo: 'bono', objetivo: 'ataqueArma', valor: 1 },
      { tipo: 'danoExtra', dado: '1d4' },
    ],
  },
}
