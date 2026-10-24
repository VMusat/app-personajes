// Asistente de creación de personaje a nivel 1.
import { useMemo, useState } from 'react'
import { esAU } from '../../datos/fuentes'
import { ir, useEstado } from '../../estado/store'
import { usePersonaje } from '../usePersonaje'
import { resolver, resumenEquipo, tamañosEspecie, type Eleccion } from '../../motor/resolver'
import { derivar, type Hoja } from '../../motor/derivar'
import { abrirDetalle } from '../Detalle'
import { CONJUNTO_ESTANDAR, COSTE_COMPRA, PUNTOS_COMPRA, costeCompra, modificador, nuevoId, sumar4d6, type Personaje } from '../../motor/personaje'
import { ASPECTOS } from '../../setting/marcas'
import { CARACTERISTICAS, type Caracteristica, type Crudo, type Datos } from '../../datos/tipos'
import { claveDeRef } from '../../datos/refs'
import { ABREV, NOMBRE_CAR, conSigno } from '../glosario'
import { Buscador, normalizar } from '../comun'
import { Entradas } from '../Entradas'
import { EditorEleccion } from './EditorEleccion'
import { BorrarPersonaje } from '../Inicio'
import { aplicarEquipo } from '../equipo'

const PASOS = ['Concepto', 'Clase', 'Especie', 'Trasfondo', 'Características', 'Elecciones', 'Equipo', 'Resumen'] as const
type Paso = (typeof PASOS)[number]

export function Creador({ id }: { id: string }) {
  const [p, actualizar, guardando] = usePersonaje(id)
  const datos = useEstado((s) => s.datos)!
  const [paso, setPaso] = useState<Paso>('Concepto')
  const [borrar, setBorrar] = useState(false)
  const res = useMemo(() => (p ? resolver(p, datos) : undefined), [p, datos])
  if (!p || !res) return <p className="pantalla-centro">Personaje no encontrado.</p>

  const fijarEleccion = (eid: string, v: string[]) => actualizar((x) => void (x.elecciones[eid] = v))
  const i = PASOS.indexOf(paso)
  const listo: Record<Paso, boolean> = {
    Concepto: !!p.nombre && !!p.aspecto,
    Clase: p.niveles.length > 0,
    Especie: !!p.especie,
    Trasfondo: !!p.trasfondo,
    Características: caracteristicasListas(p) && !!res.elecciones.find((e) => e.id === 'tra:aumento')?.completa,
    Elecciones: res.elecciones.filter(enPasoElecciones).every((e) => e.completa || !e.opciones.length),
    Equipo: res.elecciones.filter((e) => e.tipo === 'equipo').every((e) => e.completa),
    Resumen: res.elecciones.every((e) => e.completa || (!e.opciones.length && e.tipo !== 'aumento')) && !!p.detalles.equipoAplicado,
  }

  return (
    <div className="creador">
      <header className="cabecera-app">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>← Personajes</button>
        <h2>{p.nombre || 'Nuevo personaje'}</h2>
        <span className="sutil">{guardando ? 'Guardando…' : 'Guardado'}</span>
        <button className="boton secundario" onClick={() => setBorrar(true)}>Borrar</button>
      </header>
      {borrar && <BorrarPersonaje p={p} alCerrar={() => setBorrar(false)} alBorrar={() => ir({ tipo: 'inicio' })} />}
      <nav className="pasos">
        {PASOS.map((s, k) => (
          <button key={s} className={`paso ${s === paso ? 'activo' : ''} ${listo[s] ? 'listo' : ''}`} onClick={() => setPaso(s)}>
            <span className="num">{listo[s] && s !== paso ? '✓' : k + 1}</span>
            <span className="txt">{s}</span>
          </button>
        ))}
      </nav>

      <section className="paso-cuerpo">
        {paso === 'Concepto' && <PasoConcepto p={p} actualizar={actualizar} />}
        {paso === 'Clase' && <PasoClase p={p} datos={datos} actualizar={actualizar} />}
        {paso === 'Especie' && <PasoEspecie p={p} datos={datos} actualizar={actualizar} />}
        {paso === 'Trasfondo' && <PasoTrasfondo p={p} datos={datos} actualizar={actualizar} />}
        {paso === 'Características' && (
          <PasoCaracteristicas p={p} actualizar={actualizar} aumento={res.elecciones.find((e) => e.id === 'tra:aumento')} fijar={fijarEleccion} aumentos={res.aumentos} />
        )}
        {paso === 'Elecciones' && <ListaElecciones elecciones={res.elecciones.filter(enPasoElecciones)} p={p} datos={datos} fijar={fijarEleccion} origenesSinEleccion />}
        {paso === 'Equipo' && <PasoEquipo res={res.elecciones.filter((e) => e.tipo === 'equipo')} fijar={fijarEleccion} />}
        {paso === 'Resumen' && <PasoResumen p={p} datos={datos} actualizar={actualizar} pendientes={res.elecciones.filter((e) => !e.completa && (e.opciones.length || e.tipo === 'aumento'))} />}
      </section>

      <footer className="pie-pasos">
        <button className="boton secundario" disabled={i === 0} onClick={() => setPaso(PASOS[i - 1])}>Anterior</button>
        {i < PASOS.length - 1 && <button className="boton" onClick={() => setPaso(PASOS[i + 1])}>Siguiente</button>}
      </footer>
    </div>
  )
}

function caracteristicasListas(p: Personaje): boolean {
  const b = p.caracteristicas.base
  if (p.caracteristicas.metodo === 'compra') return costeCompra(b) <= PUNTOS_COMPRA
  if (p.caracteristicas.metodo === 'estandar') return [...CARACTERISTICAS.map((c) => b[c])].sort((x, y) => y - x).join() === CONJUNTO_ESTANDAR.join()
  return CARACTERISTICAS.every((c) => b[c] >= 3 && b[c] <= 20)
}

/** Elecciones que van en el paso «Elecciones» (las de características y equipo tienen su paso). */
const enPasoElecciones = (e: Eleccion) => e.id !== 'tra:aumento' && e.tipo !== 'equipo'

type Act = (f: (p: Personaje) => void) => void

function PasoConcepto({ p, actualizar }: { p: Personaje; actualizar: Act }) {
  // El interruptor muestra la cara invertida de todas las cartas, haya o no un aspecto elegido
  const [invertida, setInvertida] = useState(() => !!p.aspecto && ASPECTOS.some((a) => a.invertida === p.aspecto))
  const cambiarCara = (inv: boolean) => {
    setInvertida(inv)
    const a = ASPECTOS.find((x) => x.derecho === p.aspecto || x.invertida === p.aspecto)
    if (a) actualizar((x) => void (x.aspecto = inv ? a.invertida : a.derecho))
  }
  return (
    <div className="formulario">
      <label className="campo">Nombre del personaje<input value={p.nombre} onChange={(e) => actualizar((x) => void (x.nombre = e.target.value))} /></label>
      <label className="campo">Jugador<input value={p.jugador} onChange={(e) => actualizar((x) => void (x.jugador = e.target.value))} /></label>
      <h3>Aspecto del alma</h3>
      <p className="sutil">
        Todo el mundo nace con la marca de uno de los 22 aspectos. Elige el de tu personaje (o pídele al DM que te lo asigne según su sinergia).
        Una marca invertida tiene el dibujo del revés y un tacto frío: no hace malvado a nadie, pero mucha gente desconfía de ella.
      </p>
      <label className="interruptor">
        <input type="checkbox" checked={invertida} onChange={(e) => cambiarCara(e.target.checked)} />
        Marca invertida
      </label>
      <div className="rejilla-aspectos">
        {ASPECTOS.map((a) => {
          const nombre = invertida ? a.invertida : a.derecho
          return (
            <button key={a.n} className={`aspecto ${p.aspecto === nombre ? 'elegido' : ''} ${invertida ? 'invertido' : ''}`} onClick={() => actualizar((x) => void (x.aspecto = nombre))}>
              <span className="arcano">{a.n}</span>
              <b>{nombre}</b>
              <small>{a.carta}{invertida ? ' (invertida)' : ''} · {a.realidad}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PasoClase({ p, datos, actualizar }: { p: Personaje; datos: Datos; actualizar: Act }) {
  const actual = p.niveles[0]?.clase
  const [ver, setVer] = useState<string>()
  return (
    <div>
      <p className="sutil">Elige la clase con la que empieza tu personaje. Al subir de nivel podrás añadir niveles de otras clases (multiclase).</p>
      <div className="rejilla-tarjetas">
        {datos.clases.map((c) => (
          <article key={c._clave} className={`tarjeta-eleccion ${actual === c._clave ? 'elegida' : ''}`}>
            <button className="tarjeta-boton" onClick={() => actualizar((x) => void (x.niveles = [{ clase: c._clave }]))}>
              <h3>{c._nombre} <small className="sutil">({c.name})</small></h3>
              <p className="sutil">Fuente de poder: {c._fuentePoder} · Hit Die d{c.hd.faces} · Saves {c.proficiency.map((s) => ABREV[s]).join(', ')}</p>
              {c._setting && <p>{c._setting}</p>}
            </button>
            <button className="enlace" onClick={() => setVer(ver === c._clave ? undefined : c._clave)}>{ver === c._clave ? 'Ocultar rasgos' : 'Ver rasgos por nivel'}</button>
            {ver === c._clave && <RasgosDeClase clave={c._clave} datos={datos} />}
          </article>
        ))}
      </div>
    </div>
  )
}

function RasgosDeClase({ clave, datos }: { clave: string; datos: Datos }) {
  const c = datos.clases.find((x) => x._clave === clave)!
  return (
    <div className="rasgos-clase">
      {c.classFeatures.map((cf) => {
        const ref = typeof cf === 'string' ? cf : cf.classFeature
        const [n, cl, cs, nv, f] = ref.split('|')
        const r = datos.rasgos[`cf|${n}|${cl}|${cs}|${nv}|${f || cs}`.toLowerCase()]
        return r ? (
          <details key={ref}>
            <summary>Nivel {r.level}: {r.name}</summary>
            <Entradas entries={r.entries} />
          </details>
        ) : null
      })}
    </div>
  )
}

function PasoEspecie({ p, datos, actualizar }: { p: Personaje; datos: Datos; actualizar: Act }) {
  const [ver, setVer] = useState<string>()
  return (
    <div className="rejilla-tarjetas">
      {datos.especies.map((e) => (
        <article key={e._clave} className={`tarjeta-eleccion ${p.especie === e._clave ? 'elegida' : ''}`}>
          <button className="tarjeta-boton" onClick={() => actualizar((x) => void (x.especie = e._clave))}>
            <h3>{e._nombre}</h3>
            <p className="sutil">Origen: {e._origen} · Velocidad {typeof e.speed === 'number' ? e.speed : e.speed?.walk} ft{e.darkvision ? ` · Darkvision ${e.darkvision} ft` : ''}</p>
            <p className="sutil">Tamaño: {tamañosEspecie(e).map((t) => `${t.nombre}${t.altura ? ` (${t.altura})` : ''}`).join(' o ')}{tamañosEspecie(e).length > 1 ? ', a elegir' : ''}</p>
            <p>{e._setting}</p>
          </button>
          <button className="enlace" onClick={() => setVer(ver === e._clave ? undefined : e._clave)}>{ver === e._clave ? 'Ocultar rasgos' : 'Ver rasgos'}</button>
          {ver === e._clave && <Entradas entries={e.entries} />}
        </article>
      ))}
    </div>
  )
}

function resumenTrasfondo(t: Crudo, datos: Datos): string {
  const habs = (t.skillProficiencies?.[0] ? Object.keys(t.skillProficiencies[0]).filter((k) => k !== 'choose' && k !== 'any') : []).join(', ')
  const dote = (t.feats ?? []).flatMap((f: Crudo) => Object.keys(f))[0]
  const doteNombre = dote === 'marca manifiesta|setting' ? 'Marca manifiesta' : dote === 'marca invertida|setting' ? 'Marca invertida' : datos.dotes.find((x) => x._clave === claveDeRef(dote?.split(';')[0] ?? ''))?._nombre ?? dote?.split('|')[0]
  const car = t.ability?.[0]?.choose?.weighted?.from?.map((c: Caracteristica) => ABREV[c]).join(', ')
  return [car && `Características: ${car}`, habs && `Habilidades: ${habs}`, doteNombre && `Dote: ${doteNombre}`].filter(Boolean).join(' · ')
}

function PasoTrasfondo({ p, datos, actualizar }: { p: Personaje; datos: Datos; actualizar: Act }) {
  const [q, setQ] = useState('')
  const [ver, setVer] = useState<string>()
  const lista = datos.trasfondos.filter((t) => !q || normalizar(`${t._nombre} ${t.name}`).includes(normalizar(q)))
  return (
    <div>
      <p className="sutil">Los trasfondos de D&amp;D 2024 con su versión en el setting. Cualquiera puede cambiar su dote de origen por la marca manifiesta de su aspecto.</p>
      <Buscador valor={q} alCambiar={setQ} />
      {[lista.filter((t) => !esAU(t.source)), lista.filter((t) => esAU(t.source))].map((grupo, gi) => grupo.length > 0 && (
      <div key={gi}>
      {gi === 1 && <h3 className="grupo-opciones">Arcana Unleashed <span className="insignia au">AU</span></h3>}
      <div className="rejilla-tarjetas">
        {grupo.map((t) => (
          <article key={t._clave} className={`tarjeta-eleccion ${p.trasfondo === t._clave ? 'elegida' : ''}`}>
            <button className="tarjeta-boton" onClick={() => actualizar((x) => void (x.trasfondo = t._clave))}>
              <h3>{t._nombre} {t._nombre !== t.name && <small className="sutil">({t.name})</small>}{esAU(t.source) && <span className="insignia au">AU</span>}</h3>
              {t._setting && <p>{t._setting}</p>}
              <p className="sutil">{resumenTrasfondo(t, datos)}</p>
            </button>
            <button className="enlace" onClick={() => setVer(ver === t._clave ? undefined : t._clave)}>{ver === t._clave ? 'Ocultar' : 'Ver detalles'}</button>
            {ver === t._clave && <Entradas entries={t.entries} />}
          </article>
        ))}
      </div>
      </div>
      ))}
    </div>
  )
}

function PasoCaracteristicas({ p, actualizar, aumento, fijar, aumentos }: { p: Personaje; actualizar: Act; aumento?: Eleccion; fijar: (id: string, v: string[]) => void; aumentos: { car: Caracteristica; valor: number }[] }) {
  const tirar = useEstado((s) => s.tirar)
  const m = p.caracteristicas.metodo
  const b = p.caracteristicas.base
  const coste = costeCompra(b)
  const cambiarMetodo = (metodo: Personaje['caracteristicas']['metodo']) =>
    actualizar((x) => {
      x.caracteristicas.metodo = metodo
      if (metodo === 'compra') x.caracteristicas.base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
      if (metodo === 'estandar') x.caracteristicas.base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    })
  const tiradas = p.caracteristicas.tiradas ?? []
  const totalesTirados = tiradas.map(sumar4d6)

  const tirarTodo = () => {
    actualizar((x) => void (x.caracteristicas.tiradas = []))
    for (let k = 0; k < 6; k++) {
      tirar({
        etiqueta: `Característica ${k + 1} (4d6, se descarta el menor)`,
        formula: '4d6',
        alTerminar: (r) => actualizar((x) => void (x.caracteristicas.tiradas = [...(x.caracteristicas.tiradas ?? []), r.dados[0].valores].slice(0, 6))),
      })
    }
  }

  return (
    <div className="formulario">
      <div className="fila-botones">
        {(
          [
            ['compra', 'Compra de puntos'],
            ['estandar', 'Conjunto estándar'],
            ['dados', 'Tirar dados'],
            ['manual', 'Manual (DM)'],
          ] as const
        ).map(([k, t]) => (
          <button key={k} className={`boton ${m === k ? '' : 'secundario'}`} onClick={() => cambiarMetodo(k)}>{t}</button>
        ))}
      </div>
      {m === 'compra' && <p className={coste > PUNTOS_COMPRA ? 'error' : 'sutil'}>Puntos gastados: {coste} / {PUNTOS_COMPRA}</p>}
      {m === 'estandar' && <p className="sutil">Reparte 15, 14, 13, 12, 10 y 8.</p>}
      {m === 'dados' && (
        <div>
          <button className="boton" onClick={tirarTodo}>Tirar 4d6 seis veces</button>
          {totalesTirados.length > 0 && (
            <p>Resultados: {tiradas.map((t, k) => <span key={k} className="chip">{totalesTirados[k]} <small>[{t.join(', ')}]</small></span>)}</p>
          )}
          <p className="sutil">Asigna cada resultado a una característica.</p>
        </div>
      )}
      <table className="tabla-car">
        <thead>
          <tr><th></th><th>Base</th><th>Trasfondo y otros</th><th>Total</th><th>Mod</th></tr>
        </thead>
        <tbody>
          {CARACTERISTICAS.map((c) => {
            const extra = aumentos.filter((a) => a.car === c).reduce((s, a) => s + a.valor, 0)
            const total = b[c] + extra
            return (
              <tr key={c}>
                <th>{ABREV[c]} <small className="sutil">{NOMBRE_CAR[c]}</small></th>
                <td>
                  {m === 'compra' && (
                    <span className="contador">
                      <button className="boton-mini" disabled={b[c] <= 8} onClick={() => actualizar((x) => void (x.caracteristicas.base[c] = b[c] - 1))}>−</button>
                      <b>{b[c]}</b>
                      <button className="boton-mini" disabled={b[c] >= 15 || coste - COSTE_COMPRA[b[c]] + COSTE_COMPRA[b[c] + 1] > PUNTOS_COMPRA} onClick={() => actualizar((x) => void (x.caracteristicas.base[c] = b[c] + 1))}>+</button>
                    </span>
                  )}
                  {m === 'estandar' && (
                    <select value={b[c]} onChange={(e) => actualizar((x) => intercambiar(x, c, Number(e.target.value)))}>
                      {CONJUNTO_ESTANDAR.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  )}
                  {m === 'dados' && (
                    <select value={b[c]} onChange={(e) => actualizar((x) => void (x.caracteristicas.base[c] = Number(e.target.value)))}>
                      <option value={b[c]}>{b[c]}</option>
                      {totalesTirados.map((v, k) => <option key={k} value={v}>{v} (tirada {k + 1})</option>)}
                    </select>
                  )}
                  {m === 'manual' && (
                    <input type="number" min={3} max={20} value={b[c]} onChange={(e) => actualizar((x) => void (x.caracteristicas.base[c] = Number(e.target.value)))} />
                  )}
                </td>
                <td>{extra ? conSigno(extra) : ''}</td>
                <td><b>{total}</b></td>
                <td>{conSigno(modificador(total))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {aumento ? <EditorEleccion e={aumento} alCambiar={(v) => fijar(aumento.id, v)} /> : <p className="sutil">Elige un trasfondo para repartir sus aumentos de característica.</p>}
    </div>
  )
}

/** Conjunto estándar: al asignar un valor, la característica que lo tenía recibe el anterior. */
function intercambiar(x: Personaje, c: Caracteristica, v: number) {
  const b = x.caracteristicas.base
  const otra = CARACTERISTICAS.find((k) => k !== c && b[k] === v)
  if (otra) b[otra] = b[c]
  b[c] = v
}

export function ListaElecciones({ elecciones, p, datos, fijar, origenesSinEleccion = false }: {
  elecciones: Eleccion[]
  p: Personaje
  datos: Datos
  fijar: (id: string, v: string[]) => void
  /** Añade también la especie, el trasfondo y las dotes sin elecciones, para poder ver lo que otorgan. */
  origenesSinEleccion?: boolean
}) {
  const hoja = useMemo(() => {
    try {
      return derivar(p, datos)
    } catch {
      return undefined
    }
  }, [p, datos])
  const competentes = new Set(hoja?.habilidades.filter((h) => h.competente).map((h) => h.clave))
  const grupos = new Map<string, Eleccion[]>()
  for (const e of elecciones) {
    if (!grupos.has(e.origen)) grupos.set(e.origen, [])
    grupos.get(e.origen)!.push(e)
  }
  // Orígenes que no piden nada pero otorgan rasgos o conjuros (una dote fija, la marca, la especie...)
  let orden = [...grupos.keys()]
  if (origenesSinEleccion && hoja) {
    const insertarTras = (nuevo: string, padre?: string) => {
      if (orden.includes(nuevo)) return
      const i = padre ? orden.indexOf(padre) : -1
      orden = i >= 0 ? [...orden.slice(0, i + 1), nuevo, ...orden.slice(i + 1)] : [...orden, nuevo]
    }
    const r = hoja.resolucion
    const esp = datos.especies.find((x) => x._clave === p.especie)
    const tra = datos.trasfondos.find((x) => x._clave === p.trasfondo)
    if (esp) insertarTras(`Especie: ${esp._nombre}`, 'Personaje')
    if (tra) insertarTras(`Trasfondo: ${tra._nombre}`, esp ? `Especie: ${esp._nombre}` : 'Personaje')
    for (const x of r.rasgos) if ((x.tipo === 'dote' || x.tipo === 'marca') && x.nivel <= 1) insertarTras(`Dote: ${x.nombre}`, x.origen)
  }
  // Valores repetidos entre elecciones del mismo tipo (p. ej. el mismo conjuro dos veces)
  const repetidos = (e: Eleccion) => new Set(elecciones.filter((x) => x.id !== e.id && x.tipo === e.tipo).flatMap((x) => x.valor))
  if (!orden.length) return <p className="sutil">No hay nada que elegir aquí.</p>
  return (
    <div className="lista-elecciones">
      {orden.map((origen) => (
        <section key={origen} className="grupo-elecciones">
          <h3>{origen}</h3>
          {hoja && <DetalleOrigen origen={origen} hoja={hoja} />}
          {(grupos.get(origen) ?? []).map((e) => (
            <EditorEleccion key={e.id} e={e} alCambiar={(v) => fijar(e.id, v)} competentes={competentes} repetidos={repetidos(e)} />
          ))}
        </section>
      ))}
    </div>
  )
}

/** Plegable con los rasgos y conjuros que otorga un origen (especie, trasfondo, dote, marca, nivel de clase). */
function DetalleOrigen({ origen, hoja }: { origen: string; hoja: Hoja }) {
  const rasgos = hoja.resolucion.rasgos.filter(
    (r) =>
      ((r.tipo === 'especie' || r.tipo === 'trasfondo' || r.tipo === 'clase' || r.tipo === 'subclase') && r.origen === origen) ||
      ((r.tipo === 'dote' || r.tipo === 'marca') && origen === `Dote: ${r.nombre}`),
  )
  const conjuros = hoja.conjuros.filter((c) => c.origen === origen)
  if (!rasgos.length && !conjuros.length) return null
  return (
    <details className="detalle-origen">
      <summary>Ver qué otorga{conjuros.length ? ` (${conjuros.length} conjuro${conjuros.length > 1 ? 's' : ''})` : ''}</summary>
      {conjuros.length > 0 && (
        <div className="conjuros-fijos">
          <span className="sutil">Conjuros:</span>
          {conjuros.map((c) => (
            <button type="button" key={c.conjuro._clave} className="chip fijo" onClick={() => abrirDetalle({ tipo: 'conjuro', clave: c.conjuro._clave })}>
              {c.conjuro.name}{' '}
              <small>
                {c.conjuro.level === 0 ? 'truco' : `nivel ${c.conjuro.level}`}
                {c.usos === 'voluntad' ? ' · a voluntad' : c.usos ? ` · ${c.usos}/${c.recarga === 'corto' ? 'Short Rest' : 'Long Rest'}` : c.siempre && c.conjuro.level > 0 ? ' · siempre preparado' : ''}
              </small>
            </button>
          ))}
        </div>
      )}
      {rasgos.map((r, i) => (
        <details key={`${r.nombre}${i}`} className="rasgo">
          <summary>{r.nombre}</summary>
          <Entradas entries={r.entries} />
        </details>
      ))}
    </details>
  )
}

function PasoEquipo({ res, fijar }: { res: Eleccion[]; fijar: (id: string, v: string[]) => void }) {
  return (
    <div>
      <p className="sutil">Elige el equipo inicial de tu clase y de tu trasfondo. Se añadirá al inventario al terminar.</p>
      {res.map((e) => (
        <section key={e.id}>
          <h3>{e.origen}</h3>
          <EditorEleccion e={e} alCambiar={(v) => fijar(e.id, v)} />
        </section>
      ))}
    </div>
  )
}

function PasoResumen({ p, datos, actualizar, pendientes }: { p: Personaje; datos: Datos; actualizar: Act; pendientes: Eleccion[] }) {
  const objetos = useEstado((s) => s.objetos)
  const hoja = useMemo(() => {
    try {
      return derivar(p, datos, objetos)
    } catch {
      return undefined
    }
  }, [p, datos, objetos])
  const terminar = () => {
    if (!hoja) return
    actualizar((x) => {
      aplicarEquipo(x, hoja, datos)
      x.estado.pgActuales = hoja.pgMax
    })
    ir({ tipo: 'hoja', id: p.id })
  }
  return (
    <div>
      {hoja && (
        <div className="resumen-creacion">
          <div className="stats-grandes">
            <div><span>HP</span><b>{hoja.pgMax}</b></div>
            <div><span>AC</span><b>{hoja.ca.valor}</b></div>
            <div><span>Iniciativa</span><b>{conSigno(hoja.iniciativa)}</b></div>
            <div><span>Velocidad</span><b>{hoja.velocidad.andar} ft</b></div>
            <div><span>PB</span><b>{conSigno(hoja.pb)}</b></div>
          </div>
          <div className="fila caracteristicas-mini">
            {CARACTERISTICAS.map((c) => <span key={c}><b>{ABREV[c]}</b> {hoja.car[c].valor} ({conSigno(hoja.car[c].mod)})</span>)}
          </div>
          <p><b>Habilidades:</b> {hoja.habilidades.filter((h) => h.competente).map((h) => `${h.nombre}${h.pericia ? ' (Expertise)' : ''}`).join(', ') || '—'}</p>
          <p><b>Idiomas:</b> {hoja.competencias.idiomas.join(', ')}</p>
          <p><b>Rasgos:</b> {hoja.rasgos.map((r) => r.nombre).join(', ')}</p>
          {hoja.resolucion.equipo.length > 0 && (
            <p><b>Equipo:</b> {hoja.resolucion.equipo.map((g) => resumenEquipo(datos, g.items)).join('; ')}</p>
          )}
        </div>
      )}
      {pendientes.length > 0 ? (
        <div className="aviso-pendientes">
          <h3>Faltan {pendientes.length} elecciones</h3>
          <ul>{pendientes.map((e) => <li key={e.id}>{e.origen}: {e.etiqueta}</li>)}</ul>
        </div>
      ) : (
        <p className="ok">Todo listo.</p>
      )}
      <button className="boton grande" disabled={!hoja || !p.nombre} onClick={terminar}>
        {p.detalles.equipoAplicado ? 'Ir a la hoja' : 'Terminar y añadir el equipo'}
      </button>
    </div>
  )
}
