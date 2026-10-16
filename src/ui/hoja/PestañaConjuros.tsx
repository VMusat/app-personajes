import { useMemo, useState } from 'react'
import { useEstado } from '../../estado/store'
import type { ConjuroHoja } from '../../motor/derivar'
import { Contador, Modal } from '../comun'
import { ABREV, ESCUELAS, NIVEL_CONJURO, RECARGA, conSigno } from '../glosario'
import { abrirDetalle, alcanceConjuro, duracionConjuro, tiempoConjuro } from '../Detalle'
import type { PropsPestaña } from './HojaPersonaje'
import { EditorEleccion } from '../creador/EditorEleccion'
import type { Crudo } from '../../datos/tipos'

/** Primer dado de daño o curación del texto del conjuro (para el botón de tirar). */
function danoConjuro(c: Crudo, nivelLanzado: number, nivelPj: number): string | undefined {
  const texto = JSON.stringify(c.entries)
  const m = texto.match(/\{@(?:damage|dice) ([^}|]+)/)
  if (!m) return undefined
  let f = m[1].replace(/\s/g, '')
  if (c.level === 0) {
    // Trucos: escalan a nivel 5, 11 y 17
    const mult = nivelPj >= 17 ? 4 : nivelPj >= 11 ? 3 : nivelPj >= 5 ? 2 : 1
    f = f.replace(/^(\d+)d(\d+)/, (_, n, d) => `${Number(n) * mult}d${d}`)
  } else if (nivelLanzado > c.level) {
    const esc = JSON.stringify(c.entriesHigherLevel ?? '').match(/\{@scaledamage [^|]+\|[^|]+\|(\d+)d(\d+)\}/)
    if (esc) f = f.replace(/^(\d+)d(\d+)/, (_, n, d) => (d === esc[2] ? `${Number(n) + Number(esc[1]) * (nivelLanzado - c.level)}d${d}` : `${n}d${d}`))
  }
  return f
}

export function PestañaConjuros({ p, h, actualizar }: PropsPestaña) {
  const datos = useEstado((s) => s.datos)
  const tirar = useEstado((s) => s.tirar)
  const [lanzando, setLanzando] = useState<ConjuroHoja>()
  const [preparar, setPreparar] = useState(false)
  const [filtro, setFiltro] = useState<'preparados' | 'todos'>('preparados')
  const gastados = p.estado.gastados
  // Elecciones de conjuros preparados de cada clase (para preparar y quitar desde la lista)
  const prepElecciones = h.resolucion.elecciones.filter((e) => e.tipo === 'preparados')
  const eleccionDe = (clave: string) => prepElecciones.find((e) => e.opciones.some((o) => o.valor === clave && !o.bloqueada))
  const porNivel = useMemo(() => {
    const m = new Map<number, ConjuroHoja[]>()
    const meter = (c: ConjuroHoja) => {
      if (!m.has(c.conjuro.level)) m.set(c.conjuro.level, [])
      m.get(c.conjuro.level)!.push(c)
    }
    for (const c of h.conjuros) {
      if (filtro === 'preparados' && !c.preparado && !c.siempre && c.conjuro.level > 0) continue
      meter(c)
    }
    // «Todos»: también los conjuros de la lista de la clase que podrías preparar y no tienes preparados
    if (filtro === 'todos') {
      for (const e of prepElecciones) {
        const l = h.lanzamiento.find((x) => e.id === `cls:${x.clase}:preparados`)
        for (const o of e.opciones) {
          if (o.bloqueada || h.conjuros.some((c) => c.conjuro._clave === o.valor)) continue
          const cj = datos?.conjuros.find((x) => x._clave === o.valor)
          if (cj && l) meter({ conjuro: cj, origen: l.nombre, preparado: false, siempre: false, cd: l.cd, ataque: l.ataque, car: l.car })
        }
      }
    }
    for (const lista of m.values()) lista.sort((a, b) => a.conjuro.name.localeCompare(b.conjuro.name))
    return [...m.entries()].sort((a, b) => a[0] - b[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, filtro])
  const alternarPreparado = (clave: string) => {
    const e = eleccionDe(clave)
    if (!e) return
    actualizar((x) => {
      const v = x.elecciones[e.id] ?? []
      x.elecciones[e.id] = v.includes(clave) ? v.filter((k) => k !== clave) : v.length < e.n ? [...v, clave] : v
    })
  }
  const eleccionesPreparar = h.resolucion.elecciones.filter((e) => ['preparados', 'trucos', 'libro'].includes(e.tipo))
  const nPreparados = (clase: string) => (p.elecciones[`cls:${clase}:preparados`] ?? []).length

  const gastarEspacio = (nivel: number | 'pacto') =>
    actualizar((x) => {
      const id = nivel === 'pacto' ? 'pacto' : `espacio:${nivel}`
      x.estado.gastados[id] = (x.estado.gastados[id] ?? 0) + 1
    })

  return (
    <div className="pestaña-conjuros">
      <section className="lanzadores">
        {h.lanzamiento.map((l) => (
          <div key={l.clase} className="lanzador">
            <b>{l.nombre}</b> <span className="sutil">({ABREV[l.car]})</span>
            <span>Spell save DC <b>{l.cd}</b></span>
            <button className="boton-tirada" onClick={() => tirar({ etiqueta: `Ataque de conjuro (${l.nombre})`, formula: `1d20${conSigno(l.ataque + h.penalizacionD20)}`, d20: true, personaje: p.nombre })}>
              Spell attack {conSigno(l.ataque)}
            </button>
            {p.elecciones[`cls:${l.clase}:preparados`] !== undefined && <span className="sutil">Preparados: {nPreparados(l.clase)}</span>}
          </div>
        ))}
        {eleccionesPreparar.length > 0 && <button className="boton secundario" onClick={() => setPreparar(true)}>Cambiar conjuros preparados</button>}
      </section>

      {(h.espacios.length > 0 || h.pacto) && (
        <section className="espacios">
          <h3>Espacios de conjuro</h3>
          <div className="fila espacios-fila">
            {h.espacios.map((n, i) => (
              <span key={i} className="espacio">
                <small>{i + 1}</small>
                <Contador valor={gastados[`espacio:${i + 1}`] ?? 0} max={n} alCambiar={(v) => actualizar((x) => void (x.estado.gastados[`espacio:${i + 1}`] = v))} etiqueta={`Espacios de nivel ${i + 1}`} />
              </span>
            ))}
            {h.pacto && (
              <span className="espacio pacto">
                <small>Pact {h.pacto.nivel}</small>
                <Contador valor={gastados.pacto ?? 0} max={h.pacto.n} alCambiar={(v) => actualizar((x) => void (x.estado.gastados.pacto = v))} etiqueta="Espacios de pacto" />
              </span>
            )}
          </div>
        </section>
      )}

      <div className="fila-titulo">
        <h3>Conjuros</h3>
        <div className="selector-ventaja">
          <button className={filtro === 'preparados' ? 'activo' : ''} onClick={() => setFiltro('preparados')}>Preparados</button>
          <button className={filtro === 'todos' ? 'activo' : ''} onClick={() => setFiltro('todos')}>Todos</button>
        </div>
      </div>
      {porNivel.map(([nivel, lista]) => (
        <section key={nivel}>
          <h4>{NIVEL_CONJURO(nivel)}</h4>
          <ul className="lista-conjuros">
            {lista.map((c) => (
              <li key={`${c.conjuro._clave}${c.origen}`} className={c.preparado || c.siempre || nivel === 0 ? '' : 'no-preparado'}>
                <button className="enlace nombre-conjuro" onClick={() => abrirDetalle({ tipo: 'conjuro', clave: c.conjuro._clave })}>
                  {c.conjuro.name}
                </button>
                <small className="sutil">
                  {ESCUELAS[c.conjuro.school]} · {tiempoConjuro(c.conjuro)} · {alcanceConjuro(c.conjuro)}
                  {duracionConjuro(c.conjuro).startsWith('Concentration') ? ' · C' : ''}
                  {c.ritual || c.conjuro.meta?.ritual ? ' · R' : ''}
                  {c.siempre && nivel > 0 ? ' · siempre preparado' : ''}
                  {' · '}{c.origen}
                </small>
                {c.usos === 'voluntad' && <span className="insignia">A voluntad</span>}
                {c.idRecurso && typeof c.usos === 'number' && (
                  <span className="usos-conjuro" title={`Sin espacio · ${RECARGA[c.recarga ?? 'largo']}`}>
                    <Contador valor={gastados[c.idRecurso] ?? 0} max={c.usos} alCambiar={(v) => actualizar((x) => void (x.estado.gastados[c.idRecurso!] = v))} />
                  </span>
                )}
                {(() => {
                  const e = nivel > 0 && !c.siempre ? eleccionDe(c.conjuro._clave) : undefined
                  if (!e) return null
                  const preparado = e.valor.includes(c.conjuro._clave)
                  if (e.cambia !== 'largo') return preparado ? null : <span className="insignia" title="Estos conjuros se cambian al subir de nivel">No preparado</span>
                  return (
                    <button className="boton-mini" disabled={!preparado && e.valor.length >= e.n} onClick={() => alternarPreparado(c.conjuro._clave)} title={!preparado && e.valor.length >= e.n ? `Ya tienes ${e.n} preparados` : ''}>
                      {preparado ? 'Quitar' : 'Preparar'}
                    </button>
                  )
                })()}
                {(c.preparado || c.siempre || nivel === 0) && <button className="boton-mini" onClick={() => setLanzando(c)}>Lanzar</button>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lanzando && (
        <ModalLanzar
          c={lanzando}
          {...{ p, h, actualizar }}
          alCerrar={() => setLanzando(undefined)}
          gastar={gastarEspacio}
          tirarDano={(nivel) => {
            const f = danoConjuro(lanzando.conjuro, nivel, h.nivel)
            if (f) tirar({ etiqueta: `${lanzando.conjuro.name}`, formula: f, personaje: p.nombre })
          }}
        />
      )}

      {preparar && (
        <Modal titulo="Conjuros preparados y conocidos" alCerrar={() => setPreparar(false)} ancho="ancho">
          {eleccionesPreparar.map((e) => (
            <EditorEleccion key={e.id} e={e} alCambiar={(v) => actualizar((x) => void (x.elecciones[e.id] = v))} />
          ))}
        </Modal>
      )}
    </div>
  )
}

function ModalLanzar({ c, p, h, actualizar, alCerrar, gastar, tirarDano }: PropsPestaña & { c: ConjuroHoja; alCerrar: () => void; gastar: (n: number | 'pacto') => void; tirarDano: (nivel: number) => void }) {
  const tirar = useEstado((s) => s.tirar)
  const nivel = c.conjuro.level
  const gastados = p.estado.gastados
  const opciones: { id: number | 'pacto' | 'gratis'; texto: string; nivel: number; disponible: boolean }[] = []
  if (nivel > 0) {
    if (c.idRecurso && typeof c.usos === 'number') opciones.push({ id: 'gratis', texto: `Sin espacio (${c.usos - (gastados[c.idRecurso] ?? 0)} usos)`, nivel, disponible: (gastados[c.idRecurso] ?? 0) < c.usos })
    h.espacios.forEach((n, i) => {
      if (i + 1 >= nivel) opciones.push({ id: i + 1, texto: `Espacio de nivel ${i + 1} (${n - (gastados[`espacio:${i + 1}`] ?? 0)}/${n})`, nivel: i + 1, disponible: (gastados[`espacio:${i + 1}`] ?? 0) < n })
    })
    if (h.pacto && h.pacto.nivel >= nivel) opciones.push({ id: 'pacto', texto: `Espacio de pacto (nivel ${h.pacto.nivel})`, nivel: h.pacto.nivel, disponible: (gastados.pacto ?? 0) < h.pacto.n })
  }
  const concentracion = duracionConjuro(c.conjuro).startsWith('Concentration')
  const ataque = (c.conjuro.spellAttack as string[] | undefined)?.length
  const salvacion = (c.conjuro.savingThrow as string[] | undefined)?.[0]
  const dano = danoConjuro(c.conjuro, nivel, h.nivel)

  const lanzar = (o?: (typeof opciones)[number]) => {
    if (o) {
      if (o.id === 'gratis') actualizar((x) => void (x.estado.gastados[c.idRecurso!] = (x.estado.gastados[c.idRecurso!] ?? 0) + 1))
      else gastar(o.id)
    }
    if (concentracion) actualizar((x) => void (x.estado.concentracion = c.conjuro.name))
    if (ataque) tirar({ etiqueta: `Ataque: ${c.conjuro.name}`, formula: `1d20${conSigno(c.ataque + h.penalizacionD20)}`, d20: true, personaje: p.nombre, dano: dano ? { formula: danoConjuro(c.conjuro, o?.nivel ?? nivel, h.nivel)!, tipo: '' } : undefined })
    else if (dano) tirarDano(o?.nivel ?? nivel)
    alCerrar()
  }

  return (
    <Modal titulo={`Lanzar ${c.conjuro.name}`} alCerrar={alCerrar}>
      <p className="sutil">
        {salvacion && <>Salvación de {salvacion} contra DC <b>{c.cd}</b>. </>}
        {ataque && <>Ataque de conjuro {conSigno(c.ataque)}. </>}
        {concentracion && 'Requiere concentración.'}
      </p>
      {nivel === 0 || c.usos === 'voluntad' ? (
        <button className="boton" onClick={() => lanzar()}>Lanzar{dano ? ` y tirar ${ataque ? 'ataque' : dano}` : ''}</button>
      ) : (
        <div className="lista-botones">
          {opciones.map((o) => (
            <button key={String(o.id)} className="boton secundario" disabled={!o.disponible} onClick={() => lanzar(o)}>{o.texto}</button>
          ))}
          {!opciones.length && <p>No tienes espacios para este conjuro.</p>}
          <button className="enlace" onClick={() => lanzar()}>Lanzar sin gastar nada (ritual u otro motivo)</button>
        </div>
      )}
    </Modal>
  )
}
