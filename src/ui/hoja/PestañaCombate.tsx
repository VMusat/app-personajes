import { useState } from 'react'
import { useEstado } from '../../estado/store'
import { Contador } from '../comun'
import { RECARGA, conSigno, titulo } from '../glosario'
import { nuevoId } from '../../motor/personaje'
import type { PropsPestaña } from './HojaPersonaje'
import { abrirDetalle } from '../Detalle'

export type ModoD20 = 'normal' | 'ventaja' | 'desventaja'

export function SelectorVentaja({ modo, alCambiar }: { modo: ModoD20; alCambiar: (m: ModoD20) => void }) {
  return (
    <div className="selector-ventaja" role="radiogroup" aria-label="Ventaja">
      {(['desventaja', 'normal', 'ventaja'] as const).map((m) => (
        <button key={m} role="radio" aria-checked={modo === m} className={modo === m ? 'activo' : ''} onClick={() => alCambiar(m)}>
          {m === 'normal' ? 'Normal' : m === 'ventaja' ? 'Ventaja' : 'Desventaja'}
        </button>
      ))}
    </div>
  )
}

export function PestañaCombate({ p, h, actualizar }: PropsPestaña) {
  const tirar = useEstado((s) => s.tirar)
  const [modo, setModo] = useState<ModoD20>('normal')
  const [nuevoRecurso, setNuevoRecurso] = useState(false)
  const ventaja = modo === 'normal' ? undefined : modo
  const pen = h.penalizacionD20
  const maestrias = useEstado((s) => s.datos?.maestrias ?? [])

  const alternarActivo = (nombre: string) =>
    actualizar((x) => {
      const a = x.estado.activos ?? []
      x.estado.activos = a.includes(nombre) ? a.filter((n) => n !== nombre) : [...a, nombre]
    })

  return (
    <div className="pestaña-combate">
      {h.activables.length > 0 && (
        <section>
          <h3>Efectos activos</h3>
          <p className="sutil">Actívalos mientras duren: la AC, la Speed y los ataques se recalculan solos. El descanso largo los desactiva.</p>
          <div className="lista-activables">
            {h.activables.map((a) => (
              <label key={a.nombre} className={`activable ${a.activo ? 'activo' : ''} ${a.bloqueado && a.activo ? 'bloqueado' : ''}`}>
                <input type="checkbox" checked={a.activo} onChange={() => alternarActivo(a.nombre)} />
                <span>
                  <b>{a.nombre}</b> <small className="sutil">{a.origen && a.origen !== a.nombre ? `· ${a.origen}` : ''}</small>
                  {a.texto && <small className="activable-texto">{a.texto}</small>}
                  {a.bloqueado && <small className="aviso-texto">{a.bloqueado}{a.activo ? ': no se aplica ahora' : ''}</small>}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="fila-titulo">
          <h3>Ataques</h3>
          <SelectorVentaja modo={modo} alCambiar={setModo} />
        </div>
        <table className="tabla-ataques">
          <thead>
            <tr><th>Ataque</th><th>Bono</th><th>Daño</th><th className="ocultar-movil">Alcance</th></tr>
          </thead>
          <tbody>
            {h.ataques.map((a) => (
              <tr key={a.id}>
                <td>
                  <b>{a.nombre}</b>
                  {a.maestria && (
                    <button className="insignia enlace-insignia" onClick={() => abrirDetalleMaestria(a.maestria!, maestrias)}>Mastery: {a.maestria}</button>
                  )}
                  {a.propiedades.length > 0 && <small className="sutil"> {a.propiedades.join(', ')}</small>}
                  {a.notas && a.notas.length > 0 && <small className="nota-ataque">{a.notas.join(' · ')}</small>}
                </td>
                <td>
                  <button
                    className="boton-tirada"
                    onClick={() =>
                      tirar({
                        etiqueta: `Ataque: ${a.nombre}`,
                        formula: `1d20${conSigno(a.bonoAtaque + pen)}`,
                        d20: true,
                        ventaja,
                        dano: { formula: a.dano, tipo: a.tipoDano },
                        personaje: p.nombre,
                      })
                    }
                  >
                    {conSigno(a.bonoAtaque)}
                  </button>
                </td>
                <td>
                  <button className="boton-tirada" onClick={() => tirar({ etiqueta: `Daño: ${a.nombre}`, formula: a.dano, personaje: p.nombre })}>
                    {a.dano} <small>{a.tipoDano}</small>
                  </button>
                  {a.versatil && (
                    <button className="boton-tirada secundario" onClick={() => tirar({ etiqueta: `Daño (a dos manos): ${a.nombre}`, formula: a.versatil!, personaje: p.nombre })}>
                      {a.versatil} <small>2 manos</small>
                    </button>
                  )}
                </td>
                <td className="ocultar-movil">{a.alcance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sutil">Equipa armas en el inventario para que aparezcan aquí. Tras un ataque puedes tirar el daño (doble de dados si es crítico).</p>
      </section>

      <section>
        <div className="fila-titulo">
          <h3>Recursos</h3>
          <button className="boton secundario" onClick={() => setNuevoRecurso(true)}>Añadir contador</button>
        </div>
        {h.recursos.length === 0 && <p className="sutil">Sin recursos con usos.</p>}
        <ul className="lista-recursos">
          {h.recursos.map((r) => {
            const gastados = p.estado.gastados[r.id] ?? 0
            return (
              <li key={r.id}>
                <span className="recurso-nombre">
                  <b>{r.nombre}</b>
                  <small className="sutil">{RECARGA[r.recarga]}{r.recargaCorta ? ` (recupera ${r.recargaCorta} en Short Rest)` : ''}{r.dado ? ` · ${r.dado}` : ''}</small>
                </span>
                <Contador valor={gastados} max={r.max} alCambiar={(v) => actualizar((x) => void (x.estado.gastados[r.id] = v))} etiqueta={r.nombre} />
                {r.dado && (
                  <button className="boton-mini" onClick={() => tirar({ etiqueta: r.nombre, formula: /^\d/.test(r.dado!) ? r.dado! : `1${r.dado}`, personaje: p.nombre })}>
                    🎲
                  </button>
                )}
                {r.id.startsWith('man:') && (
                  <button className="boton-mini" aria-label="Quitar" onClick={() => actualizar((x) => void (x.recursosManuales = x.recursosManuales.filter((m) => `man:${m.id}` !== r.id)))}>✕</button>
                )}
              </li>
            )
          })}
        </ul>
        {nuevoRecurso && (
          <form
            className="fila"
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              actualizar((x) =>
                void x.recursosManuales.push({
                  id: nuevoId(),
                  nombre: String(f.get('nombre')),
                  max: Number(f.get('max')) || 1,
                  recarga: String(f.get('recarga')) as 'largo',
                }),
              )
              setNuevoRecurso(false)
            }}
          >
            <input name="nombre" placeholder="Nombre" required />
            <input name="max" type="number" min={1} defaultValue={1} aria-label="Usos" />
            <select name="recarga" defaultValue="largo">
              <option value="largo">Long Rest</option>
              <option value="corto">Short Rest</option>
              <option value="amanecer">Dawn</option>
              <option value="nunca">Nunca</option>
            </select>
            <button className="boton">Añadir</button>
          </form>
        )}
      </section>

      {h.columnas.length > 0 && (
        <section>
          <h3>De tu clase</h3>
          <div className="fila columnas-clase">
            {h.columnas.map((c) => (
              <span key={`${c.clase}${c.etiqueta}`} className="chip">
                {c.etiqueta}: <b>{c.valor}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="defensas">
        <h3>Defensas</h3>
        <p><b>AC</b> {h.ca.valor} <span className="sutil">({h.ca.detalle})</span></p>
        <p><b>Hit Dice</b> {h.dadosGolpe.map((d) => `${d.total - (p.estado.dadosGolpeGastados[d.caras] ?? 0)}/${d.total} d${d.caras}`).join(', ')}</p>
        {h.resistencias.length > 0 && <p><b>Resistencias:</b> {h.resistencias.map(titulo).join(', ')}</p>}
        {h.inmunidades.length > 0 && <p><b>Inmunidades:</b> {h.inmunidades.map(titulo).join(', ')}</p>}
        {h.inmunidadesCondicion.length > 0 && <p><b>Inmune a condiciones:</b> {h.inmunidadesCondicion.map(titulo).join(', ')}</p>}
        {h.bonosCondicionales.map((b, i) => <p key={i} className="sutil">{b.texto} — {b.origen}</p>)}
      </section>
    </div>
  )
}

function abrirDetalleMaestria(nombre: string, maestrias: { name: string; _clave: string }[]) {
  const m = maestrias.find((x) => x.name === nombre)
  if (m) abrirDetalle({ tipo: 'maestria', clave: m._clave })
}
