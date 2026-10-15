// Sistema de efectos común a especies, trasfondos, dotes, rasgos y objetos mágicos.
// Una fórmula es un número o un texto que evalúa `formula.ts` (p. ej. «pb», «max(1,wis)», «nivel:Barbarian»).
import type { Caracteristica } from '../datos/tipos'

export type Formula = number | string
export type Recarga = 'largo' | 'corto' | 'amanecer' | 'nunca'

export type ObjetivoBono =
  | 'ca'
  | 'ataque'
  | 'ataqueCuerpo'
  | 'ataqueDistancia'
  | 'ataqueConjuro'
  | 'dano'
  | 'cdConjuros'
  | 'iniciativa'
  | 'salvaciones'
  | `salvacion:${Caracteristica}`
  | `habilidad:${string}`
  | 'pruebas'
  | `prueba:${Caracteristica}`
  | 'pgMax'
  | 'pgPorNivel'
  | 'percepcionPasiva'

export type Efecto = { origen?: string; condicion?: string } & (
  | { tipo: 'competencia'; categoria: 'arma' | 'armadura' | 'salvacion' | 'habilidad' | 'herramienta' | 'idioma'; valor: string }
  | { tipo: 'pericia'; valor: string }
  | { tipo: 'bono'; objetivo: ObjetivoBono; valor: Formula }
  | { tipo: 'caracteristica'; car: Caracteristica; valor: number; max?: number }
  | { tipo: 'fijarCaracteristica'; car: Caracteristica; valor: number }
  | { tipo: 'resistencia' | 'inmunidad' | 'vulnerabilidad'; valor: string }
  | { tipo: 'inmunidadCondicion'; valor: string }
  | {
      tipo: 'conjuro'
      conjuro: string
      /** Siempre preparado (no cuenta para el límite). */
      siempre?: boolean
      /** Usos sin gastar espacio. */
      usos?: Formula
      recarga?: Recarga
      caracteristica?: Caracteristica
      cd?: number
      ataque?: number
      /** Solo como ritual, a nivel concreto, etc. */
      nota?: string
    }
  | { tipo: 'trucosExtra'; clase: string; valor: number }
  | { tipo: 'listaConjuros'; clase: string; conjuros: string[] }
  | { tipo: 'recurso'; nombre: string; usos: Formula; recarga: Recarga; dado?: string; recargaCorta?: Formula }
  | {
      tipo: 'ataque'
      nombre: string
      dano: string
      tipoDano: string
      car?: Caracteristica | 'mejorFuerzaDestreza' | 'conjuro'
      bonoAtaque?: Formula
      alcance?: string
      competente?: boolean
    }
  | { tipo: 'velocidad'; valor: Formula; modo?: 'andar' | 'nado' | 'vuelo' | 'trepar' | 'excavar'; fijar?: boolean }
  | { tipo: 'sentido'; nombre: string; valor: Formula }
  | { tipo: 'caBase'; formula: string; sinArmadura?: boolean; escudo?: boolean; nombre: string }
  | { tipo: 'dadoHabilidad'; habilidades: string[]; dado: string; sustituye?: string }
  | { tipo: 'nota'; texto: string }
)

export type TipoEfecto = Efecto['tipo']
