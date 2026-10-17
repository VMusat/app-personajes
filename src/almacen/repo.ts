// Almacén de personajes, objetos de campaña y tiradas compartidas.
// Dos implementaciones con la misma interfaz: Firebase (compartido) y local (este navegador).
import type { Personaje } from '../motor/personaje'
import type { ObjetoCampaña } from './objetosCampaña'

export interface Usuario {
  uid: string
  nombre: string
  email: string
}

export interface TiradaCompartida {
  id: string
  uid: string
  personaje: string
  texto: string
  total: number
  detalle: string
  fecha: number
}

/** Alguien que ha entrado con su cuenta pero aún no está en la lista de jugadores. */
export interface SolicitudAcceso {
  uid: string
  email: string
  nombre: string
  fecha: number
}

export interface InfoCampaña {
  nombre: string
  dms: string[]
  miembros: string[]
}

export type Cancelar = () => void

export interface Repo {
  modo: 'firebase' | 'local'
  alCambiarUsuario(cb: (u: Usuario | null) => void): Cancelar
  entrar(): Promise<void>
  salir(): Promise<void>
  /** Información de la campaña (null si no existe o no eres miembro). */
  campaña(): Promise<InfoCampaña | null>
  crearCampaña(nombre: string): Promise<void>
  guardarCampaña(c: InfoCampaña): Promise<void>
  esDM(): boolean
  /** Personajes visibles: los propios (o todos si eres DM). */
  personajes(cb: (ps: Personaje[]) => void): Cancelar
  guardarPersonaje(p: Personaje): Promise<void>
  borrarPersonaje(id: string): Promise<void>
  objetos(cb: (os: ObjetoCampaña[]) => void): Cancelar
  guardarObjeto(o: ObjetoCampaña): Promise<void>
  borrarObjeto(id: string): Promise<void>
  tiradas(cb: (ts: TiradaCompartida[]) => void): Cancelar
  compartirTirada(t: Omit<TiradaCompartida, 'id' | 'uid' | 'fecha'>): Promise<void>
  /** Quien no tiene acceso deja su solicitud para que el DM la valide. */
  solicitarAcceso(): Promise<void>
  /** Solicitudes pendientes (solo DM). */
  solicitudes(cb: (s: SolicitudAcceso[]) => void): Cancelar
  /** El DM acepta (añade el email a la lista) o rechaza una solicitud. */
  resolverSolicitud(s: SolicitudAcceso, aceptar: boolean): Promise<void>
}

// ── Modo local

const CLAVE = 'app-personajes:'
const leer = <T,>(k: string, def: T): T => {
  try {
    const v = localStorage.getItem(CLAVE + k)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
const escribir = (k: string, v: unknown) => {
  try {
    localStorage.setItem(CLAVE + k, JSON.stringify(v))
  } catch {
    // almacenamiento lleno o bloqueado
  }
}

export function repoLocal(): Repo {
  const oyentes = { personajes: new Set<(ps: Personaje[]) => void>(), objetos: new Set<(os: ObjetoCampaña[]) => void>(), tiradas: new Set<(t: TiradaCompartida[]) => void>() }
  const usuario: Usuario = { uid: 'local', nombre: 'Este navegador', email: '' }
  const avisar = () => {
    const ps = leer<Personaje[]>('personajes', [])
    oyentes.personajes.forEach((cb) => cb(ps))
    const os = leer<ObjetoCampaña[]>('objetos', [])
    oyentes.objetos.forEach((cb) => cb(os))
    const ts = leer<TiradaCompartida[]>('tiradas', [])
    oyentes.tiradas.forEach((cb) => cb(ts))
  }
  return {
    modo: 'local',
    alCambiarUsuario(cb) {
      cb(usuario)
      return () => {}
    },
    async entrar() {},
    async salir() {},
    async campaña() {
      return leer<InfoCampaña>('campaña', { nombre: 'Herederos de la Miasma', dms: ['local'], miembros: [] })
    },
    async crearCampaña(nombre) {
      escribir('campaña', { nombre, dms: ['local'], miembros: [] })
    },
    async guardarCampaña(c) {
      escribir('campaña', c)
    },
    esDM: () => true,
    personajes(cb) {
      oyentes.personajes.add(cb)
      cb(leer('personajes', []))
      return () => oyentes.personajes.delete(cb)
    },
    async guardarPersonaje(p) {
      const ps = leer<Personaje[]>('personajes', []).filter((x) => x.id !== p.id)
      escribir('personajes', [...ps, { ...p, propietario: 'local', actualizado: new Date().toISOString() }])
      avisar()
    },
    async borrarPersonaje(id) {
      escribir('personajes', leer<Personaje[]>('personajes', []).filter((x) => x.id !== id))
      avisar()
    },
    objetos(cb) {
      oyentes.objetos.add(cb)
      cb(leer('objetos', []))
      return () => oyentes.objetos.delete(cb)
    },
    async guardarObjeto(o) {
      const os = leer<ObjetoCampaña[]>('objetos', []).filter((x) => x.id !== o.id)
      escribir('objetos', [...os, { ...o, actualizado: new Date().toISOString() }])
      avisar()
    },
    async borrarObjeto(id) {
      escribir('objetos', leer<ObjetoCampaña[]>('objetos', []).filter((x) => x.id !== id))
      avisar()
    },
    tiradas(cb) {
      oyentes.tiradas.add(cb)
      cb(leer('tiradas', []))
      return () => oyentes.tiradas.delete(cb)
    },
    async compartirTirada(t) {
      const ts = leer<TiradaCompartida[]>('tiradas', [])
      escribir('tiradas', [{ ...t, id: String(Date.now()), uid: 'local', fecha: Date.now() }, ...ts].slice(0, 50))
      avisar()
    },
    // En modo local no hay más usuarios que validar
    async solicitarAcceso() {},
    solicitudes(cb) {
      cb([])
      return () => {}
    },
    async resolverSolicitud() {},
  }
}
