// Renderiza el texto de 5etools (entries) con sus etiquetas {@spell ...}, {@dice ...}, tablas y listas.
import { Fragment, type ReactNode } from 'react'
import { useEstado } from '../estado/store'
import { claveDeRef, claveRasgoClase, claveRasgoSubclase } from '../datos/refs'
import type { Crudo } from '../datos/tipos'
import { abrirDetalle } from './Detalle'

/** Parte un texto en trozos de texto y etiquetas {@tag contenido}, respetando anidamiento. */
function trocear(s: string): (string | { tag: string; cont: string })[] {
  const res: (string | { tag: string; cont: string })[] = []
  let i = 0
  let buf = ''
  while (i < s.length) {
    if (s[i] === '{' && s[i + 1] === '@') {
      let prof = 0
      let j = i
      for (; j < s.length; j++) {
        if (s[j] === '{') prof++
        else if (s[j] === '}') {
          prof--
          if (prof === 0) break
        }
      }
      const dentro = s.slice(i + 2, j)
      const esp = dentro.indexOf(' ')
      if (buf) res.push(buf), (buf = '')
      res.push({ tag: esp < 0 ? dentro : dentro.slice(0, esp), cont: esp < 0 ? '' : dentro.slice(esp + 1) })
      i = j + 1
    } else buf += s[i++]
  }
  if (buf) res.push(buf)
  return res
}

/** Texto visible de una etiqueta: «nombre|fuente|texto» → texto, o nombre. */
export function textoEtiqueta(tag: string, cont: string): string {
  const p = cont.split('|')
  if (tag === 'filter') return p[0]
  if (tag === 'dc') return `DC ${p[0]}`
  if (tag === 'hit') return p[0].startsWith('-') ? p[0] : `+${p[0].replace('+', '')}`
  if (tag === 'scaledamage') return p[2] ?? p[0]
  return p[2] || p[0]
}

export function TextoEnLinea({ texto, personaje }: { texto: string; personaje?: string }) {
  const tirar = useEstado((s) => s.tirar)
  return (
    <>
      {trocear(texto).map((t, i) => {
        if (typeof t === 'string') return <Fragment key={i}>{t}</Fragment>
        const { tag, cont } = t
        const visible = textoEtiqueta(tag, cont)
        switch (tag) {
          case 'b':
          case 'bold':
            return <b key={i}><TextoEnLinea texto={cont} personaje={personaje} /></b>
          case 'i':
          case 'italic':
            return <i key={i}><TextoEnLinea texto={cont} personaje={personaje} /></i>
          case 'dice':
          case 'damage':
          case 'scaledamage': {
            const f = (tag === 'scaledamage' ? cont.split('|')[2] : cont.split('|')[0]).replace(/\s/g, '')
            return (
              <button key={i} className="enlace-dado" onClick={() => tirar({ etiqueta: visible, formula: f, personaje })}>
                {visible}
              </button>
            )
          }
          case 'd20':
          case 'hit': {
            const n = parseInt(cont, 10) || 0
            return (
              <button key={i} className="enlace-dado" onClick={() => tirar({ etiqueta: visible, formula: `1d20${n >= 0 ? '+' : ''}${n}`, d20: true, personaje })}>
                {visible}
              </button>
            )
          }
          case 'spell':
            return (
              <button key={i} className="enlace" onClick={() => abrirDetalle({ tipo: 'conjuro', clave: claveDeRef(cont) })}>
                {visible}
              </button>
            )
          case 'item':
            return (
              <button key={i} className="enlace" onClick={() => abrirDetalle({ tipo: 'objeto', clave: claveDeRef(cont) })}>
                {visible}
              </button>
            )
          case 'feat':
            return (
              <button key={i} className="enlace" onClick={() => abrirDetalle({ tipo: 'dote', clave: claveDeRef(cont) })}>
                {visible}
              </button>
            )
          case 'condition':
          case 'status':
            return (
              <button key={i} className="enlace" onClick={() => abrirDetalle({ tipo: 'condicion', clave: claveDeRef(cont) })}>
                {visible}
              </button>
            )
          default:
            return <span key={i} className="etiqueta-5e">{visible}</span>
        }
      })}
    </>
  )
}

export function Entradas({ entries, personaje, nivel = 0 }: { entries: unknown; personaje?: string; nivel?: number }): ReactNode {
  const datos = useEstado((s) => s.datos)
  if (entries === undefined || entries === null) return null
  if (typeof entries === 'string') return <p><TextoEnLinea texto={entries} personaje={personaje} /></p>
  if (Array.isArray(entries)) return <>{entries.map((e, i) => <Entradas key={i} entries={e} personaje={personaje} nivel={nivel} />)}</>
  const e = entries as Crudo
  switch (e.type) {
    case 'list':
      return (
        <ul className={e.style?.includes('hang') ? 'lista-colgante' : ''}>
          {(e.items as unknown[]).map((it, i) => (
            <li key={i}>
              {typeof it === 'string' ? <TextoEnLinea texto={it} personaje={personaje} /> : <Entradas entries={it} personaje={personaje} nivel={nivel + 1} />}
            </li>
          ))}
        </ul>
      )
    case 'item':
    case 'itemSub':
      return (
        <div className="item-5e">
          {e.name && <b>{e.name} </b>}
          {e.entry ? <TextoEnLinea texto={e.entry} personaje={personaje} /> : <Entradas entries={e.entries} personaje={personaje} nivel={nivel + 1} />}
        </div>
      )
    case 'table':
      return (
        <div className="tabla-envoltorio">
          <table className="tabla-5e">
            {e.caption && <caption>{e.caption}</caption>}
            {e.colLabels && (
              <thead>
                <tr>{(e.colLabels as string[]).map((c, i) => <th key={i}><TextoEnLinea texto={c} /></th>)}</tr>
              </thead>
            )}
            <tbody>
              {(e.rows as unknown[][]).map((fila, i) => (
                <tr key={i}>
                  {(Array.isArray(fila) ? fila : ((fila as Crudo).row as unknown[])).map((celda, j) => (
                    <td key={j}>
                      {typeof celda === 'string' || typeof celda === 'number' ? <TextoEnLinea texto={String(celda)} personaje={personaje} /> : <Entradas entries={celda} personaje={personaje} nivel={nivel + 1} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'refClassFeature':
    case 'refSubclassFeature': {
      const r = datos?.rasgos[e.type === 'refClassFeature' ? claveRasgoClase(e.classFeature) : claveRasgoSubclase(e.subclassFeature)]
      if (!r) return null
      return (
        <div className="bloque-5e">
          <h5>{r.name}</h5>
          <Entradas entries={r.entries} personaje={personaje} nivel={nivel + 1} />
        </div>
      )
    }
    case 'refOptionalfeature': {
      const o = datos?.opcionales.find((x) => x._clave === claveDeRef(e.optionalfeature))
      return o ? <div className="item-5e"><b>{o.name}. </b><span className="sutil">(ver opciones)</span></div> : null
    }
    case 'refFeat': {
      const f = datos?.dotes.find((x) => x._clave === claveDeRef(e.feat))
      return f ? <div className="bloque-5e"><h5>{f.name}</h5><Entradas entries={f.entries} personaje={personaje} nivel={nivel + 1} /></div> : null
    }
    case 'options':
      return <div className="opciones-5e"><Entradas entries={e.entries} personaje={personaje} nivel={nivel + 1} /></div>
    case 'inset':
    case 'insetReadaloud':
      return (
        <aside className="inserto-5e">
          {e.name && <h5>{e.name}</h5>}
          <Entradas entries={e.entries} personaje={personaje} nivel={nivel + 1} />
        </aside>
      )
    case 'quote':
      return <blockquote><Entradas entries={e.entries} personaje={personaje} /></blockquote>
    case 'abilityDc':
      return <p className="centrado"><b>{e.name} save DC</b> = 8 + PB + {(e.attributes as string[]).map((a) => a.toUpperCase()).join('/')} modifier</p>
    case 'abilityAttackMod':
      return <p className="centrado"><b>{e.name} attack modifier</b> = PB + {(e.attributes as string[]).map((a) => a.toUpperCase()).join('/')} modifier</p>
    case 'inline':
    case 'inlineBlock':
      return <span><Entradas entries={e.entries} personaje={personaje} nivel={nivel} /></span>
    case 'link':
      return <span>{e.text}</span>
    case 'image':
    case 'gallery':
    case 'hr':
      return null
    default:
      if (e.entries) {
        const H = nivel === 0 ? 'h4' : 'h5'
        return (
          <div className="bloque-5e">
            {e.name && <H>{e.name}</H>}
            <Entradas entries={e.entries} personaje={personaje} nivel={nivel + 1} />
          </div>
        )
      }
      return null
  }
}
