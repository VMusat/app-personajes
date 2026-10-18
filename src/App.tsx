import { useEffect } from 'react'
import { useEstado, vistaDeHash } from './estado/store'
import { cargarDatos } from './datos/cargar'
import { firebaseConfigurado } from './firebase/config'
import { repoLocal, type Repo } from './almacen/repo'
import { Bandeja } from './dados/Bandeja'
import { Detalle } from './ui/Detalle'
import { Cargando } from './ui/comun'
import { Inicio } from './ui/Inicio'
import { Creador } from './ui/creador/Creador'
import { HojaPersonaje } from './ui/hoja/HojaPersonaje'
import { SubirNivel } from './ui/creador/SubirNivel'
import { Almacen } from './ui/dm/Almacen'
import { PanelCampaña } from './ui/dm/PanelCampaña'
import { Guia } from './ui/Guia'

// Una sola instancia: Firebase no admite inicializarse dos veces (React StrictMode monta los efectos dos veces)
let promesaRepo: Promise<Repo> | undefined
function crearRepo(): Promise<Repo> {
  // ?local en la URL fuerza el modo local (útil para probar sin iniciar sesión)
  const local = !firebaseConfigurado() || new URLSearchParams(location.search).has('local')
  promesaRepo ??= local ? Promise.resolve(repoLocal()) : import('./firebase/repoFirebase').then((m) => m.repoFirebase())
  return promesaRepo
}

export default function App() {
  const { datos, progresoDatos, errorDatos, repo, usuario, vista, set } = useEstado()

  // Datos de reglas
  useEffect(() => {
    cargarDatos((h, t) => set({ progresoDatos: [h, t] }))
      .then((d) => set({ datos: d }))
      .catch((e: Error) => set({ errorDatos: e.message }))
  }, [set])

  // Almacén y usuario
  useEffect(() => {
    let cancelar = () => {}
    let vivo = true
    void crearRepo().then((r) => {
      if (!vivo) return
      set({ repo: r })
      cancelar = r.alCambiarUsuario(async (u) => {
        set({ usuario: u, campaña: u ? await r.campaña() : null })
      })
    })
    return () => {
      vivo = false
      cancelar()
    }
  }, [set])

  // Suscripciones a personajes, objetos y tiradas compartidas
  const campaña = useEstado((s) => s.campaña)
  useEffect(() => {
    if (!repo || !usuario || !campaña) return
    const c1 = repo.personajes((ps) => set({ personajes: [...ps].sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
    const c2 = repo.objetos((os) => set({ objetos: [...os].sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
    const c3 = repo.tiradas((ts) => set({ tiradasCompartidas: ts }))
    const c4 = repo.solicitudes((s) => set({ solicitudes: s }))
    return () => {
      c1()
      c2()
      c3()
      c4()
    }
  }, [repo, usuario, campaña, set])

  // Enrutado por hash
  useEffect(() => {
    const alCambiar = () => set({ vista: vistaDeHash(location.hash) })
    alCambiar()
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [set])

  let contenido
  // La guía es pública: se lee sin iniciar sesión y sin esperar a las reglas
  if (vista.tipo === 'guia') contenido = <Guia />
  else if (errorDatos) {
    contenido = (
      <div className="pantalla-centro">
        <h2>No se pudieron cargar las reglas</h2>
        <p>{errorDatos}</p>
        <p className="sutil">La app descarga los datos de 5etools la primera vez; después funcionan sin conexión. Comprueba tu conexión y recarga.</p>
        <button className="boton" onClick={() => location.reload()}>Recargar</button>
      </div>
    )
  } else if (!datos || !repo || usuario === undefined) {
    const [h, t] = progresoDatos
    contenido = <Cargando texto={`Cargando reglas de D&D 2024… ${Math.round((100 * h) / t)}%`} />
  } else if (!usuario || !campaña) contenido = <Inicio />
  else if (vista.tipo === 'crear') contenido = <Creador id={vista.id} />
  else if (vista.tipo === 'hoja') contenido = <HojaPersonaje id={vista.id} pestañaInicial={vista.pestaña} />
  else if (vista.tipo === 'nivel') contenido = <SubirNivel id={vista.id} />
  else if (vista.tipo === 'almacen') contenido = <Almacen />
  else if (vista.tipo === 'campaña') contenido = <PanelCampaña />
  else contenido = <Inicio />

  return (
    <>
      <main className="app">{contenido}</main>
      {vista.tipo !== 'guia' && <Bandeja />}
      <Detalle />
    </>
  )
}
