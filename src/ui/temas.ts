// Apariencia: modo (claro, oscuro o el del sistema), paleta de la app y color de los dados.
// Se guarda en este navegador y se aplica como variables CSS sobre <html>.
import { guardarPreferencia, leerPreferencia } from '../estado/store'

export type Modo = 'sistema' | 'claro' | 'oscuro'
export type Paleta = 'default' | 'verde' | 'beige' | 'azul' | 'rosa'

export interface Apariencia {
  modo: Modo
  paleta: Paleta
  dados: Paleta
}

export const NOMBRE_MODO: Record<Modo, string> = { sistema: 'Default (sistema)', claro: 'Claro', oscuro: 'Oscuro' }
export const NOMBRE_PALETA: Record<Paleta, string> = { default: 'Default', verde: 'Verde', beige: 'Beige', azul: 'Azul', rosa: 'Rosa' }
export const PALETAS: Paleta[] = ['default', 'verde', 'beige', 'azul', 'rosa']

type Vars = Record<string, string>

/** Colores de cada paleta en modo claro y oscuro. «default» es el violeta original de la app. */
const COLORES: Record<Paleta, { claro: Vars; oscuro: Vars }> = {
  default: {
    claro: { fondo: '#f4f1ea', 'fondo-2': '#ffffff', 'fondo-3': '#ebe6dc', borde: '#d8d0c4', acento: '#6b3fc4', 'acento-texto': '#ffffff', 'acento-suave': '#ece4fb' },
    oscuro: { fondo: '#14111b', 'fondo-2': '#1d1927', 'fondo-3': '#262133', borde: '#3a3249', acento: '#a77dff', 'acento-texto': '#160f24', 'acento-suave': '#2d2440' },
  },
  verde: {
    claro: { fondo: '#eef3ee', 'fondo-2': '#ffffff', 'fondo-3': '#dfe9e1', borde: '#c5d6c9', acento: '#2f7d4f', 'acento-texto': '#ffffff', 'acento-suave': '#dff1e6' },
    oscuro: { fondo: '#0f1612', 'fondo-2': '#17211b', 'fondo-3': '#1f2c24', borde: '#2f4236', acento: '#5fcf8e', 'acento-texto': '#0b1d12', 'acento-suave': '#1e3a2a' },
  },
  beige: {
    claro: { fondo: '#f6efe2', 'fondo-2': '#fffaf1', 'fondo-3': '#ebe0cc', borde: '#d9c9ad', acento: '#8a6a3b', 'acento-texto': '#ffffff', 'acento-suave': '#f1e5cf' },
    oscuro: { fondo: '#17140f', 'fondo-2': '#211c15', 'fondo-3': '#2b251c', borde: '#43392b', acento: '#d9b98a', 'acento-texto': '#231a0d', 'acento-suave': '#3a3124' },
  },
  azul: {
    claro: { fondo: '#eef2f8', 'fondo-2': '#ffffff', 'fondo-3': '#dfe6f1', borde: '#c6d2e4', acento: '#2f5fb8', 'acento-texto': '#ffffff', 'acento-suave': '#e1eafa' },
    oscuro: { fondo: '#0f131b', 'fondo-2': '#161c27', 'fondo-3': '#1e2533', borde: '#2e384b', acento: '#6ea8ff', 'acento-texto': '#0a1426', 'acento-suave': '#1c2a42' },
  },
  rosa: {
    claro: { fondo: '#f8eff3', 'fondo-2': '#ffffff', 'fondo-3': '#efdfe6', borde: '#e0c8d3', acento: '#b8457a', 'acento-texto': '#ffffff', 'acento-suave': '#f8e2ec' },
    oscuro: { fondo: '#181016', 'fondo-2': '#22171f', 'fondo-3': '#2d1f29', borde: '#46303f', acento: '#f08bbd', 'acento-texto': '#26101b', 'acento-suave': '#3d2131' },
  },
}

/** Colores comunes a todas las paletas según el modo. */
const BASE: { claro: Vars; oscuro: Vars } = {
  claro: {
    texto: '#1f1b24', 'texto-suave': '#6a6372', exito: '#2f8a4c', peligro: '#b8323a', aviso: '#b8741a', sombra: '0 2px 10px rgb(30 20 50 / 0.12)',
    iris: 'linear-gradient(100deg, #5d626c, #9aa0aa, #4b5058, #b4b9c2, #6b7079)', 'iris-texto': '#ffffff',
  },
  oscuro: {
    texto: '#ece6f6', 'texto-suave': '#a59cb5', exito: '#5cc882', peligro: '#ff6b72', aviso: '#f0b45a', sombra: '0 2px 14px rgb(0 0 0 / 0.45)',
    iris: 'linear-gradient(100deg, #ffffff, #c9cdd4, #f4f5f7, #9ea3ad, #e8eaee)', 'iris-texto': '#1b1822',
  },
}

/** Color de muestra de una paleta (para los botones de elección). */
export const muestra = (p: Paleta, oscuro: boolean) => COLORES[p][oscuro ? 'oscuro' : 'claro'].acento

export function leerApariencia(): Apariencia {
  return { modo: 'sistema', paleta: 'default', dados: 'default', ...leerPreferencia<Partial<Apariencia>>('apariencia', {}) }
}

const sistemaOscuro = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

export function esOscuro(a: Apariencia): boolean {
  return a.modo === 'oscuro' || (a.modo === 'sistema' && sistemaOscuro())
}

export function aplicarApariencia(a: Apariencia = leerApariencia()) {
  const oscuro = esOscuro(a)
  const m = oscuro ? 'oscuro' : 'claro'
  const raiz = document.documentElement
  const vars: Vars = { ...BASE[m], ...COLORES[a.paleta][m] }
  // Dados: su propia paleta, en el mismo modo
  const dados = COLORES[a.dados][m]
  vars.dado = dados.acento
  vars['dado-texto'] = dados['acento-texto']
  for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(`--${k}`, v)
  raiz.style.colorScheme = oscuro ? 'dark' : 'light'
  raiz.dataset.theme = oscuro ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars.fondo)
}

export function guardarApariencia(a: Apariencia) {
  guardarPreferencia('apariencia', a)
  aplicarApariencia(a)
}

/** Si el modo es «sistema», sigue los cambios del sistema operativo. */
export function seguirSistema() {
  if (typeof matchMedia === 'undefined') return
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (leerApariencia().modo === 'sistema') aplicarApariencia()
  })
}
