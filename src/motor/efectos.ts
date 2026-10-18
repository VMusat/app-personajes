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
  /** Solo ataques con armas (Sacred Weapon, Magic Weapon...). */
  | 'ataqueArma'
  | 'dano'
  | 'danoArma'
  /** Daño de los ataques que usan STR (Rage). */
  | 'danoFuerza'
  /** Daño con armas Heavy (Great Weapon Master). */
  | 'danoPesada'
  /** Daño con un arma cuerpo a cuerpo a una mano y sin otra arma (Dueling). */
  | 'danoDuelo'
  /** Máximo extra de DEX con armadura media si DEX ≥ 16 (Medium Armor Master). */
  | 'destrezaMediaMax'
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
  | { tipo: 'recurso'; nombre: string; usos: Formula; recarga: Recarga; dado?: string; recargaCorta?: Formula; /** Rasgo, dote o especie al que pertenece. */ rasgo?: string }
  | {
      tipo: 'ataque'
      nombre: string
      dano: string
      tipoDano: string
      car?: Caracteristica | 'mejorFuerzaDestreza' | 'conjuro'
      bonoAtaque?: Formula
      alcance?: string
      competente?: boolean
      distancia?: boolean
    }
  /** «valor: 'velocidad'» en otro modo = igual a tu Speed. «multiplicar» dobla la velocidad (Haste). */
  | { tipo: 'velocidad'; valor: Formula; modo?: 'andar' | 'nado' | 'vuelo' | 'trepar' | 'excavar'; fijar?: boolean; multiplicar?: number }
  | { tipo: 'sentido'; nombre: string; valor: Formula }
  | { tipo: 'caBase'; formula: string; sinArmadura?: boolean; escudo?: boolean; nombre: string }
  | { tipo: 'dadoHabilidad'; habilidades: string[]; dado: string; sustituye?: string }
  /** AC mínima mientras dure (Barkskin). */
  | { tipo: 'caMinima'; valor: Formula }
  /** Puedes usar otra característica para el ataque y el daño con ciertas armas (Bladesong, Pact of the Blade...).
   *  «dado»: dado de daño mínimo para esas armas (Martial Arts, Shillelagh); admite fórmulas entre llaves. */
  | { tipo: 'carAtaque'; car: Caracteristica | 'conjuro'; armas: ArmasCarAtaque; dado?: string }
  /** Dados de daño extra en los ataques con armas (Hunter's Mark, Divine Favor...). */
  | { tipo: 'danoExtra'; dado: string; tipoDano?: string }
  /** Efecto temporal que se activa y desactiva en la hoja (Rage, Bladesong, Mage Armor...). */
  | { tipo: 'activable'; nombre: string; efectos: Efecto[]; requisito?: RequisitoArmadura; texto?: string }
  | { tipo: 'nota'; texto: string }
)

export type RequisitoArmadura = 'sin armadura' | 'sin armadura ni escudo' | 'sin armadura pesada'
/** competentes · monje (simples cuerpo a cuerpo y marciales Light) · magicas · cuerpo · lista de armas base. */
export type ArmasCarAtaque = 'competentes' | 'monje' | 'magicas' | 'cuerpo' | string[]

export type TipoEfecto = Efecto['tipo']
