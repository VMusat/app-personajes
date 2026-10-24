// Ventana de detalle de conjuros, objetos, dotes y condiciones (al pulsar un enlace del texto).
import type { ReactNode } from 'react'
import { create } from 'zustand'
import { useEstado } from '../estado/store'
import type { Conjuro, Crudo } from '../datos/tipos'
import { Entradas } from './Entradas'
import { ESCUELAS, NIVEL_CONJURO, TERMINOS_CONJURO, titulo } from './glosario'
import { Modal } from './comun'

type Peticion = { tipo: 'conjuro' | 'objeto' | 'dote' | 'condicion' | 'maestria'; clave: string }

const useDetalle = create<{ p?: Peticion; set: (p?: Peticion) => void }>((set) => ({ set: (p) => set({ p }) }))
export const abrirDetalle = (p: Peticion) => useDetalle.getState().set(p)

export function tiempoConjuro(c: Crudo): string {
  return (c.time as Crudo[])?.map((t) => `${t.number} ${t.unit === 'bonus' ? 'Bonus Action' : t.unit === 'reaction' ? 'Reaction' : titulo(t.unit)}`).join(' / ') ?? ''
}

export function alcanceConjuro(c: Crudo): string {
  const r = c.range
  if (!r) return ''
  if (r.type === 'point') {
    const d = r.distance
    if (d.type === 'self') return 'Self'
    if (d.type === 'touch') return 'Touch'
    if (d.type === 'sight') return 'Sight'
    if (d.type === 'unlimited') return 'Unlimited'
    return `${d.amount} ${d.type === 'feet' ? 'ft' : d.type === 'miles' ? 'miles' : d.type}`
  }
  const d = r.distance
  return `Self (${d?.amount ?? ''}-${d?.type === 'feet' ? 'ft' : d?.type ?? ''} ${r.type})`
}

export function componentesConjuro(c: Crudo): string {
  const k = c.components ?? {}
  const partes = [k.v && 'V', k.s && 'S', k.m && `M (${typeof k.m === 'string' ? k.m : k.m.text})`].filter(Boolean)
  return partes.join(', ')
}

/** Etiqueta con explicación al pasar el ratón o al tocarla (V, S, M, Ritual, Concentration). */
export function Termino({ t, children }: { t: keyof typeof TERMINOS_CONJURO; children?: ReactNode }) {
  const x = TERMINOS_CONJURO[t]
  return (
    <span className="termino" tabIndex={0} data-tip={x.texto} aria-label={x.texto}>
      {children ?? t}
    </span>
  )
}

/** Componentes con explicación: «V, S, M (una pluma)». */
export function Componentes({ c }: { c: Crudo }) {
  const k = c.components ?? {}
  const partes: ReactNode[] = []
  if (k.v) partes.push(<Termino key="v" t="V" />)
  if (k.s) partes.push(<Termino key="s" t="S" />)
  if (k.m) partes.push(<span key="m"><Termino t="M" /> ({typeof k.m === 'string' ? k.m : k.m.text})</span>)
  return <>{partes.flatMap((x, i) => (i ? [', ', x] : [x]))}</>
}

export function duracionConjuro(c: Crudo): string {
  return (c.duration as Crudo[])
    ?.map((d) => {
      if (d.type === 'instant') return 'Instantaneous'
      if (d.type === 'permanent') return 'Until dispelled'
      if (d.type === 'special') return 'Special'
      const t = d.duration
      return `${d.concentration ? 'Concentration, up to ' : ''}${t.amount} ${t.type}${t.amount > 1 ? 's' : ''}`
    })
    .join(' / ') ?? ''
}

export function FichaConjuro({ c }: { c: Conjuro }) {
  return (
    <div className="ficha-conjuro">
      <p className="sutil">
        {NIVEL_CONJURO(c.level).replace('Cantrips', 'Cantrip')} · {ESCUELAS[c.school] ?? c.school}
        {c.meta?.ritual && <> · <Termino t="R">Ritual</Termino></>}
      </p>
      <dl className="datos-conjuro">
        <dt>Casting Time</dt><dd>{tiempoConjuro(c)}</dd>
        <dt>Range</dt><dd>{alcanceConjuro(c)}</dd>
        <dt>Components</dt><dd><Componentes c={c} /></dd>
        <dt>Duration</dt><dd>{duracionConjuro(c).startsWith('Concentration') ? <><Termino t="C">Concentration</Termino>{duracionConjuro(c).slice('Concentration'.length)}</> : duracionConjuro(c)}</dd>
      </dl>
      {c._setting && <p className="setting-conjuro">{c._nombre !== c.name && <b>{c._nombre}. </b>}{c._setting}</p>}
      <Entradas entries={c.entries} />
      {c.entriesHigherLevel && <Entradas entries={c.entriesHigherLevel} />}
      <p className="sutil">Clases: {c._clases.join(', ') || '—'} · {c.source}{c.source === 'AU' && <span className="insignia au">AU</span>}</p>
    </div>
  )
}

export function FichaObjeto({ o }: { o: Crudo }) {
  return (
    <div>
      <p className="sutil">
        {[o.rarity && o.rarity !== 'none' ? titulo(o.rarity) : '', o.reqAttune ? `requires attunement${typeof o.reqAttune === 'string' ? ` ${o.reqAttune}` : ''}` : '', o.weight ? `${o.weight} lb` : '', o.value ? `${o.value / 100} GP` : '']
          .filter(Boolean)
          .join(' · ')}
      </p>
      {o.ac && <p>AC {o.ac}{o.bonusAc ? ` (${o.bonusAc})` : ''}</p>}
      {o.dmg1 && <p>Damage {o.dmg1}{o.dmg2 ? ` (versatile ${o.dmg2})` : ''} {o.dmgType}</p>}
      <Entradas entries={o.entries} />
    </div>
  )
}

export function Detalle() {
  const { p, set } = useDetalle()
  const datos = useEstado((s) => s.datos)
  if (!p || !datos) return null
  let titulo_ = ''
  let cuerpo = null
  if (p.tipo === 'conjuro') {
    const c = datos.conjuros.find((x) => x._clave === p.clave)
    titulo_ = c?.name ?? p.clave
    cuerpo = c ? <FichaConjuro c={c} /> : <p>No encontrado.</p>
  } else if (p.tipo === 'objeto') {
    const o = datos.objetos.find((x) => x._clave === p.clave)
    titulo_ = o?.name ?? p.clave
    cuerpo = o ? <FichaObjeto o={o} /> : <p>No encontrado.</p>
  } else if (p.tipo === 'dote') {
    const f = datos.dotes.find((x) => x._clave === p.clave)
    titulo_ = f?._nombre ?? p.clave
    cuerpo = f ? <Entradas entries={f.entries} /> : <p>No encontrada.</p>
  } else if (p.tipo === 'maestria') {
    const m = datos.maestrias.find((x) => x._clave === p.clave)
    titulo_ = m ? `Mastery: ${m.name}` : p.clave
    cuerpo = m ? <Entradas entries={m.entries} /> : <p>No encontrada.</p>
  } else {
    const c = datos.condiciones.find((x) => x._clave === p.clave || x.name.toLowerCase() === p.clave.split('|')[0])
    titulo_ = c?.name ?? p.clave
    cuerpo = c ? <Entradas entries={c.entries} /> : <p>No encontrada.</p>
  }
  return (
    <Modal titulo={titulo_} alCerrar={() => set(undefined)}>
      {cuerpo}
    </Modal>
  )
}
