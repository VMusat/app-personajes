// Implementación del almacén con Firebase: login con Google y Firestore con caché offline.
// Estructura: campanas/{id} (nombre, dms, miembros) con subcolecciones personajes, objetos y tiradas.
// Los personajes se guardan serializados en el campo «datos» (sus claves internas contienen «/» y «|»).
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, doc, getDoc, initializeFirestore, limit, onSnapshot, orderBy, persistentLocalCache,
  persistentMultipleTabManager, query, setDoc, where,
} from 'firebase/firestore'
import { CAMPAÑA_ID, firebaseConfig } from './config'
import type { InfoCampaña, Repo, SolicitudAcceso, TiradaCompartida, Usuario } from '../almacen/repo'
import type { Personaje } from '../motor/personaje'
import type { ObjetoCampaña } from '../almacen/objetosCampaña'

export function repoFirebase(): Repo {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  const campRef = doc(db, 'campanas', CAMPAÑA_ID)
  let usuario: User | null = null
  let info: InfoCampaña | null = null

  const esDM = () => !!usuario && !!info?.dms.includes(usuario.uid)

  return {
    modo: 'firebase',
    alCambiarUsuario(cb) {
      return onAuthStateChanged(auth, async (u) => {
        usuario = u
        info = null
        if (u) {
          try {
            const s = await getDoc(campRef)
            info = s.exists() ? (s.data() as InfoCampaña) : null
          } catch {
            info = null
          }
        }
        cb(u ? ({ uid: u.uid, nombre: u.displayName ?? u.email ?? 'Jugador', email: (u.email ?? '').toLowerCase() } as Usuario) : null)
      })
    },
    async entrar() {
      await signInWithPopup(auth, new GoogleAuthProvider())
    },
    async salir() {
      await signOut(auth)
    },
    async campaña() {
      try {
        const s = await getDoc(campRef)
        info = s.exists() ? (s.data() as InfoCampaña) : null
      } catch {
        info = null
      }
      return info
    },
    async crearCampaña(nombre) {
      if (!usuario) return
      info = { nombre, dms: [usuario.uid], miembros: [(usuario.email ?? '').toLowerCase()] }
      await setDoc(campRef, info)
    },
    async guardarCampaña(c) {
      info = c
      await setDoc(campRef, c)
    },
    esDM,
    personajes(cb) {
      if (!usuario) return () => {}
      const col = collection(campRef, 'personajes')
      const q = esDM() ? query(col) : query(col, where('propietario', '==', usuario.uid))
      return onSnapshot(q, (snap) => cb(snap.docs.map((d) => JSON.parse(d.data().datos) as Personaje)))
    },
    async guardarPersonaje(p) {
      if (!usuario) return
      const propietario = p.propietario ?? usuario.uid
      const datos: Personaje = { ...p, propietario, actualizado: new Date().toISOString() }
      await setDoc(doc(campRef, 'personajes', p.id), {
        propietario,
        nombre: p.nombre,
        actualizado: datos.actualizado,
        datos: JSON.stringify(datos),
      })
    },
    async borrarPersonaje(id) {
      await deleteDoc(doc(campRef, 'personajes', id))
    },
    objetos(cb) {
      if (!usuario) return () => {}
      return onSnapshot(collection(campRef, 'objetos'), (snap) => cb(snap.docs.map((d) => JSON.parse(d.data().datos) as ObjetoCampaña)))
    },
    async guardarObjeto(o) {
      const datos = { ...o, actualizado: new Date().toISOString() }
      await setDoc(doc(campRef, 'objetos', o.id), { nombre: o.nombre, datos: JSON.stringify(datos) })
    },
    async borrarObjeto(id) {
      await deleteDoc(doc(campRef, 'objetos', id))
    },
    tiradas(cb) {
      if (!usuario) return () => {}
      const q = query(collection(campRef, 'tiradas'), orderBy('fecha', 'desc'), limit(40))
      return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as TiradaCompartida), id: d.id }))))
    },
    async compartirTirada(t) {
      if (!usuario) return
      await addDoc(collection(campRef, 'tiradas'), { ...t, uid: usuario.uid, fecha: Date.now() })
    },
    async solicitarAcceso() {
      if (!usuario) return
      const s: SolicitudAcceso = { uid: usuario.uid, email: (usuario.email ?? '').toLowerCase(), nombre: usuario.displayName ?? usuario.email ?? '', fecha: Date.now() }
      await setDoc(doc(campRef, 'solicitudes', usuario.uid), s)
    },
    solicitudes(cb) {
      if (!usuario || !esDM()) {
        cb([])
        return () => {}
      }
      return onSnapshot(collection(campRef, 'solicitudes'), (snap) => cb(snap.docs.map((d) => d.data() as SolicitudAcceso).sort((a, b) => a.fecha - b.fecha)))
    },
    async resolverSolicitud(s, aceptar) {
      if (aceptar && info && !info.miembros.includes(s.email)) {
        info = { ...info, miembros: [...info.miembros, s.email] }
        await setDoc(campRef, info)
      }
      await deleteDoc(doc(campRef, 'solicitudes', s.uid))
    },
  }
}
