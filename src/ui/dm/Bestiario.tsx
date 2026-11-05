// Bestiario (solo DM): el catálogo de criaturas de la campaña. Se crean aquí o se importan de las notas de Bestiario/.
import { useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { nuevoId } from '../../motor/personaje'
import { CARACTERISTICAS } from '../../datos/tipos'
import { ABREV } from '../glosario'
import { Buscador, Modal, normalizar } from '../comun'
import { descargar } from '../hoja/exportar'
import { formulaValida } from '../../dados/tiradas'
import {
  criaturaVacia, exportarCriatura, importarCriatura, leerEntradas, SECCIONES_ENTRADAS, type Criatura, type Entrada,
} from '../../almacen/criaturas'
import { FichaCriatura, useCriaturas } from './FichaCriatura'

const TRAMOS = ['3-4', '5-7', '8-10', '11-16', '17-20']

export function Bestiario() {
  const repo = useEstado((s) => s.repo)
  const [criaturas, error] = useCriaturas()
  const [q, setQ] = useState('')
  const [tramo, setTramo] = useState('')
  const [viendo, setViendo] = useState<string>()
  const [editando, setEditando] = useState<Criatura>()
  const [mensaje, setMensaje] = useState('')
  if (!repo?.esDM()) return <p className="pantalla-centro">Solo el DM puede ver el Bestiario.</p>
  const lista = criaturas.filter((c) => (!q || normalizar(`${c.nombre} ${c.tipo ?? ''}`).includes(normalizar(q))) && (!tramo || c.tramo === tramo))
  const visto = criaturas.find((c) => c.id === viendo)

  const importar = async (files: FileList | null) => {
    if (!files) return
    let n = 0
    for (const f of Array.from(files)) {
      if (!f.name.toLowerCase().endsWith('.md')) continue
      const texto = await f.text()
      const existente = criaturas.find((c) => c.notaObsidian === f.name || c.nombre === f.name.replace(/\.md$/i, ''))
      const c = importarCriatura(f.name, texto, existente)
      await repo.guardarCriatura({ ...c, id: existente?.id ?? nuevoId() })
      n++
    }
    setMensaje(`Importadas ${n} notas.`)
  }

  return (
    <div
      className="almacen"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void importar(e.dataTransfer.files)
      }}
    >
      <header className="cabecera-app">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>← Inicio</button>
        <h2>Bestiario</h2>
      </header>
      <div className="fila-botones">
        <button className="boton" onClick={() => setEditando(criaturaVacia())}>Nueva criatura</button>
        <label className="boton secundario">
          Importar notas de Obsidian (.md)
          <input type="file" accept=".md" multiple hidden onChange={(e) => void importar(e.target.files)} />
        </label>
      </div>
      <p className="sutil">
        Arrastra aquí notas de la carpeta <code>Bestiario/</code> de la bóveda. La ficha va en su sección <code>## Estadísticas</code> con el formato de la plantilla «Criatura»
        (ver la nota «App de personajes» en <code>Recursos/Instrucciones</code>). Al volver a importar una nota se actualiza la criatura.
      </p>
      {error && /permission/i.test(error) && <div className="aviso-banda">Firebase no deja leer el Bestiario: publica las reglas de <code>firestore.rules</code>.</div>}
      {mensaje && <p className="ok">{mensaje}</p>}
      <div className="fila">
        <Buscador valor={q} alCambiar={setQ} />
        <select value={tramo} onChange={(e) => setTramo(e.target.value)} aria-label="Tramo">
          <option value="">Todos los tramos</option>
          {TRAMOS.map((t) => <option key={t} value={t}>Tramo {t}</option>)}
        </select>
      </div>
      {criaturas.length === 0 && <p className="sutil">Aún no hay criaturas. Crea una o importa las notas del Bestiario.</p>}
      <div className="rejilla-tarjetas">
        {lista.map((c) => (
          <article key={c.id} className="tarjeta-objeto tarjeta-bestia" onClick={() => setViendo(c.id)}>
            <h3>{c.nombre}</h3>
            <p className="sutil">{[c.tipo, c.vd && `VD ${c.vd}`, c.tramo && `tramo ${c.tramo}`].filter(Boolean).join(' · ')}</p>
            <div className="datos-mesa">
              <span>AC <b>{c.ca}</b></span>
              <span>PG <b>{c.pgMax}</b></span>
              {c.legendarias && <span className="chip">Legendaria</span>}
              {c.guarida && <span className="chip">Guarida</span>}
              {c.dominio?.length ? <span className="chip">Dominio</span> : null}
              {c.sinergias?.length ? <span className="chip">Sinergias</span> : null}
            </div>
          </article>
        ))}
      </div>
      {visto && (
        <Modal titulo={visto.nombre} alCerrar={() => setViendo(undefined)} ancho="ancho">
          <FichaCriatura c={visto} />
          <div className="fila-botones">
            <button className="boton" onClick={() => { setEditando(structuredClone(visto)); setViendo(undefined) }}>Editar</button>
            <button className="boton secundario" onClick={() => descargar(visto.notaObsidian ?? `${visto.nombre}.md`, exportarCriatura(visto))}>Exportar .md</button>
            <button
              className="boton peligro"
              onClick={() => {
                if (confirm(`¿Borrar ${visto.nombre} del Bestiario? Las criaturas que ya estén en el escenario se quedan como están.`)) {
                  void repo.borrarCriatura(visto.id!)
                  setViendo(undefined)
                }
              }}
            >
              Borrar
            </button>
          </div>
        </Modal>
      )}
      {editando && (
        <EditorCriatura
          c={editando}
          alCerrar={() => setEditando(undefined)}
          alGuardar={async (c) => {
            await repo.guardarCriatura(c)
            setEditando(undefined)
            setViendo(c.id)
          }}
        />
      )}
    </div>
  )
}

/** Entradas ⇄ texto «- **Nombre.** texto» (el mismo formato que en Obsidian). */
const aTexto = (es?: Entrada[]) => (es ?? []).map((e) => `- **${e.nombre}.** ${e.texto.replace(/\n/g, '\n  ')}`).join('\n')
const deTexto = (t: string) => leerEntradas(t).entradas

/** Editor de una criatura del Bestiario. `alGuardar` recibe la criatura con id. */
export function EditorCriatura({ c: inicial, alCerrar, alGuardar }: { c: Criatura; alCerrar: () => void; alGuardar: (c: Criatura) => void }) {
  const [c, setC] = useState<Criatura>(inicial)
  const [textos, setTextos] = useState<Record<string, string>>(() => ({
    rasgos: aTexto(inicial.rasgos),
    acciones: aTexto(inicial.acciones),
    adicionales: aTexto(inicial.adicionales),
    reacciones: aTexto(inicial.reacciones),
    legendarias: aTexto(inicial.legendarias?.acciones),
    guarida: aTexto(inicial.guarida?.acciones),
    efectos: aTexto(inicial.guarida?.efectos),
    dominio: aTexto(inicial.dominio),
    sinergias: aTexto(inicial.sinergias),
  }))
  const [vista, setVista] = useState(false)
  const num = (v: string) => Number(v.replace(/[^\d-]/g, '')) || 0
  const campo = <K extends keyof Criatura>(k: K, v: Criatura[K]) => setC((x) => ({ ...x, [k]: v }))
  const texto = (k: keyof Criatura, etiqueta: string, ejemplo?: string, filas = 1) => (
    <label className="campo">
      {etiqueta}
      {filas > 1 ? (
        <textarea rows={filas} value={(c[k] as string) ?? ''} onChange={(e) => campo(k, (e.target.value || undefined) as never)} placeholder={ejemplo} />
      ) : (
        <input value={(c[k] as string) ?? ''} onChange={(e) => campo(k, (e.target.value || undefined) as never)} placeholder={ejemplo} />
      )}
    </label>
  )
  const area = (k: string, etiqueta: string, ejemplo: string) => (
    <label className="campo">
      {etiqueta}
      <textarea rows={Math.max(3, (textos[k].match(/\n/g)?.length ?? 0) + 2)} value={textos[k]} onChange={(e) => setTextos((t) => ({ ...t, [k]: e.target.value }))} placeholder={ejemplo} />
    </label>
  )

  const resultado = (): Criatura => {
    const r: Criatura = { ...c, id: c.id ?? nuevoId() }
    for (const s of SECCIONES_ENTRADAS) {
      const es = deTexto(textos[s.clave])
      r[s.clave] = es.length ? es : undefined
    }
    const leg = deTexto(textos.legendarias)
    r.legendarias = leg.length || c.legendarias?.texto ? { usos: c.legendarias?.usos ?? 3, usosGuarida: c.legendarias?.usosGuarida, texto: c.legendarias?.texto, acciones: leg } : undefined
    const gu = deTexto(textos.guarida)
    const ef = deTexto(textos.efectos)
    r.guarida = gu.length || ef.length || c.guarida?.texto ? { texto: c.guarida?.texto, acciones: gu, efectos: ef } : undefined
    const dom = deTexto(textos.dominio)
    r.dominio = dom.length ? dom : undefined
    const sin = deTexto(textos.sinergias)
    r.sinergias = sin.length ? sin : undefined
    return r
  }
  const formulaOk = !c.pgFormula || formulaValida(c.pgFormula)

  return (
    <Modal titulo={inicial.nombre ? `Editar ${inicial.nombre}` : 'Nueva criatura'} alCerrar={alCerrar} ancho="ancho">
      <div className="fila-botones">
        <button className={`boton ${vista ? 'secundario' : ''}`} onClick={() => setVista(false)}>Editar</button>
        <button className={`boton ${vista ? '' : 'secundario'}`} onClick={() => setVista(true)}>Vista previa</button>
      </div>
      {vista ? (
        <FichaCriatura c={resultado()} />
      ) : (
        <>
          <div className="rejilla-campos">
            <label className="campo">Nombre<input value={c.nombre} onChange={(e) => campo('nombre', e.target.value)} /></label>
            {texto('tipo', 'Tipo', 'Infernal Grande (Acechador), neutral malvado')}
            <label className="campo">VD<input value={c.vd ?? ''} onChange={(e) => campo('vd', e.target.value || undefined)} /></label>
            <label className="campo">
              Tramo
              <select value={c.tramo ?? ''} onChange={(e) => campo('tramo', e.target.value || undefined)}>
                <option value="">—</option>
                {TRAMOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="campo">AC<input inputMode="numeric" value={c.ca} onChange={(e) => campo('ca', num(e.target.value))} /></label>
            {texto('caTexto', 'Origen de la AC', 'armadura natural')}
            <label className="campo">PG<input inputMode="numeric" value={c.pgMax} onChange={(e) => campo('pgMax', num(e.target.value))} /></label>
            <label className="campo">Fórmula de PG<input value={c.pgFormula ?? ''} onChange={(e) => campo('pgFormula', e.target.value.replace(/\s+/g, '') || undefined)} placeholder="16d10+64" className={formulaOk ? '' : 'error'} /></label>
            <label className="campo">Bono de iniciativa<input value={c.bonoIniciativa} onChange={(e) => campo('bonoIniciativa', num(e.target.value))} /></label>
            {texto('velocidad', 'Velocidad', '40 ft, trepar 30 ft')}
            <label className="campo">Percepción pasiva<input inputMode="numeric" value={c.percepcionPasiva ?? ''} onChange={(e) => campo('percepcionPasiva', e.target.value ? num(e.target.value) : undefined)} /></label>
            <label className="campo">XP<input inputMode="numeric" value={c.xp ?? ''} onChange={(e) => campo('xp', e.target.value ? num(e.target.value) : undefined)} /></label>
          </div>
          <div className="rejilla-campos car">
            {CARACTERISTICAS.map((k) => (
              <label key={k} className="campo">
                {ABREV[k]}
                <input inputMode="numeric" value={c.caracteristicas?.[k] ?? ''} onChange={(e) => setC((x) => ({ ...x, caracteristicas: { ...x.caracteristicas, [k]: e.target.value ? num(e.target.value) : undefined } }))} />
              </label>
            ))}
          </div>
          <div className="rejilla-campos">
            {texto('salvaciones', 'Salvaciones', 'DES +6, SAB +6')}
            {texto('habilidades', 'Habilidades', 'Percepción +6, Sigilo +7')}
            {texto('vulnerabilidades', 'Vulnerabilidades')}
            {texto('resistencias', 'Resistencias')}
            {texto('inmunidades', 'Inmunidades', 'necrótico; Asustado, Hechizado')}
            {texto('sentidos', 'Sentidos', 'visión verdadera 60 ft')}
            {texto('lenguas', 'Lenguas')}
            {texto('habitat', 'Hábitat')}
          </div>
          {texto('resumen', 'Resumen', 'Una frase que la resuma.')}
          <p className="sutil">
            Cada rasgo o acción en una línea: <code>- **Nombre.** Texto</code>. Escribe <code>(Recarga 5-6)</code> o <code>(3/día)</code> en el nombre y la Pantalla del DM lo
            contará sola; en las legendarias, <code>(Cuesta 2)</code>.
          </p>
          {area('rasgos', 'Rasgos', '- **Atraído por la luz.** …')}
          {area('acciones', 'Acciones', '- **Multiataque.** Dos Mordiscos.\n- **Mordisco.** +8, alcance 5 ft. 16 (2d10 + 5) perforante.')}
          {area('adicionales', 'Acciones adicionales', '- **Salto entre hilos.** …')}
          {area('reacciones', 'Reacciones', '')}
          <h4>Acciones legendarias</h4>
          <div className="rejilla-campos">
            <label className="campo">Usos por ronda<input inputMode="numeric" value={c.legendarias?.usos ?? 3} onChange={(e) => setC((x) => ({ ...x, legendarias: { acciones: [], ...x.legendarias, usos: num(e.target.value) } }))} /></label>
            <label className="campo">En su guarida<input inputMode="numeric" value={c.legendarias?.usosGuarida ?? ''} onChange={(e) => setC((x) => ({ ...x, legendarias: { usos: 3, acciones: [], ...x.legendarias, usosGuarida: e.target.value ? num(e.target.value) : undefined } }))} /></label>
          </div>
          {area('legendarias', 'Opciones', '- **Mordisco.** …\n- **Aullido (Cuesta 2).** …')}
          <h4>Guarida</h4>
          <label className="campo">
            Descripción
            <textarea rows={2} value={c.guarida?.texto ?? ''} onChange={(e) => setC((x) => ({ ...x, guarida: { acciones: [], efectos: [], ...x.guarida, texto: e.target.value || undefined } }))} />
          </label>
          {area('guarida', 'Acciones de guarida (iniciativa 20)', '- **Sombras que muerden.** …')}
          {area('efectos', 'Efectos regionales', '- **Oscuridad que se extiende.** …')}
          {area('dominio', 'Dominio (acechadores)', '- **Ley.** …\n- **Ventaja.** …\n- **Pistas.** …\n- **Romperla.** …')}
          {area('sinergias', 'Sinergias', '- **Con Sarah Korad.** Si Sarah está en la escena, …')}
          {texto('tacticas', 'Tácticas (una por línea)', '', 3)}
          {texto('texto', 'Notas', '', 3)}
        </>
      )}
      <div className="fila-botones">
        <button className="boton" disabled={!c.nombre.trim() || !formulaOk} onClick={() => alGuardar(resultado())}>Guardar en el Bestiario</button>
        <button className="boton secundario" onClick={alCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}
