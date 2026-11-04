// Pantalla del DM: el escenario de la sesión (PJs activos, criaturas, iniciativa) y las notas de sesión.
// Solo los lee y escribe el DM (en Firebase, la colección «dm» de la campaña).
import type { Caracteristica } from '../datos/tipos'

/** Ficha de una criatura. Hoy se crea a mano; más adelante saldrá del catálogo de criaturas de la app. */
export interface PlantillaCriatura {
  nombre: string
  tipo?: string
  vd?: string
  ca: number
  pgMax: number
  /** Fórmula de PG para tirarlos («2d8+4»); si no hay, se usa pgMax. */
  pgFormula?: string
  bonoIniciativa: number
  percepcionPasiva?: number
  velocidad?: string
  caracteristicas?: Partial<Record<Caracteristica, number>>
  /** Rasgos, acciones y lo demás, en texto libre. */
  texto?: string
}

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
  /** Plantillas usadas en la campaña, para reutilizarlas. */
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
