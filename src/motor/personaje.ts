// Modelo de personaje. Se guarda el historial de decisiones (no la hoja final):
// la hoja se recalcula siempre a partir de estas decisiones, de los datos de reglas y del estado de juego.
import type { Caracteristica } from '../datos/tipos'
import type { Efecto, Recarga } from './efectos'

export type MetodoCaracteristicas = 'compra' | 'estandar' | 'dados' | 'manual'

export interface NivelPersonaje {
  /** Clave de la clase («fighter|xphb»). */
  clase: string
}

export interface ItemInventario {
  id: string
  /** Clave de un objeto de 5etools, id de un objeto de la campaña o vacío para objetos libres. */
  ref?: string
  origen: '5etools' | 'campaña' | 'libre'
  nombre: string
  cantidad: number
  equipado?: boolean
  sintonizado?: boolean
  cargas?: number
  notas?: string
  peso?: number
  /** Para objetos libres: efectos mecánicos opcionales. */
  efectos?: Efecto[]
}

export interface RecursoManual {
  id: string
  nombre: string
  max: number
  recarga: Recarga
}

export interface EstadoJuego {
  pgActuales: number | null
  pgTemporales: number
  dadosGolpeGastados: Record<string, number>
  salvacionesMuerte: { exitos: number; fallos: number }
  /** Usos gastados por id de recurso (incluidos espacios de conjuro: «espacio:3», «pacto»). */
  gastados: Record<string, number>
  condiciones: string[]
  agotamiento: number
  disolucion: number
  inspiracion: boolean
  concentracion?: string
  /** Efectos temporales activos (Rage, Bladesong, Mage Armor...), por nombre. */
  activos?: string[]
}

export interface Nota {
  id: string
  titulo: string
  texto: string
  fecha: string
}

export interface Personaje {
  id: string
  version: 1
  propietario?: string
  campaña?: string
  nombre: string
  jugador: string
  /** Aspecto del alma (nombre al derecho o invertido). */
  aspecto?: string
  especie?: string
  trasfondo?: string
  caracteristicas: {
    metodo: MetodoCaracteristicas
    base: Record<Caracteristica, number>
    tiradas?: number[][]
  }
  niveles: NivelPersonaje[]
  /** Valores de todas las elecciones, por id de elección. */
  elecciones: Record<string, string[]>
  /** Obsoleto: la marca gratis se aplica sola al llegar a nivel 4. Se conserva para personajes antiguos. */
  reglasCampaña: { marcaGratis?: boolean }
  estado: EstadoJuego
  inventario: ItemInventario[]
  /** «ep» (electrum) ya no se usa en el setting; se conserva para convertir lo que tuvieran los personajes antiguos. */
  monedas: { cp: number; sp: number; ep?: number; gp: number; pp: number }
  detalles: Record<string, string>
  notas: Nota[]
  recursosManuales: RecursoManual[]
  creado: string
  actualizado: string
}

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function personajeVacio(): Personaje {
  const ahora = new Date().toISOString()
  return {
    id: nuevoId(),
    version: 1,
    nombre: '',
    jugador: '',
    caracteristicas: { metodo: 'compra', base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } },
    niveles: [],
    elecciones: {},
    reglasCampaña: {},
    estado: {
      pgActuales: null,
      pgTemporales: 0,
      dadosGolpeGastados: {},
      salvacionesMuerte: { exitos: 0, fallos: 0 },
      gastados: {},
      condiciones: [],
      agotamiento: 0,
      disolucion: 0,
      inspiracion: false,
    },
    inventario: [],
    monedas: { cp: 0, sp: 0, gp: 0, pp: 0 },
    detalles: {},
    notas: [],
    recursosManuales: [],
    creado: ahora,
    actualizado: ahora,
  }
}

// ── Características

export const COSTE_COMPRA: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const PUNTOS_COMPRA = 27
export const CONJUNTO_ESTANDAR = [15, 14, 13, 12, 10, 8]

export function costeCompra(base: Record<Caracteristica, number>): number {
  return Object.values(base).reduce((s, v) => s + (COSTE_COMPRA[v] ?? Infinity), 0)
}

export function modificador(valor: number): number {
  return Math.floor((valor - 10) / 2)
}

export function bonoCompetencia(nivel: number): number {
  return 2 + Math.floor((Math.max(1, nivel) - 1) / 4)
}

/** 4d6 descartando el dado más bajo. */
export function tirar4d6(aleatorio: () => number = Math.random): number[] {
  return Array.from({ length: 4 }, () => 1 + Math.floor(aleatorio() * 6))
}

export function sumar4d6(dados: number[]): number {
  return [...dados].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
}
