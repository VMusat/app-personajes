import { useState } from 'react'
import { Entradas } from '../Entradas'
import { Buscador, normalizar } from '../comun'
import type { PropsPestaña } from './HojaPersonaje'
import { textoPlano } from '../../motor/resolver'

export function PestañaRasgos({ p, h }: PropsPestaña) {
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
              <Entradas entries={r.entries} personaje={p.nombre} />
            </details>
          ))}
        </section>
      ))}
    </div>
  )
}
