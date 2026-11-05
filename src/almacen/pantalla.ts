// Pantalla del DM: el escenario de la sesión (PJs activos, criaturas, iniciativa) y las notas de sesión.
// Solo los lee y escribe el DM (en Firebase, la colección «dm» de la campaña).
import type { Criatura } from './criaturas'

/** Ficha de una criatura del escenario: una copia de la del Bestiario (o una escrita a mano en fichas antiguas). */
export type PlantillaCriatura = Criatura

export interface CriaturaEscenario {
  id: string
  nombre: string
  plantilla: PlantillaCriatura
  pg: number
  pgTemporales: number
  condiciones: string[]
  notas?: string
  /** Oculta: está en el escenario pero aún no ha aparecido. */
  oculta?: boolean
  /** Lucha en su guarida: acciones de guarida en la iniciativa 20 y más acciones legendarias. */
  enGuarida?: boolean
  /** Acciones legendarias gastadas desde su último turno. */
  legendariasUsadas?: number
  /** Usos gastados de las entradas «(N/día)», por clave de entrada. */
  usos?: Record<string, number>
  /** Entradas con recarga gastadas (se tiran al empezar su turno). */
  gastadas?: string[]
  /** El dominio del acechador está roto. */
  dominioRoto?: boolean
  /** Último aviso automático (recargas al empezar su turno). */
  aviso?: string
}

export interface Combate {
  activo: boolean
  ronda: number
  /** Id de la fila que tiene el turno. */
  turno?: string
  /** Valores de iniciativa por id: «pj:<id>», «cr:<id>», «al:<pj>:<aliado>». */
  valores: Record<string, number>
  /** Momento en que empezó, para recoger solo las tiradas de iniciativa posteriores. */
  desde: number
}

export interface PantallaDM {
  version: 1
  /** Nota de sesión abierta. */
  sesion?: string
  /** Ids de los PJs activos en la sesión. */
  pjs: string[]
  criaturas: CriaturaEscenario[]
  combate: Combate
  /** Fichas escritas a mano antes del Bestiario (ya no se usan; se conservan por compatibilidad). */
  plantillas: PlantillaCriatura[]
  /** Líneas tachadas por nota: índices de tarea. */
  tachadas: Record<string, number[]>
  actualizado: string
}

export interface NotaSesion {
  id: string
  titulo: string
  texto: string
  actualizado: string
  /** Nombre del archivo importado, para exportarla con el mismo nombre. */
  archivo?: string
  /** Momento del último cambio hecho en la app (si es posterior a la importación, Obsidian no lo tiene). */
  editada?: string
  /** Momento de la última importación desde Obsidian. */
  importada?: string
}

export function pantallaVacia(): PantallaDM {
  return {
    version: 1,
    pjs: [],
    criaturas: [],
    combate: { activo: false, ronda: 1, valores: {}, desde: 0 },
    plantillas: [],
    tachadas: {},
    actualizado: new Date(0).toISOString(),
  }
}

/** Título de una nota: el primer «# título», o el nombre del archivo. */
export function tituloNota(texto: string, archivo: string): string {
  return texto.match(/^#\s+(.+)$/m)?.[1].trim() ?? archivo.replace(/\.md$/i, '')
}
