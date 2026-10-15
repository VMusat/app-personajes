// Configuración pública del proyecto de Firebase (no es secreta: la seguridad la dan las reglas de Firestore).
// Si se vacía, la app funciona en «modo local»: todo se guarda en este navegador.
export const firebaseConfig = {
  apiKey: 'AIzaSyA2YgSuKWpXf_LJ48oasd7-d8k8jrwvwuQ',
  authDomain: 'app-personajes-miasma.firebaseapp.com',
  projectId: 'app-personajes-miasma',
  storageBucket: 'app-personajes-miasma.firebasestorage.app',
  messagingSenderId: '177043609935',
  appId: '1:177043609935:web:d1e63d8c3e849048d18d3a',
  measurementId: 'G-CEP4MXE3TZ',
}

/** Identificador de la campaña en Firestore. */
export const CAMPAÑA_ID = 'miasma'

export const firebaseConfigurado = () => !!firebaseConfig.apiKey && !!firebaseConfig.projectId
