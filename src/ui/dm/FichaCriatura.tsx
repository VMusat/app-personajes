// Ficha de una criatura (bloque de estadísticas). En el Bestiario solo se lee; en la Pantalla del DM
// lleva además el estado de la criatura en el escenario: usos por día, recargas, acciones legendarias, guarida y dominio.
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useEstado } from '../../estado/store'
import { CARACTERISTICAS } from '../../datos/tipos'
import { modificador } from '../../motor/personaje'
import { ABREV, conSigno } from '../glosario'
import { formulaD20, formulaValida } from '../../dados/tiradas'
import {
  claveEntrada, coste, recarga, SECCIONES_ENTRADAS, sinEnlaces, sinergiaActiva, usosPorDia, type Criatura, type Entrada,
} from '../../almacen/criaturas'
import type { CriaturaEscenario } from '../../almacen/pantalla'

/** Catálogo de criaturas del DM, en vivo. */
export function useCriaturas(): [Criatura[], string | undefined] {
  const repo = useEstado((s) => s.repo)
  const [lista, setLista] = useState<Criatura[]>([])
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!repo) return
    return repo.criaturas((cs) => setLista([...cs].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))), (e) => setError(e.message))
  }, [repo])
  return [lista, error]
}

const tirar = (etiqueta: string, formula: string, d20 = false) => {
  const f = formula.replace(/[−–]/g, '-').replace(/\s+/g, '')
  if (formulaValida(f)) useEstado.getState().tirar({ etiqueta, formula: f, d20 })
}

/** Texto de una entrada con las fórmulas de dados y los bonos de ataque pulsables. */
export function TextoConDados({ texto, etiqueta }: { texto: string; etiqueta: string }): ReactNode {
  const piezas = sinEnlaces(texto).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return piezas.map((p, i) => {
    if (/^\*\*.+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>
    if (/^\*[^*]+\*$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>
    const trozos = p.split(/(\d+d\d+(?:\s*[+−–-]\s*\d+)?|[+−-]\d+(?=\s*(?:,|para impactar|to hit|\)))|(?:(?<=(?:Roll|ataque|impactar):\s*))[+−-]\d+)/gi)
    return (
      <Fragment key={i}>
        {trozos.map((t, j) => {
          if (!t) return null
          if (/^\d+d\d+/.test(t))
            return <button key={j} className="dado-texto" title={`Tirar ${t}`} onClick={() => tirar(`${etiqueta} · daño`, t)}>{t}</button>
          if (/^[+−-]\d+$/.test(t))
            return <button key={j} className="dado-texto" title="Tirar el ataque" onClick={() => tirar(`${etiqueta} · ataque`, formulaD20(Number(t.replace('−', '-'))), true)}>{t}</button>
          return <Fragment key={j}>{t}</Fragment>
        })}
      </Fragment>
    )
  })
}

export interface EstadoEscena {
  cr: CriaturaEscenario
  cambiar: (f: (c: CriaturaEscenario) => void) => void
  /** Nombres de las demás criaturas y PJs de la escena (para las sinergias). */
  presentes: string[]
}

function Pips({ total, usados, alCambiar, titulo }: { total: number; usados: number; alCambiar?: (n: number) => void; titulo: string }) {
  return (
    <span className="pips" title={titulo}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          className={`pip ${i < usados ? 'gastado' : ''}`}
          disabled={!alCambiar}
          onClick={() => alCambiar?.(i < usados ? i : i + 1)}
          aria-label={`${titulo}: ${i + 1}`}
        />
      ))}
    </span>
  )
}

function EntradaFicha({ e, seccion, c, escena }: { e: Entrada; seccion: string; c: Criatura; escena?: EstadoEscena }) {
  const dia = usosPorDia(e.nombre)
  const rec = recarga(e.nombre)
  const clave = claveEntrada(seccion, e)
  const gastada = escena?.cr.gastadas?.includes(clave)
  const usados = escena?.cr.usos?.[clave] ?? 0
  const leg = seccion === 'legendarias'
  const legTotal = escena ? (escena.cr.enGuarida ? c.legendarias?.usosGuarida ?? c.legendarias?.usos : c.legendarias?.usos) ?? 0 : 0
  const legUsadas = escena?.cr.legendariasUsadas ?? 0
  return (
    <div className={`entrada-ficha ${gastada ? 'gastada' : ''}`}>
      <b className="entrada-nombre">{sinEnlaces(e.nombre)}.</b>{' '}
      <TextoConDados texto={e.texto} etiqueta={`${escena?.cr.nombre ?? c.nombre} · ${e.nombre.replace(/\s*\(.*$/, '')}`} />
      {escena && (dia || rec || leg) && (
        <span className="entrada-estado">
          {dia && <Pips total={dia} usados={usados} titulo="Usos por día" alCambiar={(n) => escena.cambiar((x) => void (x.usos = { ...x.usos, [clave]: n }))} />}
          {rec && (
            <button
              className={`chip ${gastada ? 'condicion' : 'exito'}`}
              title={gastada ? `Gastada: se recarga con ${rec}-6 al empezar su turno` : 'Disponible: púlsalo al usarla'}
              onClick={() => escena.cambiar((x) => void (x.gastadas = gastada ? (x.gastadas ?? []).filter((k) => k !== clave) : [...(x.gastadas ?? []), clave]))}
            >
              {gastada ? `⌛ Recarga ${rec}-6` : '⚡ Disponible'}
            </button>
          )}
          {leg && (
            <button
              className="chip"
              disabled={legUsadas + coste(e.nombre) > legTotal}
              onClick={() => escena.cambiar((x) => void (x.legendariasUsadas = (x.legendariasUsadas ?? 0) + coste(e.nombre)))}
            >
              Usar ({coste(e.nombre)})
            </button>
          )}
        </span>
      )}
    </div>
  )
}

export function FichaCriatura({ c, escena }: { c: Criatura; escena?: EstadoEscena }) {
  const nombre = escena?.cr.nombre ?? c.nombre
  const linea = (k: string, v?: string) => v && <div className="linea-ficha"><b>{k}</b> {v}</div>
  const legTotal = escena?.cr.enGuarida ? c.legendarias?.usosGuarida ?? c.legendarias?.usos : c.legendarias?.usos
  return (
    <div className="ficha-criatura">
      {(c.tipo || c.resumen) && (
        <p className="sutil">
          {c.tipo && <i>{c.tipo}</i>}
          {c.resumen && <><br />{sinEnlaces(c.resumen)}</>}
        </p>
      )}
      <div className="datos-mesa grandes">
        <span>AC <b>{c.ca}</b>{c.caTexto && <span className="sutil"> ({c.caTexto})</span>}</span>
        <span>
          PG <b>{escena ? `${escena.cr.pg}/${c.pgMax}` : c.pgMax}</b>
          {c.pgFormula && <button className="dado-texto" onClick={() => tirar(`${nombre} · PG`, c.pgFormula!)}>{c.pgFormula}</button>}
        </span>
        <span>Iniciativa <button className="dado-texto" onClick={() => tirar(`${nombre} · iniciativa`, formulaD20(c.bonoIniciativa), true)}>{conSigno(c.bonoIniciativa)}</button></span>
        {c.velocidad && <span>Speed <b>{c.velocidad}</b></span>}
      </div>
      {c.caracteristicas && Object.keys(c.caracteristicas).length > 0 && (
        <div className="caracteristicas-criatura">
          {CARACTERISTICAS.map((k) => {
            const v = c.caracteristicas?.[k]
            return v === undefined ? null : (
              <button key={k} title={`Prueba de ${ABREV[k]}`} onClick={() => tirar(`${nombre} · ${ABREV[k]}`, formulaD20(modificador(v)), true)}>
                <span>{ABREV[k]}</span><b>{v}</b><span>{conSigno(modificador(v))}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="lineas-ficha">
        {linea('Saving Throws', c.salvaciones)}
        {linea('Skills', c.habilidades)}
        {linea('Vulnerabilities', c.vulnerabilidades)}
        {linea('Resistances', c.resistencias)}
        {linea('Immunities', c.inmunidades)}
        {linea('Senses', [c.sentidos, c.percepcionPasiva !== undefined && !/pasiva|passive/i.test(c.sentidos ?? '') ? `Percepción pasiva ${c.percepcionPasiva}` : ''].filter(Boolean).join('; '))}
        {linea('Languages', c.lenguas)}
        {linea('Gear', c.equipo)}
        {c.vd && linea('CR', `${c.vd}${c.xp || c.bc ? ` (${[c.xp && `XP ${c.xp}`, c.bc && `PB +${c.bc}`].filter(Boolean).join('; ')})` : ''}`)}
        {(c.tramo || c.habitat) && linea('Campaña', [c.tramo && `tramo ${c.tramo}`, c.habitat].filter(Boolean).join(' · '))}
      </div>
      {SECCIONES_ENTRADAS.map((s) =>
        c[s.clave]?.length ? (
          <section key={s.clave} className="seccion-ficha">
            <h4>{s.titulo}</h4>
            {c[s.clave]!.map((e, i) => <EntradaFicha key={i} e={e} seccion={s.clave} c={c} escena={escena} />)}
          </section>
        ) : null,
      )}
      {c.legendarias && (
        <section className="seccion-ficha legendaria">
          <h4>
            Acciones legendarias{' '}
            {escena && legTotal ? (
              <Pips total={legTotal} usados={escena.cr.legendariasUsadas ?? 0} titulo="Acciones legendarias gastadas (se recuperan al empezar su turno)" alCambiar={(n) => escena.cambiar((x) => void (x.legendariasUsadas = n))} />
            ) : (
              <span className="sutil">({c.legendarias.usos}{c.legendarias.usosGuarida ? `; ${c.legendarias.usosGuarida} en su guarida` : ''} por ronda)</span>
            )}
          </h4>
          {c.legendarias.texto && <p className="sutil">{sinEnlaces(c.legendarias.texto)}</p>}
          {c.legendarias.acciones.map((e, i) => <EntradaFicha key={i} e={e} seccion="legendarias" c={c} escena={escena} />)}
        </section>
      )}
      {c.guarida && (
        <section className={`seccion-ficha guarida ${escena && !escena.cr.enGuarida ? 'apagada' : ''}`}>
          <h4>
            Guarida
            {escena && (
              <label className="interruptor"><input type="checkbox" checked={!!escena.cr.enGuarida} onChange={(e) => escena.cambiar((x) => void (x.enGuarida = e.target.checked))} /> Lucha en su guarida</label>
            )}
          </h4>
          {c.guarida.texto && <p className="sutil">{sinEnlaces(c.guarida.texto)}</p>}
          {c.guarida.acciones.length > 0 && !/20/.test(c.guarida.texto ?? '') && <p className="sutil">Acciones de guarida: en la iniciativa 20 (pierde los empates), una por ronda.</p>}
          {c.guarida.acciones.map((e, i) => <EntradaFicha key={i} e={e} seccion="guarida" c={c} />)}
          {c.guarida.efectos.length > 0 && <h5>Efectos regionales</h5>}
          {c.guarida.efectos.map((e, i) => <EntradaFicha key={i} e={e} seccion="regional" c={c} />)}
        </section>
      )}
      {c.dominio?.length ? (
        <section className={`seccion-ficha dominio ${escena?.cr.dominioRoto ? 'apagada' : ''}`}>
          <h4>
            Dominio
            {escena && (
              <label className="interruptor"><input type="checkbox" checked={!!escena.cr.dominioRoto} onChange={(e) => escena.cambiar((x) => void (x.dominioRoto = e.target.checked))} /> Roto</label>
            )}
          </h4>
          {c.dominio.map((e, i) => <EntradaFicha key={i} e={e} seccion="dominio" c={c} />)}
        </section>
      ) : null}
      {c.sinergias?.length ? (
        <section className="seccion-ficha sinergias">
          <h4>Sinergias</h4>
          {c.sinergias.map((e, i) => (
            <div key={i} className={escena && sinergiaActiva(e, escena.presentes) ? 'sinergia-activa' : ''}>
              {escena && sinergiaActiva(e, escena.presentes) && <span className="chip concentracion">⚡ Activa</span>}
              <EntradaFicha e={e} seccion="sinergia" c={c} />
            </div>
          ))}
        </section>
      ) : null}
      {c.tacticas && (
        <section className="seccion-ficha">
          <h4>Tácticas</h4>
          <ul>{c.tacticas.split('\n').map((t, i) => <li key={i}><TextoConDados texto={t} etiqueta={nombre} /></li>)}</ul>
        </section>
      )}
      {c.texto && (
        <section className="seccion-ficha">
          <h4>Notas</h4>
          {c.texto.split(/\n{2,}/).map((p, i) => <p key={i}><TextoConDados texto={p} etiqueta={nombre} /></p>)}
        </section>
      )}
    </div>
  )
}
