// Pantalla principal: acceso, lista de personajes y accesos del DM.
import { useState } from 'react'
import { ir, useEstado } from '../estado/store'
import { personajeVacio, type Personaje } from '../motor/personaje'
import { derivar } from '../motor/derivar'
import type { Datos } from '../datos/tipos'

export function resumenPersonaje(p: Personaje, d: Datos): string {
  const especie = d.especies.find((e) => e._clave === p.especie)?._nombre
  const cuenta: Record<string, number> = {}
  for (const n of p.niveles) cuenta[n.clase] = (cuenta[n.clase] ?? 0) + 1
  const clases = Object.entries(cuenta).map(([c, n]) => `${d.clases.find((x) => x._clave === c)?._nombre ?? c} ${n}`).join(' / ')
  return [especie, clases || 'sin clase'].filter(Boolean).join(' · ')
}

export function Inicio() {
  const { repo, usuario, campaña, personajes, datos, objetos, set } = useEstado()
  const [error, setError] = useState('')
  if (!repo || !datos) return null

  if (!usuario) {
    return (
      <div className="pantalla-centro portada">
        <h1 className="titulo-app">La miasma</h1>
        <p className="subtitulo">Personajes de D&amp;D 2024 para la campaña</p>
        <button className="boton grande" onClick={() => repo.entrar().catch((e: Error) => setError(e.message))}>Entrar con Google</button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  if (!campaña) {
    return (
      <div className="pantalla-centro">
        <h2>Hola, {usuario.nombre}</h2>
        <p>No tienes acceso a la campaña, o todavía no existe.</p>
        <p className="sutil">Si eres jugador, pide al DM que añada tu email: <b>{usuario.email}</b></p>
        <details>
          <summary>Soy el DM y quiero crear la campaña</summary>
          <p className="sutil">Solo funciona si la campaña aún no existe. Quedarás como DM.</p>
          <button
            className="boton"
            onClick={async () => {
              try {
                await repo.crearCampaña('La miasma')
                set({ campaña: await repo.campaña() })
              } catch (e) {
                setError((e as Error).message)
              }
            }}
          >
            Crear la campaña
          </button>
        </details>
        {error && <p className="error">{error}</p>}
        <button className="boton secundario" onClick={() => repo.salir()}>Salir</button>
      </div>
    )
  }

  const esDM = repo.esDM()
  const nuevo = async () => {
    const p = personajeVacio()
    p.jugador = usuario.nombre
    p.propietario = usuario.uid
    await repo.guardarPersonaje(p)
    ir({ tipo: 'crear', id: p.id })
  }

  const propios = personajes.filter((p) => !esDM || p.propietario === usuario.uid || repo.modo === 'local')
  const ajenos = esDM && repo.modo !== 'local' ? personajes.filter((p) => p.propietario !== usuario.uid) : []

  return (
    <div className="inicio">
      <header className="cabecera-app">
        <h1 className="titulo-app pequeño">La miasma</h1>
        <div className="fila">
          {repo.modo === 'local' && <span className="insignia" title="Firebase no está configurado: los datos se guardan solo en este navegador">Modo local</span>}
          {esDM && <span className="insignia dm">DM</span>}
          <span className="sutil">{usuario.nombre}</span>
          {repo.modo === 'firebase' && <button className="boton secundario" onClick={() => repo.salir()}>Salir</button>}
        </div>
      </header>

      <section>
        <div className="fila-titulo">
          <h2>Mis personajes</h2>
          <button className="boton" onClick={nuevo}>Nuevo personaje</button>
        </div>
        {propios.length === 0 && <p className="sutil">Aún no tienes personajes. Crea uno para empezar.</p>}
        <div className="rejilla-tarjetas">
          {propios.map((p) => <TarjetaPersonaje key={p.id} p={p} />)}
        </div>
      </section>

      {esDM && (
        <section>
          <h2>Herramientas del DM</h2>
          <div className="fila-botones">
            <button className="boton secundario" onClick={() => ir({ tipo: 'almacen' })}>Objetos de la campaña ({objetos.length})</button>
            {repo.modo === 'firebase' && <button className="boton secundario" onClick={() => ir({ tipo: 'campaña' })}>Jugadores y campaña</button>}
          </div>
          {ajenos.length > 0 && (
            <>
              <h3>Personajes de los jugadores</h3>
              <div className="rejilla-tarjetas">
                {ajenos.map((p) => <TarjetaPersonaje key={p.id} p={p} />)}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function TarjetaPersonaje({ p }: { p: Personaje }) {
  const { datos, objetos } = useEstado()
  if (!datos) return null
  const creado = p.niveles.length > 0 && !!p.especie && !!p.trasfondo
  let hp = ''
  let ac = ''
  if (creado) {
    try {
      const h = derivar(p, datos, objetos)
      hp = `${p.estado.pgActuales ?? h.pgMax}/${h.pgMax}`
      ac = String(h.ca.valor)
    } catch {
      // hoja incompleta
    }
  }
  return (
    <article className="tarjeta-personaje" onClick={() => ir(creado ? { tipo: 'hoja', id: p.id } : { tipo: 'crear', id: p.id })}>
      <h3>{p.nombre || 'Sin nombre'}</h3>
      <p className="sutil">{resumenPersonaje(p, datos)}</p>
      <p className="sutil">Jugador: {p.jugador || '—'}{p.aspecto ? ` · Aspecto: ${p.aspecto}` : ''}</p>
      {creado ? (
        <div className="fila stats-mini">
          <span>HP {hp}</span>
          <span>AC {ac}</span>
          <span>Nivel {p.niveles.length}</span>
        </div>
      ) : (
        <span className="insignia">En creación</span>
      )}
    </article>
  )
}
