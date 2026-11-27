// Pantalla del DM: el escenario de la sesión (PJs activos, criaturas, iniciativa) y las notas de sesión.
// Solo los lee y escribe el DM (en Firebase, la colección «dm» de la campaña).
import type { Criatura } from './criaturas'
import type { Apunte, Reloj } from './mesa'

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
  /** Escenarios («##») elegidos en cada nota: sin valor, todos; lista vacía, ninguno (un texto suelto es de versiones anteriores). */
  escenarios?: Record<string, string | string[]>
  /** Relojes de la mesa (cuentas atrás y relojes de pasos). */
  relojes?: Reloj[]
  /** Apuntes rápidos de la sesión. */
  apuntes?: Apunte[]
  /** El combate no se comparte con los jugadores. */
  mesaOculta?: boolean
  actualizado: string
}

/** Imagen que se incrusta en las notas de sesión (los mapas de Recursos/Mapas): solo el DM, porque llevan secretos. */
export interface ImagenSesion {
  /** Se saca del nombre del archivo. */
  id: string
  /** Nombre del archivo tal como lo incrusta la nota: «La Cuadra.svg» en «![[La Cuadra.svg]]». */
  nombre: string
  /** La imagen como data URL. */
  datos: string
  actualizado: string
}

/** Id de una imagen a partir de su nombre de archivo (sin espacios ni tildes, para el documento de Firestore). */
export const idImagen = (nombre: string) =>
  nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')

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
