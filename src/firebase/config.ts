// Configuración pública del proyecto de Firebase (no es secreta: la seguridad la dan las reglas de Firestore).
// Mientras esté vacía, la app funciona en «modo local»: todo se guarda en este navegador.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

/** Identificador de la campaña en Firestore. */
export const CAMPAÑA_ID = 'miasma'

export const firebaseConfigurado = () => !!firebaseConfig.apiKey && !!firebaseConfig.projectId
