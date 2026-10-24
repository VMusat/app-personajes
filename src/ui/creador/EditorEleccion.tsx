// Control genérico para cualquier elección que genera el motor (habilidades, dotes, conjuros, subclase, PG...).
import { useMemo, useState } from 'react'
import type { ConjuroFijo, Eleccion, Opcion } from '../../motor/resolver'
import { useEstado } from '../../estado/store'
import { abrirDetalle } from '../Detalle'
import { Buscador, normalizar } from '../comun'
import { Entradas } from '../Entradas'
import { ABREV } from '../glosario'
import type { Caracteristica } from '../../datos/tipos'
import { CARACTERISTICAS } from '../../datos/tipos'

interface Props {
  e: Eleccion
  alCambiar: (valores: string[]) => void
  /** Habilidades en las que ya es competente (para avisar y para «pericia»). */
  competentes?: Set<string>
  /** Valores elegidos en otras elecciones del mismo tipo (para avisar de repeticiones). */
  repetidos?: Set<string>
}

export function EditorEleccion({ e, alCambiar, competentes, repetidos }: Props) {
  return (
    <fieldset className={`eleccion ${e.completa ? 'completa' : 'pendiente'}`}>
      <legend>
        {e.etiqueta}
        {e.n > 1 && e.tipo !== 'aumento' && <span className="contador-eleccion"> {e.valor.length}/{e.n}</span>}
        {!e.completa && <span className="insignia aviso">Pendiente</span>}
      </legend>
      {(e.meta?.repetidas as string[] | undefined)?.length ? (
        <p className="aviso-texto">
          Ya tenías {(e.meta!.repetidas as string[]).map((v) => e.opciones.find((o) => o.valor === v)?.etiqueta ?? v).join(', ')} por otra vía: quítala y elige otra para no desperdiciarla.
        </p>
      ) : null}
      {e.cambia && <p className="sutil">Se puede cambiar {e.cambia === 'largo' ? 'tras cada descanso largo' : e.cambia === 'corto' ? 'tras cada descanso' : 'al subir de nivel'}.</p>}
      <ConjurosFijos fijos={e.meta?.fijos as ConjuroFijo[] | undefined} />
      {e.tipo === 'idioma' && (e.meta?.conocidos as { nombre: string; origen: string }[] | undefined)?.length ? (
        <div className="conjuros-fijos">
          <span className="sutil">Ya conoces:</span>
          {(e.meta!.conocidos as { nombre: string; origen: string }[]).filter((c) => !e.valor.includes(c.nombre)).map((c) => (
            <span key={c.nombre} className="chip fijo">
              {c.nombre} <small>{c.origen}</small>
            </span>
          ))}
        </div>
      ) : null}
      <Control e={e} alCambiar={alCambiar} competentes={competentes} repetidos={repetidos} />
    </fieldset>
  )
}

function Control({ e, alCambiar, competentes, repetidos }: Props) {
  if (e.tipo === 'aumento') return <EditorAumento e={e} alCambiar={alCambiar} />
  if (e.tipo === 'pg') return <EditorPG e={e} alCambiar={alCambiar} />
  if (e.tipo === 'texto') return <p className="aviso-texto">{e.etiqueta}</p>
  if (!e.opciones.length) return <p className="sutil">No hay opciones disponibles todavía.</p>
  const muchas = e.opciones.length > 14
  if (e.n === 1 && !muchas) return <ListaUnica e={e} alCambiar={alCambiar} competentes={competentes} repetidos={repetidos} />
  return <ListaMultiple e={e} alCambiar={alCambiar} competentes={competentes} repetidos={repetidos} buscador={muchas} />
}

/** Conjuros que ya tiene por otra vía: no cuentan para el límite de esta elección. */
function ConjurosFijos({ fijos }: { fijos?: ConjuroFijo[] }) {
  if (!fijos?.length) return null
  return (
    <div className="conjuros-fijos">
      <span className="sutil">Ya los tienes (no cuentan para el límite):</span>
      {fijos.map((x) => (
        <button type="button" key={x.clave} className="chip fijo" onClick={() => abrirDetalle({ tipo: 'conjuro', clave: x.clave })} title={`${x.origen} · ${x.como}`}>
          {x.nombre} <small>{x.como} · {x.origen}</small>
        </button>
      ))}
    </div>
  )
}

function avisoOpcion(e: Eleccion, o: Opcion, competentes?: Set<string>, repetidos?: Set<string>): string | undefined {
  if (o.bloqueada && !e.valor.includes(o.valor)) return o.bloqueada
  if (e.tipo === 'habilidad' && competentes?.has(o.valor) && !e.valor.includes(o.valor)) return 'ya competente'
  if (e.tipo === 'pericia' && e.meta?.soloCompetentes && competentes && !competentes.has(o.valor)) return 'sin competencia'
  if (repetidos?.has(o.valor) && !e.valor.includes(o.valor)) return 'ya elegido'
  return undefined
}

function BotonInfo({ e, o }: { e: Eleccion; o: Opcion }) {
  const tipoDetalle = ['conjuro', 'trucos', 'preparados', 'libro'].includes(e.tipo) ? 'conjuro' : e.tipo === 'dote' ? 'dote' : e.tipo === 'plano' || e.tipo === 'maestria' ? 'objeto' : undefined
  if (!tipoDetalle) return null
  return (
    <button
      type="button"
      className="boton-icono info"
      aria-label={`Ver ${o.etiqueta}`}
      onClick={(ev) => {
        ev.stopPropagation()
        abrirDetalle({ tipo: tipoDetalle as 'conjuro', clave: o.valor })
      }}
    >
      ⓘ
    </button>
  )
}

function ListaUnica({ e, alCambiar, competentes, repetidos }: Props) {
  const datos = useEstado((s) => s.datos)
  const [verRasgos, setVerRasgos] = useState<string>()
  return (
    <div className="opciones-unica">
      {e.opciones.map((o) => {
        const aviso = avisoOpcion(e, o, competentes, repetidos)
        const sub = e.tipo === 'subclase' ? datos?.subclases.find((s) => s._clave === o.valor) : undefined
        return (
          <div key={o.valor} className={`opcion ${e.valor[0] === o.valor ? 'elegida' : ''}`}>
            <label>
              <input type="radio" name={e.id} checked={e.valor[0] === o.valor} disabled={!!o.bloqueada && e.valor[0] !== o.valor} onChange={() => alCambiar([o.valor])} />
              <span className="opcion-texto">
                <b>{o.etiqueta}</b>
                {aviso && <span className="insignia aviso">{aviso}</span>}
                {o.detalle && <small>{o.detalle}</small>}
              </span>
              <BotonInfo e={e} o={o} />
            </label>
            {sub && (
              <button type="button" className="enlace" onClick={() => setVerRasgos(verRasgos === o.valor ? undefined : o.valor)}>
                {verRasgos === o.valor ? 'Ocultar rasgos' : 'Ver rasgos de la subclase'}
              </button>
            )}
            {sub && verRasgos === o.valor && (
              <div className="rasgos-subclase">
                {sub.subclassFeatures.map((ref) => {
                  const r = Object.values(datos!.rasgos).find((x) => x._ref.startsWith(`sf|${ref.split('|')[0].toLowerCase()}|`) && x.subclassShortName === sub.shortName && x.subclassSource === sub.source)
                  return r ? (
                    <details key={ref}>
                      <summary>Nivel {r.level}: {r.name}</summary>
                      <Entradas entries={r.entries} />
                    </details>
                  ) : null
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ListaMultiple({ e, alCambiar, competentes, repetidos, buscador }: Props & { buscador: boolean }) {
  const [q, setQ] = useState('')
  const [soloElegidos, setSoloElegidos] = useState(false)
  const filtradas = useMemo(
    () => e.opciones.filter((o) => (!q || normalizar(o.etiqueta).includes(normalizar(q))) && (!soloElegidos || e.valor.includes(o.valor))),
    [e.opciones, e.valor, q, soloElegidos],
  )
  const grupos = useMemo(() => {
    const g = new Map<string, Opcion[]>()
    for (const o of filtradas) {
      const k = o.grupo ?? ''
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(o)
    }
    return [...g.entries()]
  }, [filtradas])
  const lleno = e.valor.length >= e.n
  const alternar = (v: string) => {
    if (e.n === 1) return alCambiar([v])
    if (e.valor.includes(v)) alCambiar(e.valor.filter((x) => x !== v))
    else if (!lleno) alCambiar([...e.valor, v])
  }
  return (
    <div className="opciones-multiple">
      {buscador && (
        <div className="fila">
          <Buscador valor={q} alCambiar={setQ} />
          <label className="interruptor"><input type="checkbox" checked={soloElegidos} onChange={(ev) => setSoloElegidos(ev.target.checked)} /> Solo elegidos</label>
        </div>
      )}
      {e.valor.length > 0 && (
        <div className="elegidos">
          {e.valor.map((v) => (
            <button type="button" key={v} className="chip" onClick={() => alternar(v)} title="Quitar">
              {e.opciones.find((o) => o.valor === v)?.etiqueta ?? v} ✕
            </button>
          ))}
        </div>
      )}
      <div className="lista-opciones">
        {grupos.map(([g, ops]) => (
          <div key={g}>
            {g && <h5 className="grupo-opciones">{g}</h5>}
            {ops.map((o) => {
              const marcado = e.valor.includes(o.valor)
              const aviso = avisoOpcion(e, o, competentes, repetidos)
              const off = !marcado && (!!o.bloqueada || (lleno && e.n > 1))
              return (
                <label key={o.valor} className={`opcion compacta ${marcado ? 'elegida' : ''} ${off ? 'deshabilitada' : ''}`}>
                  <input type={e.n === 1 ? 'radio' : 'checkbox'} name={e.id} checked={marcado} disabled={off} onChange={() => alternar(o.valor)} />
                  <span className="opcion-texto">
                    {o.etiqueta}
                    {aviso && <span className="insignia aviso">{aviso}</span>}
                    {o.detalle && <small>{o.detalle}</small>}
                  </span>
                  <BotonInfo e={e} o={o} />
                </label>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Aumentos de característica: +2/+1 o +1/+1/+1 (trasfondo), +2 o +1/+1 (ASI), +1 (dotes). */
function EditorAumento({ e, alCambiar }: Props) {
  const alternativas = (e.meta?.alternativas ?? []).filter((a: { pesos?: number[] }) => a.pesos) as { de: Caracteristica[]; pesos: number[] }[]
  const actual = e.valor.map((v) => v.split(':')).map(([c, n]) => ({ c: c as Caracteristica, n: Number(n) }))
  const altActual = Math.max(0, alternativas.findIndex((a) => [...a.pesos].sort().join() === actual.map((x) => x.n).sort().join()))
  const [alt, setAlt] = useState(altActual)
  const a = alternativas[alt]
  if (!a) return null
  // Se guardan todas las posiciones («str:2», «:1» si falta): el motor solo da por buena la elección completa
  const valorDe = (i: number) => (actual[i]?.n === a.pesos[i] ? actual[i].c : '')
  const fijar = (i: number, c: string) => alCambiar(a.pesos.map((p, j) => `${j === i ? c : valorDe(j)}:${p}`))
  return (
    <div className="aumentos">
      {alternativas.length > 1 && (
        <div className="fila-botones">
          {alternativas.map((x, i) => (
            <button
              type="button"
              key={i}
              className={`boton ${i === alt ? '' : 'secundario'}`}
              onClick={() => {
                setAlt(i)
                alCambiar([])
              }}
            >
              {x.pesos.map((p) => `+${p}`).join(' / ')}
            </button>
          ))}
        </div>
      )}
      <div className="fila">
        {a.pesos.map((p, i) => (
          <label key={i} className="campo-aumento">
            +{p}
            <select value={valorDe(i)} onChange={(ev) => fijar(i, ev.target.value)}>
              <option value="">—</option>
              {(a.de.length ? a.de : CARACTERISTICAS).map((c) => (
                <option key={c} value={c} disabled={actual.some((x, j) => j !== i && x.c === c)}>{ABREV[c]}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}

function EditorPG({ e, alCambiar }: Props) {
  const tirar = useEstado((s) => s.tirar)
  const dado = e.meta?.dado as number
  const media = e.meta?.media as number
  return (
    <div className="fila">
      <button type="button" className={`boton ${e.valor[0] === String(media) ? '' : 'secundario'}`} onClick={() => alCambiar([String(media)])}>
        Media: {media}
      </button>
      <button
        type="button"
        className="boton secundario"
        onClick={() => tirar({ etiqueta: `HP (d${dado})`, formula: `1d${dado}`, alTerminar: (r) => alCambiar([String(r.total)]) })}
      >
        Tirar d{dado}
      </button>
      {e.valor[0] && <span className="valor-pg">HP ganados: <b>{e.valor[0]}</b> (+ CON)</span>}
    </div>
  )
}
