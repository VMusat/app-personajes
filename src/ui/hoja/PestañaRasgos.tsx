import { useState } from 'react'
import { Entradas } from '../Entradas'
import { Buscador, normalizar } from '../comun'
import type { PropsPestaña } from './HojaPersonaje'
import { textoPlano } from '../../motor/resolver'
import { useEstado } from '../../estado/store'
import { Contador } from '../comun'
import { RECARGA } from '../glosario'
import type { RasgoObtenido } from '../../motor/resolver'

export function PestañaRasgos({ p, h, actualizar }: PropsPestaña) {
  const [q, setQ] = useState('')
  const grupos = new Map<string, typeof h.rasgos>()
  for (const r of h.rasgos) {
    if (q && !normalizar(`${r.nombre} ${textoPlano(r.entries)}`).includes(normalizar(q))) continue
    // Los rasgos de «Subclase» y «ASI» solo anuncian elecciones: no aportan texto en la hoja
    if (/ Subclass$|^Ability Score Improvement$|^Epic Boon$|^Subclass Feature$/.test(r.nombre)) continue
    const g = r.tipo === 'clase' || r.tipo === 'subclase' ? r.origen.replace(/ \d+( \(.*\))?$/, '$1') : r.origen
    if (!grupos.has(g)) grupos.set(g, [])
    grupos.get(g)!.push(r)
  }
  return (
    <div className="pestaña-rasgos">
      <Buscador valor={q} alCambiar={setQ} texto="Buscar rasgo…" />
      {h.notas.length > 0 && (
        <section>
          <h3>Notas de reglas</h3>
          <ul>{h.notas.map((n, i) => <li key={i}>{n.texto} <small className="sutil">({n.origen})</small></li>)}</ul>
        </section>
      )}
      {[...grupos.entries()].map(([g, rs]) => (
        <section key={g}>
          <h3>{g}</h3>
          {rs.map((r, i) => (
            <details key={`${r.nombre}${i}`} className="rasgo">
              <summary>
                {r.nombre}
                {r.nivel > 0 && <small className="sutil"> · nivel {r.nivel}</small>}
              </summary>
              <UsosRasgo r={r} {...{ p, h, actualizar }} />
              <Entradas entries={r.entries} personaje={p.nombre} />
            </details>
          ))}
        </section>
      ))}
    </div>
  )
}

/** Contadores de usos y tiradas de un rasgo (los mismos recursos que en Combate). */
function UsosRasgo({ r, p, h, actualizar }: PropsPestaña & { r: RasgoObtenido }) {
  const tirar = useEstado((s) => s.tirar)
  const esDote = r.tipo === 'dote' || r.tipo === 'marca'
  const recursos = h.recursos.filter((x) => x.rasgo === r.nombre)
  const conjuros = esDote ? h.conjuros.filter((c) => c.origen === `Dote: ${r.nombre}` && c.idRecurso && typeof c.usos === 'number') : []
  if (!recursos.length && !conjuros.length) return null
  return (
    <ul className="lista-recursos usos-rasgo">
      {recursos.map((x) => (
        <li key={x.id}>
          <span className="recurso-nombre">
            <b>{x.nombre}</b>
            <small className="sutil">{RECARGA[x.recarga]}{x.recargaCorta ? ` (recupera ${x.recargaCorta} en Short Rest)` : ''}{x.dado ? ` · ${x.dado}` : ''}</small>
          </span>
          <Contador valor={p.estado.gastados[x.id] ?? 0} max={x.max} alCambiar={(v) => actualizar((y) => void (y.estado.gastados[x.id] = v))} etiqueta={x.nombre} />
          {x.dado && (
            <button className="boton-mini" onClick={() => tirar({ etiqueta: x.nombre, formula: /^\d/.test(x.dado!) ? x.dado! : `1${x.dado}`, personaje: p.nombre })} aria-label={`Tirar ${x.dado}`}>
              🎲 {x.dado}
            </button>
          )}
        </li>
      ))}
      {conjuros.map((c) => (
        <li key={c.idRecurso}>
          <span className="recurso-nombre">
            <b>{c.conjuro.name}</b>
            <small className="sutil">sin espacio · {RECARGA[c.recarga ?? 'largo']}</small>
          </span>
          <Contador valor={p.estado.gastados[c.idRecurso!] ?? 0} max={c.usos as number} alCambiar={(v) => actualizar((y) => void (y.estado.gastados[c.idRecurso!] = v))} etiqueta={c.conjuro.name} />
        </li>
      ))}
    </ul>
  )
}
