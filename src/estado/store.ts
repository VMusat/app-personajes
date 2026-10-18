// Estado global de la app.
import { create } from 'zustand'
import type { Datos } from '../datos/tipos'
import type { Personaje } from '../motor/personaje'
import type { ObjetoCampaña } from '../almacen/objetosCampaña'
import type { InfoCampaña, Repo, SolicitudAcceso, TiradaCompartida, Usuario } from '../almacen/repo'
import type { PeticionTirada, ResultadoTirada } from '../dados/tiradas'

export type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'crear'; id: string }
  | { tipo: 'hoja'; id: string; pestaña?: string }
  | { tipo: 'nivel'; id: string }
  | { tipo: 'almacen' }
  | { tipo: 'campaña' }
  | { tipo: 'guia' }

interface Estado {
  datos?: Datos
  progresoDatos: [number, number]
  errorDatos?: string
  repo?: Repo
  usuario?: Usuario | null
  campaña?: InfoCampaña | null
  personajes: Personaje[]
  objetos: ObjetoCampaña[]
  tiradasCompartidas: TiradaCompartida[]
  solicitudes: SolicitudAcceso[]
  vista: Vista
  /** Historial local de tiradas. */
  tiradas: ResultadoTirada[]
  colaTiradas: PeticionTirada[]
  compartirTiradas: boolean
  set: (p: Partial<Estado>) => void
  tirar: (p: PeticionTirada) => void
}

export const useEstado = create<Estado>((set) => ({
  progresoDatos: [0, 1],
  personajes: [],
  objetos: [],
  tiradasCompartidas: [],
  solicitudes: [],
  vista: { tipo: 'inicio' },
  tiradas: [],
  colaTiradas: [],
  compartirTiradas: leerPreferencia('compartirTiradas', true),
  set: (p) => set(p),
  // Como mucho 6 tiradas en espera: pulsar muchas veces seguidas no satura la página
  tirar: (p) => set((s) => (s.colaTiradas.length >= 6 ? {} : { colaTiradas: [...s.colaTiradas, p] })),
}))

export function leerPreferencia<T>(k: string, def: T): T {
  try {
    const v = localStorage.getItem(`pref:${k}`)
    return v === null ? def : (JSON.parse(v) as T)
  } catch {
    return def
  }
}

export function guardarPreferencia(k: string, v: unknown) {
  try {
    localStorage.setItem(`pref:${k}`, JSON.stringify(v))
  } catch {
    // sin almacenamiento
  }
}

// ── Enrutado por hash: #/hoja/<id>, #/crear/<id>, #/nivel/<id>, #/almacen, #/campaña, #/guia

export function vistaDeHash(h: string): Vista {
  const [, tipo, id, pestaña] = h.replace(/^#/, '').split('/')
  if (tipo === 'hoja' && id) return { tipo: 'hoja', id, pestaña }
  if (tipo === 'crear' && id) return { tipo: 'crear', id }
  if (tipo === 'nivel' && id) return { tipo: 'nivel', id }
  if (tipo === 'almacen') return { tipo: 'almacen' }
  if (tipo === 'campana') return { tipo: 'campaña' }
  if (tipo === 'guia') return { tipo: 'guia' }
  return { tipo: 'inicio' }
}

export function ir(v: Vista) {
  const h =
    v.tipo === 'inicio' ? '#/' :
    v.tipo === 'almacen' ? '#/almacen' :
    v.tipo === 'campaña' ? '#/campana' :
    v.tipo === 'guia' ? '#/guia' :
    v.tipo === 'hoja' ? `#/hoja/${v.id}${v.pestaña ? `/${v.pestaña}` : ''}` :
    `#/${v.tipo}/${v.id}`
  if (location.hash !== h) location.hash = h
  useEstado.getState().set({ vista: v })
}
