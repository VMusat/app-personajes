// Gestión de la campaña (DM): lista de emails de jugadores con acceso y vista rápida del grupo.
import { useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { derivar } from '../../motor/derivar'
import { resumenPersonaje } from '../Inicio'
import ajustes from '../../setting/campaña.json'

export function PanelCampaña() {
  const { repo, campaña, set, personajes, datos, objetos, tiradasCompartidas, solicitudes } = useEstado()
  const [email, setEmail] = useState('')
  if (!repo?.esDM() || !campaña || !datos) return <p className="pantalla-centro">Solo para el DM.</p>
  const guardar = async (miembros: string[]) => {
    const c = { ...campaña, miembros }
    await repo.guardarCampaña(c)
    set({ campaña: c })
  }
  return (
    <div className="panel-campaña">
      <header className="cabecera-app">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>← Inicio</button>
        <h2>{ajustes.nombre}</h2>
      </header>

      {solicitudes.length > 0 && (
        <section className="solicitudes">
          <h3>Pendientes de validación</h3>
          <p className="sutil">Han entrado con su cuenta de Google, pero aún no tienen acceso.</p>
          <ul className="lista-miembros">
            {solicitudes.map((s) => (
              <li key={s.uid}>
                <span>
                  <b>{s.email}</b> {s.nombre && s.nombre !== s.email && <span className="sutil">({s.nombre})</span>}
                  <small className="sutil"> · {new Date(s.fecha).toLocaleString()}</small>
                </span>
                <span className="fila">
                  <button
                    className="boton"
                    onClick={async () => {
                      await repo.resolverSolicitud(s, true)
                      set({ campaña: await repo.campaña() })
                    }}
                  >
                    Dar acceso
                  </button>
                  <button className="boton secundario" onClick={() => repo.resolverSolicitud(s, false)}>
                    Rechazar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Jugadores con acceso</h3>
        <p className="sutil">Añade el email de Google de cada jugador. Solo verán y editarán sus propios personajes.</p>
        <ul className="lista-miembros">
          {campaña.miembros.map((m) => (
            <li key={m}>
              {m}
              <button className="boton-mini" onClick={() => guardar(campaña.miembros.filter((x) => x !== m))} aria-label={`Quitar ${m}`}>✕</button>
            </li>
          ))}
        </ul>
        <form
          className="fila"
          onSubmit={(e) => {
            e.preventDefault()
            const m = email.trim().toLowerCase()
            if (m && !campaña.miembros.includes(m)) void guardar([...campaña.miembros, m])
            setEmail('')
          }}
        >
          <input type="email" placeholder="jugador@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="boton">Añadir</button>
        </form>
      </section>

      <section>
        <h3>El grupo de un vistazo</h3>
        <table className="tabla-grupo">
          <thead><tr><th>Personaje</th><th>HP</th><th>AC</th><th>Percepción pasiva</th><th>Disolución</th></tr></thead>
          <tbody>
            {personajes.filter((p) => p.niveles.length).map((p) => {
              let fila = { hp: '—', ac: '—', pp: '—' }
              try {
                const h = derivar(p, datos, objetos)
                fila = { hp: `${p.estado.pgActuales ?? h.pgMax}/${h.pgMax}${p.estado.pgTemporales ? ` +${p.estado.pgTemporales}` : ''}`, ac: String(h.ca.valor), pp: String(h.percepcionPasiva) }
              } catch {
                // hoja incompleta
              }
              return (
                <tr key={p.id} onClick={() => ir({ tipo: 'hoja', id: p.id })} className="clicable">
                  <td><b>{p.nombre}</b><br /><small className="sutil">{resumenPersonaje(p, datos)} · {p.jugador}</small></td>
                  <td>{fila.hp}</td>
                  <td>{fila.ac}</td>
                  <td>{fila.pp}</td>
                  <td>{p.estado.disolucion}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Últimas tiradas de la mesa</h3>
        <ol className="historial">
          {tiradasCompartidas.map((t) => (
            <li key={t.id}>
              <span className="h-total">{t.total}</span>
              <span><b>{t.personaje}: {t.texto}</b><small>{t.detalle} · {new Date(t.fecha).toLocaleTimeString()}</small></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
