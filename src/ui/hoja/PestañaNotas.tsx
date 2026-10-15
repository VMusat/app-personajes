import { nuevoId } from '../../motor/personaje'
import type { PropsPestaña } from './HojaPersonaje'

const CAMPOS: [string, string][] = [
  ['alineamiento', 'Alineamiento'],
  ['edad', 'Edad'],
  ['apariencia', 'Apariencia'],
  ['personalidad', 'Personalidad'],
  ['ideales', 'Ideales'],
  ['vinculos', 'Vínculos'],
  ['defectos', 'Defectos'],
  ['historia', 'Historia'],
  ['aliados', 'Aliados y organizaciones'],
]

export function PestañaNotas({ p, actualizar }: PropsPestaña) {
  return (
    <div className="pestaña-notas formulario">
      <section>
        <h3>Detalles del personaje</h3>
        {CAMPOS.map(([k, t]) => (
          <label key={k} className="campo">
            {t}
            {['alineamiento', 'edad'].includes(k) ? (
              <input value={p.detalles[k] ?? ''} onChange={(e) => actualizar((x) => void (x.detalles[k] = e.target.value))} />
            ) : (
              <textarea rows={k === 'historia' ? 6 : 2} value={p.detalles[k] ?? ''} onChange={(e) => actualizar((x) => void (x.detalles[k] = e.target.value))} />
            )}
          </label>
        ))}
      </section>
      <section>
        <div className="fila-titulo">
          <h3>Notas</h3>
          <button
            className="boton"
            onClick={() => actualizar((x) => void x.notas.unshift({ id: nuevoId(), titulo: '', texto: '', fecha: new Date().toISOString().slice(0, 10) }))}
          >
            Nueva nota
          </button>
        </div>
        {p.notas.map((n) => (
          <article key={n.id} className="nota">
            <div className="fila">
              <input className="nota-titulo" placeholder="Título" value={n.titulo} onChange={(e) => actualizar((x) => void (x.notas.find((y) => y.id === n.id)!.titulo = e.target.value))} />
              <small className="sutil">{n.fecha}</small>
              <button className="boton-mini" aria-label="Borrar nota" onClick={() => confirm('¿Borrar la nota?') && actualizar((x) => void (x.notas = x.notas.filter((y) => y.id !== n.id)))}>✕</button>
            </div>
            <textarea rows={4} value={n.texto} onChange={(e) => actualizar((x) => void (x.notas.find((y) => y.id === n.id)!.texto = e.target.value))} />
          </article>
        ))}
      </section>
    </div>
  )
}
