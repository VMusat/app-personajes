// Pantalla principal: acceso, lista de personajes y accesos del DM.
import { useEffect, useState } from 'react'
import { ir, useEstado } from '../estado/store'
import { personajeVacio, type Personaje } from '../motor/personaje'
import { derivar } from '../motor/derivar'
import type { Datos } from '../datos/tipos'
import { Modal } from './comun'
import { VentanaApariencia } from './Apariencia'

export function resumenPersonaje(p: Personaje, d: Datos): string {
  const especie = d.especies.find((e) => e._clave === p.especie)?._nombre
  const cuenta: Record<string, number> = {}
  for (const n of p.niveles) cuenta[n.clase] = (cuenta[n.clase] ?? 0) + 1
  const clases = Object.entries(cuenta).map(([c, n]) => `${d.clases.find((x) => x._clave === c)?._nombre ?? c} ${n}`).join(' / ')
  return [especie, clases || 'sin clase'].filter(Boolean).join(' · ')
}

export function Inicio() {
  const { repo, usuario, campaña, personajes, datos, objetos, solicitudes, set } = useEstado()
  const [error, setError] = useState('')
  const [apariencia, setApariencia] = useState(false)
  if (!repo || !datos) return null

  if (!usuario) {
    return (
      <div className="pantalla-centro portada">
        <h1 className="titulo-app">Herederos de la Miasma</h1>
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
        <SolicitudPendiente />
        <button
          className="boton"
          onClick={async () => {
            set({ campaña: await repo.campaña() })
          }}
        >
          Comprobar de nuevo
        </button>
        <details>
          <summary>Soy el DM y quiero crear la campaña</summary>
          <p className="sutil">Solo funciona si la campaña aún no existe. Quedarás como DM.</p>
          <button
            className="boton"
            onClick={async () => {
              try {
                await repo.crearCampaña('Herederos de la Miasma')
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
        <h1 className="titulo-app pequeño">Herederos de la Miasma</h1>
        <div className="fila">
          {repo.modo === 'local' && <span className="insignia" title="Firebase no está configurado: los datos se guardan solo en este navegador">Modo local</span>}
          {esDM && <span className="insignia dm">DM</span>}
          <span className="sutil">{usuario.nombre}</span>
          <button className="boton secundario" onClick={() => setApariencia(true)} aria-label="Apariencia">🎨 Apariencia</button>
          {apariencia && <VentanaApariencia alCerrar={() => setApariencia(false)} />}
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
            {repo.modo === 'firebase' && (
              <button className="boton secundario" onClick={() => ir({ tipo: 'campaña' })}>
                Jugadores y campaña{solicitudes.length ? ` (${solicitudes.length} pendiente${solicitudes.length > 1 ? 's' : ''})` : ''}
              </button>
            )}
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

/** Ventana de confirmación para borrar un personaje. */
export function BorrarPersonaje({ p, alCerrar, alBorrar }: { p: Personaje; alCerrar: () => void; alBorrar?: () => void }) {
  const repo = useEstado((s) => s.repo)
  const [borrando, setBorrando] = useState(false)
  return (
    <Modal titulo="Borrar personaje" alCerrar={alCerrar}>
      <p>¿Seguro que quieres borrar a <b>{p.nombre || 'este personaje sin nombre'}</b>? Se perderán su hoja, su inventario y sus notas. <b>No se puede deshacer.</b></p>
      <p className="sutil">Si quieres conservar una copia, antes descarga la copia de seguridad (JSON) desde el menú ⋮ de su hoja.</p>
      <div className="fila-botones">
        <button
          className="boton peligro"
          disabled={borrando}
          onClick={async () => {
            setBorrando(true)
            await repo?.borrarPersonaje(p.id)
            alCerrar()
            alBorrar?.()
          }}
        >
          {borrando ? 'Borrando…' : 'Sí, borrar'}
        </button>
        <button className="boton secundario" onClick={alCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}

/** Quien no tiene acceso deja su solicitud automáticamente para que el DM la valide con un clic. */
function SolicitudPendiente() {
  const { repo, usuario } = useEstado()
  const [estado, setEstado] = useState<'enviando' | 'enviada' | 'error'>('enviando')
  useEffect(() => {
    repo?.solicitarAcceso().then(
      () => setEstado('enviada'),
      () => setEstado('error'),
    )
  }, [repo])
  return (
    <>
      <p>Todavía no tienes acceso a la campaña.</p>
      {estado === 'enviada' && (
        <p className="ok">
          El DM ya ve tu solicitud con tu email (<b>{usuario?.email}</b>) y puede darte acceso con un clic. Cuando lo haga, pulsa «Comprobar de nuevo».
        </p>
      )}
      {estado === 'enviando' && <p className="sutil">Enviando tu solicitud de acceso…</p>}
      {estado === 'error' && <p className="sutil">No se pudo enviar la solicitud. Pide al DM que añada tu email: <b>{usuario?.email}</b></p>}
    </>
  )
}

function TarjetaPersonaje({ p }: { p: Personaje }) {
  const { datos, objetos, repo, usuario } = useEstado()
  const [borrar, setBorrar] = useState(false)
  if (!datos) return null
  const puedeBorrar = repo?.modo === 'local' || p.propietario === usuario?.uid || repo?.esDM()
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
      {puedeBorrar && (
        <button
          className="boton-icono borrar-tarjeta"
          aria-label={`Borrar a ${p.nombre || 'este personaje'}`}
          title="Borrar personaje"
          onClick={(e) => {
            e.stopPropagation()
            setBorrar(true)
          }}
        >
          🗑
        </button>
      )}
      {borrar && (
        <div onClick={(e) => e.stopPropagation()}>
          <BorrarPersonaje p={p} alCerrar={() => setBorrar(false)} />
        </div>
      )}
    </article>
  )
}
