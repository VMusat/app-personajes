// Objetos mágicos propios de la campaña: el DM los crea en la app o los importa desde notas de Obsidian.
import type { Efecto, Recarga } from '../motor/efectos'

export const RAREZAS = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'] as const
export type Rareza = (typeof RAREZAS)[number]

export interface ObjetoCampaña {
  id: string
  nombre: string
  /** Objeto base de 5etools si es un arma o armadura mágica («longsword|xphb»). */
  base?: string
  tipo: 'arma' | 'armadura' | 'escudo' | 'maravilloso' | 'anillo' | 'varita' | 'bastón' | 'vara' | 'poción' | 'pergamino' | 'otro'
  rareza: Rareza
  sintonizacion: boolean
  /** Requisito de sintonización en texto («by a Wizard»). */
  sintonizacionRequisito?: string
  descripcion: string
  /** Lo que solo sabe el DM (no se muestra a los jugadores). */
  secreto?: string
  cargas?: { max: number; recarga: Recarga; recupera?: string }
  efectos: Efecto[]
  /** Nota de Obsidian de la que se importó. */
  notaObsidian?: string
  actualizado: string
}

export function objetoVacio(): ObjetoCampaña {
  return {
    id: Math.random().toString(36).slice(2, 10),
    nombre: '',
    tipo: 'maravilloso',
    rareza: 'uncommon',
    sintonizacion: false,
    descripcion: '',
    efectos: [],
    actualizado: new Date().toISOString(),
  }
}
