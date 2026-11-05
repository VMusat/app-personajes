// Familiares, invocaciones, compañeros y formas del PJ: los gestiona el jugador desde su hoja,
// y el DM los ve en vivo en su pantalla (con su iniciativa según las reglas).
import { useEffect, useMemo, useState } from 'react'
import { useEstado } from '../../estado/store'
import { nuevoId, type Aliado, type Forma, type ModoIniciativa } from '../../motor/personaje'
import { MODO_INICIATIVA, PLANTILLAS, sugerencias, TIPO_ALIADO } from '../../motor/compania'
import { Modal } from '../comun'
import { bestiaPermitida, formaDeBestia, limiteWildShape, nombreBestia, textoCr, type Bestia, type LimiteWildShape } from '../../motor/formas'
import { cargarBestias } from '../../datos/cargarBestias'
import { modificador } from '../../motor/personaje'
import { TextoConDados } from '../dm/FichaCriatura'
import { CONDICIONES, conSigno } from '../glosario'
import type { PropsPestaña } from './HojaPersonaje'

export function Compania({ p, h, actualizar }: PropsPestaña) {
  const tirar = useEstado((s) => s.tirar)
  const [editar, setEditar] = useState<{ aliado: Aliado; nuevo: boolean }>()
  const [formaNueva, setFormaNueva] = useState<{ pgTemporales: number; wildShape?: boolean }>()
  const [elegir, setElegir] = useState(false)
  const aliados = p.estado.aliados ?? []
  const forma = p.estado.forma
  const sug = sugerencias(h)

  const cambiarAliado = (id: string, f: (a: Aliado) => void) =>
    actualizar((x) => {
      const a = x.estado.aliados?.find((y) => y.id === id)
      if (a) f(a)
    })

  return (
    <section className="compania">
      {forma && (
        <div className="banda-forma">
          <span className="forma-icono">🐾</span>
          <div>
            <b>En forma de {forma.nombre}</b>
            <div className="sutil">
              {[forma.ca !== undefined && `AC ${forma.ca}`, forma.velocidad && `Speed ${forma.velocidad}`, forma.notas].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="boton secundario" onClick={() => actualizar((x) => void (x.estado.forma = undefined))}>Volver a tu forma</button>
          {forma.acciones && (
            <details className="ficha-forma-desplegable" open>
              <summary>Estadísticas de la forma</summary>
              <FichaForma forma={forma} />
              <p className="sutil">Conservas tus PG, tus Dados de Golpe, tu Inteligencia, Sabiduría y Carisma, tus rasgos de clase, competencias y dotes. Si un bono de habilidad o salvación de la bestia es mayor que el tuyo, usa el suyo. No puedes lanzar conjuros.</p>
            </details>
          )}
        </div>
      )}

      {aliados.length > 0 && (
        <div className="rejilla-aliados">
          {aliados.map((a) => (
            <TarjetaAliado
              key={a.id}
              a={a}
              cambiar={(f) => cambiarAliado(a.id, f)}
              editar={() => setEditar({ aliado: structuredClone(a), nuevo: false })}
              quitar={() => actualizar((x) => void (x.estado.aliados = (x.estado.aliados ?? []).filter((y) => y.id !== a.id)))}
              tirarIniciativa={() => tirar({ etiqueta: `Iniciativa · ${a.nombre}`, formula: `1d20${conSigno(a.bonoIniciativa ?? 0)}`, d20: true, personaje: p.nombre })}
            />
          ))}
        </div>
      )}

      <button className="boton secundario boton-convocar" onClick={() => setElegir(true)}>
        + Convocar un aliado{sug.some((s) => s.forma) && !forma ? ' o transformarte' : ''}
      </button>

      {elegir && (
        <Modal titulo="Convocar o transformarte" alCerrar={() => setElegir(false)}>
          {sug.length > 0 && (
            <>
              <h4>Lo que puedes hacer tú</h4>
              <div className="lista-sugerencias">
                {sug.map((s) => (
                  <button
                    key={s.texto}
                    className="sugerencia"
                    disabled={!!s.forma && !!forma}
                    onClick={() => {
                      setElegir(false)
                      if (s.forma) setFormaNueva(s.forma)
                      else if (s.aliado) setEditar({ aliado: { ...structuredClone(s.aliado), id: nuevoId() }, nuevo: true })
                    }}
                  >
                    <b>{s.texto}</b>
                    <span className="sutil">{s.detalle}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <h4>Otro aliado</h4>
          <div className="lista-sugerencias">
            {PLANTILLAS.map((t) => (
              <button key={t.texto} className="sugerencia" onClick={() => { setElegir(false); setEditar({ aliado: { ...structuredClone(t.aliado), id: nuevoId() }, nuevo: true }) }}>
                <b>{t.texto}</b>
                <span className="sutil">{MODO_INICIATIVA[t.aliado.iniciativa]}</span>
              </button>
            ))}
          </div>
          {!forma && (
            <>
              <h4>Otra transformación</h4>
              <button className="sugerencia" onClick={() => { setElegir(false); setFormaNueva({ pgTemporales: 0 }) }}>
                <b>Transformarte</b>
                <span className="sutil">Polymorph, una forma de un rasgo… Escribe la AC y la Speed de la forma.</span>
              </button>
            </>
          )}
        </Modal>
      )}

      {editar && (
        <EditarAliado
          inicial={editar.aliado}
          nuevo={editar.nuevo}
          alCerrar={() => setEditar(undefined)}
          alGuardar={(a) => {
            actualizar((x) => {
              const lista = x.estado.aliados ?? []
              x.estado.aliados = editar.nuevo ? [...lista, a] : lista.map((y) => (y.id === a.id ? a : y))
            })
            setEditar(undefined)
          }}
        />
      )}

      {formaNueva && (
        <NuevaForma
          pgTemporales={formaNueva.pgTemporales}
          limite={formaNueva.wildShape ? limiteWildShape(h) : undefined}
          alCerrar={() => setFormaNueva(undefined)}
          alGuardar={(f, temp) => {
            actualizar((x) => {
              x.estado.forma = f
              x.estado.pgTemporales = Math.max(x.estado.pgTemporales, temp)
            })
            setFormaNueva(undefined)
          }}
        />
      )}
    </section>
  )
}

function TarjetaAliado({ a, cambiar, editar, quitar, tirarIniciativa }: { a: Aliado; cambiar: (f: (a: Aliado) => void) => void; editar: () => void; quitar: () => void; tirarIniciativa: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const n = Math.max(0, parseInt(cantidad, 10) || 0)
  const pct = Math.max(0, Math.min(100, (100 * a.pg) / Math.max(1, a.pgMax)))
  const condiciones = a.condiciones ?? []
  return (
    <article className={`tarjeta-aliado ${a.pg === 0 ? 'caido' : ''}`}>
      <header>
        <b>{a.nombre}</b>
        <span className="insignia">{TIPO_ALIADO[a.tipo]}</span>
        <button className="boton-icono" onClick={editar} aria-label="Editar" title="Editar">✎</button>
      </header>
      <div className="mini-pg">
        <span><b>{a.pg}</b>/{a.pgMax} PG · AC <b>{a.ca}</b>{a.percepcionPasiva !== undefined && <> · Per. pasiva {a.percepcionPasiva}</>}</span>
        <div className="hp-barra"><div style={{ width: `${pct}%` }} className={pct < 25 ? 'baja' : pct < 50 ? 'media' : ''} /></div>
      </div>
      <div className="fila hp-acciones">
        <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Cantidad" />
        <button className="boton peligro" disabled={!n} onClick={() => { cambiar((x) => void (x.pg = Math.max(0, x.pg - n))); setCantidad('') }}>Daño</button>
        <button className="boton exito" disabled={!n} onClick={() => { cambiar((x) => void (x.pg = Math.min(x.pgMax, x.pg + n))); setCantidad('') }}>Curar</button>
      </div>
      <p className="sutil">{MODO_INICIATIVA[a.iniciativa]}</p>
      {a.notas && <p className="sutil">{a.notas}</p>}
      <div className="chips-mesa">
        {condiciones.map((k) => <button key={k} className="chip condicion" onClick={() => cambiar((x) => void (x.condiciones = condiciones.filter((y) => y !== k)))}>{k} ✕</button>)}
        <select className="chip" value="" onChange={(e) => e.target.value && cambiar((x) => void (x.condiciones = [...condiciones, e.target.value]))} aria-label="Añadir condición">
          <option value="">+ condición</option>
          {CONDICIONES.filter((k) => !condiciones.includes(k)).map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      <div className="fila-botones">
        {a.iniciativa === 'propia' && <button className="boton secundario" onClick={tirarIniciativa}>🎲 Iniciativa</button>}
        <button className="boton secundario" onClick={quitar}>Desconvocar</button>
      </div>
    </article>
  )
}

function EditarAliado({ inicial, nuevo, alCerrar, alGuardar }: { inicial: Aliado; nuevo: boolean; alCerrar: () => void; alGuardar: (a: Aliado) => void }) {
  const [a, setA] = useState<Aliado>(inicial)
  const num = (v: string) => Number(v.replace(/[^\d-]/g, '')) || 0
  const campo = <K extends keyof Aliado>(k: K, v: Aliado[K]) => setA((x) => ({ ...x, [k]: v }))
  return (
    <Modal titulo={nuevo ? 'Convocar' : `Editar ${inicial.nombre}`} alCerrar={alCerrar}>
      <div className="rejilla-campos">
        <label className="campo">Nombre<input value={a.nombre} onChange={(e) => campo('nombre', e.target.value)} /></label>
        <label className="campo">
          Tipo
          <select value={a.tipo} onChange={(e) => campo('tipo', e.target.value as Aliado['tipo'])}>
            {Object.entries(TIPO_ALIADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">PG máximos<input inputMode="numeric" value={a.pgMax} onChange={(e) => setA((x) => ({ ...x, pgMax: num(e.target.value), pg: nuevo ? num(e.target.value) : Math.min(x.pg, num(e.target.value)) }))} /></label>
        <label className="campo">AC<input inputMode="numeric" value={a.ca} onChange={(e) => campo('ca', num(e.target.value))} /></label>
        <label className="campo">Percepción pasiva<input inputMode="numeric" value={a.percepcionPasiva ?? ''} onChange={(e) => campo('percepcionPasiva', e.target.value ? num(e.target.value) : undefined)} /></label>
      </div>
      <label className="campo">
        En combate
        <select value={a.iniciativa} onChange={(e) => campo('iniciativa', e.target.value as ModoIniciativa)}>
          {Object.entries(MODO_INICIATIVA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {a.iniciativa === 'propia' && (
        <label className="campo">Bono de iniciativa<input value={a.bonoIniciativa ?? 0} onChange={(e) => campo('bonoIniciativa', num(e.target.value))} /></label>
      )}
      <label className="campo">Notas<textarea rows={3} value={a.notas ?? ''} onChange={(e) => campo('notas', e.target.value)} placeholder="Ataques, rasgos, de qué forma es…" /></label>
      <div className="fila-botones">
        <button className="boton" disabled={!a.nombre.trim()} onClick={() => alGuardar(a)}>{nuevo ? 'Convocar' : 'Guardar'}</button>
      </div>
    </Modal>
  )
}

/** Bloque de estadísticas de la forma (de la bestia elegida en la lista). */
export function FichaForma({ forma }: { forma: Forma }) {
  const car = (n: string, v?: number) => v !== undefined && <span><b>{n}</b> {v} ({conSigno(modificador(v))})</span>
  return (
    <div className="ficha-forma">
      <p className="sutil">{[forma.tamaño, forma.cr !== undefined && `VD ${forma.cr}`, forma.ca !== undefined && `AC ${forma.ca}`, forma.velocidad && `Speed ${forma.velocidad}`].filter(Boolean).join(' · ')}</p>
      <p className="ficha-forma-cars">{car('FUE', forma.fue)}{car('DES', forma.des)}{car('CON', forma.con)}</p>
      {forma.habilidades && <p><b>Skills</b> {forma.habilidades}</p>}
      {forma.sentidos && <p><b>Senses</b> {forma.sentidos}</p>}
      {(forma.rasgos ?? []).map((r) => <p key={r.nombre}><b><i>{r.nombre}.</i></b> {r.texto}</p>)}
      {(forma.acciones ?? []).map((a) => (
        <p key={a.nombre}><b><i>{a.nombre}.</i></b> <TextoConDados texto={a.texto} etiqueta={`${forma.nombre} · ${a.nombre.replace(/^(Bonus Action|Reaction): /, '')}`} /></p>
      ))}
    </div>
  )
}

function NuevaForma({ pgTemporales, limite, alCerrar, alGuardar }: { pgTemporales: number; limite?: LimiteWildShape; alCerrar: () => void; alGuardar: (f: Forma, temp: number) => void }) {
  const [f, setF] = useState<Forma>({ nombre: '', desde: new Date().toISOString() })
  const [temp, setTemp] = useState(pgTemporales)
  const [bestias, setBestias] = useState<Bestia[]>()
  const [error, setError] = useState<string>()
  const [todas, setTodas] = useState(!limite)
  useEffect(() => {
    cargarBestias().then(setBestias, (e: Error) => setError(e.message))
  }, [])
  const grupos = useMemo(() => {
    const g = new Map<string, Bestia[]>()
    for (const b of bestias ?? []) if (todas || !limite || bestiaPermitida(b, limite)) g.set(b.crTexto, [...(g.get(b.crTexto) ?? []), b])
    return [...g]
  }, [bestias, todas, limite])
  const bestia = bestias?.find((x) => x.clave === f.ref)
  const elegir = (clave: string) => {
    const b = bestias?.find((x) => x.clave === clave)
    setF(b ? formaDeBestia(b, limite) : { nombre: '', desde: new Date().toISOString() })
  }
  return (
    <Modal titulo={limite ? 'Wild Shape' : 'Transformarte'} alCerrar={alCerrar}>
      {limite && (
        <p className="sutil">
          Druida de nivel {limite.nivel}{limite.luna ? ' del Círculo de la Luna' : ''}: bestias de VD {textoCr(limite.crMax)} o menos
          {limite.vuelo ? '' : ', sin velocidad de vuelo'}. Conoces {limite.conocidas} formas
          {limite.luna ? `; tu AC en la forma es como mínimo ${limite.caMinima} (13 + Sabiduría)` : ''}.
        </p>
      )}
      <label className="campo">
        Bestia
        <select value={f.ref ?? ''} onChange={(e) => elegir(e.target.value)} disabled={!bestias}>
          <option value="">{bestias ? '— Elige una bestia (o escribe la forma a mano) —' : error ? 'No se pudo cargar la lista' : 'Cargando bestias…'}</option>
          {grupos.map(([cr, bs]) => (
            <optgroup key={cr} label={`VD ${cr}`}>
              {bs.map((b) => (
                <option key={b.clave} value={b.clave}>
                  {nombreBestia(b)}{b.vuela ? ' · vuela' : ''}{b.nada ? ' · nada' : ''}{limite && !bestiaPermitida(b, limite) ? ' (fuera de tu límite)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      {limite && (
        <label className="interruptor"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Ver también las que superan tu límite</label>
      )}
      <div className="rejilla-campos">
        <label className="campo">Forma<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Lobo" /></label>
        <label className="campo">AC de la forma<input inputMode="numeric" value={f.ca ?? ''} onChange={(e) => setF({ ...f, ca: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })} /></label>
        <label className="campo">Speed<input value={f.velocidad ?? ''} onChange={(e) => setF({ ...f, velocidad: e.target.value || undefined })} placeholder="40 ft" /></label>
        <label className="campo">PG temporales<input inputMode="numeric" value={temp} onChange={(e) => setTemp(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
      </div>
      {bestia && f.acciones && (
        <>
          {bestia.entornos.length > 0 && <p className="sutil">Dónde se ve: {bestia.entornos.join(', ')}.</p>}
          <FichaForma forma={f} />
        </>
      )}
      <p className="sutil">Conservas tus PG, tus rasgos y tu Inteligencia, Sabiduría y Carisma.</p>
      <label className="campo">Notas<textarea rows={2} value={f.notas ?? ''} onChange={(e) => setF({ ...f, notas: e.target.value || undefined })} placeholder="Lo que quieras recordar de la forma" /></label>
      <div className="fila-botones">
        <button className="boton" disabled={!f.nombre.trim()} onClick={() => alGuardar(f, temp)}>Transformarte</button>
      </div>
    </Modal>
  )
}
