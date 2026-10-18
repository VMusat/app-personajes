// Guía para aventureros de los Reinos de la Miasma: presentación pública del setting para inspirar a los jugadores.
// Se puede leer sin iniciar sesión. El texto es una nota de la bóveda de Obsidian
// (Lore/Guía para aventureros de los Reinos de la Miasma.md) que scripts/copiar-guia.mjs copia en src/setting/guia.md.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ir } from '../estado/store'
import { enLinea, leerBloques, type Bloque } from './guiaMarkdown'
import textoGuia from '../setting/guia.md?raw'

const BASE = import.meta.env.BASE_URL
const imagen = (archivo: string) => `${BASE}guia/${encodeURIComponent(archivo)}`

function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Ficha({ items }: { items: string[] }) {
  return (
    <dl className="guia-ficha">
      {items.map((it, i) => {
        const m = it.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/)
        return (
          <div key={i}>
            <dt>{m ? m[1].replace(/:$/, '') : ''}</dt>
            <dd>{enLinea(m ? m[2] : it)}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function pintar(bs: Bloque[], entradilla = false): ReactNode[] {
  const out: ReactNode[] = []
  let primeraEntradilla = entradilla
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i]
    const k = `${i}-${b.tipo}`
    switch (b.tipo) {
      case 'titulo': {
        const Etiqueta = (`h${Math.min(b.nivel, 4)}` as 'h2')
        out.push(<Etiqueta key={k} id={b.id}>{enLinea(b.texto)}</Etiqueta>)
        break
      }
      case 'parrafo':
        out.push(<p key={k} className={primeraEntradilla ? 'guia-entradilla' : undefined}>{enLinea(b.texto)}</p>)
        primeraEntradilla = false
        break
      case 'lista': {
        const items = b.items.map((it, j) => <li key={j}>{enLinea(it)}</li>)
        out.push(b.ordenada ? <ol key={k} className="guia-lista">{items}</ol> : <ul key={k} className="guia-lista">{items}</ul>)
        break
      }
      case 'tabla':
        out.push(
          <div key={k} className="guia-tabla-scroll">
            <table className="guia-tabla">
              <thead><tr>{b.cabecera.map((c, j) => <th key={j}>{enLinea(c)}</th>)}</tr></thead>
              <tbody>{b.filas.map((f, j) => <tr key={j}>{f.map((c, n) => <td key={n}>{enLinea(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>,
        )
        break
      case 'cita':
        out.push(<blockquote key={k} className="guia-lema">{enLinea(b.texto)}</blockquote>)
        break
      case 'imagen':
        out.push(
          <figure key={k} className="guia-figura">
            <a href={imagen(b.archivo)} target="_blank" rel="noreferrer" title="Abrir a tamaño completo">
              <img src={imagen(b.archivo)} alt={b.pie ?? b.archivo} loading="lazy" />
            </a>
            {b.pie && <figcaption>{enLinea(b.pie)}</figcaption>}
          </figure>,
        )
        break
      case 'separador':
        out.push(<hr key={k} />)
        break
      case 'callout': {
        if (b.clase === 'distrito') {
          // Los distritos seguidos se agrupan en una rejilla
          const grupo: Bloque[] = []
          while (i < bs.length && bs[i].tipo === 'callout' && (bs[i] as { clase: string }).clase === 'distrito') grupo.push(bs[i++])
          i--
          out.push(
            <div key={k} className="guia-distritos">
              {grupo.map((d, j) => {
                if (d.tipo !== 'callout') return null
                const [color = 'var(--borde)', simbolo] = d.meta
                return (
                  <article key={j} className="guia-distrito" style={{ borderTopColor: color }}>
                    <h4>
                      {enLinea(d.titulo)}
                      {simbolo && <span className="guia-recinto" style={{ background: color }}>{simbolo}</span>}
                    </h4>
                    {pintar(d.hijos)}
                  </article>
                )
              })}
            </div>,
          )
        } else if (b.clase === 'ficha') {
          const lista = b.hijos.find((h) => h.tipo === 'lista')
          out.push(<Ficha key={k} items={lista?.tipo === 'lista' ? lista.items : []} />)
        } else if (b.clase === 'pie') {
          out.push(
            <footer key={k} className="guia-pie">
              {pintar(b.hijos)}
              <button className="boton" onClick={() => ir({ tipo: 'inicio' })}>Crear mi personaje</button>
            </footer>,
          )
        } else {
          const rumor = b.clase === 'rumor'
          const titulo = b.titulo || (rumor ? 'Se cuenta en las tabernas' : b.clase === 'consejo' ? 'Consejo del guía' : b.clase)
          out.push(
            <aside key={k} className={rumor ? 'guia-rumor' : 'guia-consejo'}>
              <span className="guia-rumor-titulo">{rumor ? '🗝' : '☞'} {titulo}</span>
              {pintar(b.hijos)}
            </aside>,
          )
        }
        break
      }
    }
  }
  return out
}

export function Guia() {
  const [indiceAbierto, setIndiceAbierto] = useState(false)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const { edicion, titulo, lema, cuerpo, indice } = useMemo(() => {
    const bs = leerBloques(textoGuia)
    const h1 = bs.findIndex((b) => b.tipo === 'titulo' && b.nivel === 1)
    const antes = h1 >= 0 ? bs.slice(0, h1) : []
    const t = h1 >= 0 ? bs[h1] : undefined
    let resto = h1 >= 0 ? bs.slice(h1 + 1) : bs
    let lema: Bloque | undefined
    if (resto[0]?.tipo === 'cita') [lema, ...resto] = resto
    const indice: { id: string; texto: string; sub: { id: string; texto: string }[] }[] = []
    for (const b of resto) {
      if (b.tipo !== 'titulo') continue
      if (b.nivel === 2) indice.push({ id: b.id, texto: b.texto, sub: [] })
      else if (b.nivel === 3 && indice.length) indice[indice.length - 1].sub.push({ id: b.id, texto: b.texto })
    }
    return { edicion: antes, titulo: t?.tipo === 'titulo' ? t.texto : 'Guía', lema, cuerpo: resto, indice }
  }, [])

  // Títulos del índice sin la coletilla entre paréntesis ni lo que va tras los dos puntos
  const corto = (s: string) => s.replace(/\s*\(.*\)\s*/, '').replace(/[:,].*$/, '')

  const nav = (
    <nav className="guia-indice" aria-label="Índice de la guía">
      <p className="guia-indice-titulo">Índice</p>
      <ol>
        <li><button onClick={() => { irA('guia-portada'); setIndiceAbierto(false) }}>Bienvenida</button></li>
        {indice.map((s) => (
          <li key={s.id}>
            <button onClick={() => { irA(s.id); setIndiceAbierto(false) }}>{corto(s.texto)}</button>
            {s.sub.length > 0 && (
              <ol>
                {s.sub.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => { irA(x.id); setIndiceAbierto(false) }}>{corto(x.texto)}</button>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )

  return (
    <div className="guia">
      <div className="guia-barra">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>← Volver a la app</button>
        <button className="boton secundario guia-boton-indice" onClick={() => setIndiceAbierto((v) => !v)}>☰ Índice</button>
      </div>
      {indiceAbierto && <div className="guia-indice-movil">{nav}</div>}

      <div className="guia-cuerpo">
        <div className="guia-lateral">{nav}</div>
        <article className="guia-texto">
          <header className="guia-portada" id="guia-portada">
            {edicion.map((b, i) => b.tipo === 'parrafo' && <p key={i} className="guia-edicion">{enLinea(b.texto)}</p>)}
            <h1>{enLinea(titulo)}</h1>
            {lema?.tipo === 'cita' && <p className="guia-lema">{enLinea(lema.texto)}</p>}
          </header>
          {pintar(cuerpo, true)}
        </article>
      </div>
    </div>
  )
}
