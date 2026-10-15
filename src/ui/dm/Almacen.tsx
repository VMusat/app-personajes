// Almacén de objetos mágicos de la campaña (solo DM): crear, editar, importar desde Obsidian y exportar.
import { useMemo, useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { RAREZAS, objetoVacio, type ObjetoCampaña } from '../../almacen/objetosCampaña'
import { describirEfecto, describirEfectos, exportarNota, importarNota } from '../../almacen/obsidian'
import type { Efecto, TipoEfecto } from '../../motor/efectos'
import { CARACTERISTICAS } from '../../datos/tipos'
import { ABREV, titulo } from '../glosario'
import { Buscador, Modal, normalizar } from '../comun'
import { descargar } from '../hoja/exportar'

export function Almacen() {
  const { objetos, repo } = useEstado()
  const [editando, setEditando] = useState<ObjetoCampaña>()
  const [q, setQ] = useState('')
  const [mensaje, setMensaje] = useState('')
  if (!repo?.esDM()) return <p className="pantalla-centro">Solo el DM puede gestionar los objetos de la campaña.</p>
  const lista = objetos.filter((o) => !q || normalizar(o.nombre).includes(normalizar(q)))

  const importar = async (files: FileList | null) => {
    if (!files) return
    let n = 0
    for (const f of Array.from(files)) {
      if (!f.name.toLowerCase().endsWith('.md')) continue
      const texto = await f.text()
      const existente = objetos.find((o) => o.notaObsidian === f.name || o.nombre === f.name.replace(/\.md$/i, ''))
      await repo.guardarObjeto(importarNota(f.name, texto, existente))
      n++
    }
    setMensaje(`Importadas ${n} notas.`)
  }

  return (
    <div className="almacen">
      <header className="cabecera-app">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>← Inicio</button>
        <h2>Objetos de la campaña</h2>
      </header>
      <div className="fila-botones">
        <button className="boton" onClick={() => setEditando(objetoVacio())}>Nuevo objeto</button>
        <label className="boton secundario">
          Importar notas de Obsidian (.md)
          <input type="file" accept=".md" multiple hidden onChange={(e) => void importar(e.target.files)} />
        </label>
      </div>
      <p className="sutil">
        Puedes arrastrar aquí notas de la carpeta <code>Objetos/</code> de la bóveda. La parte mecánica va en la propiedad <code>mecanica</code> del frontmatter
        (ver la nota «App de personajes» en <code>Recursos/Instrucciones</code>).
      </p>
      {mensaje && <p className="ok">{mensaje}</p>}
      <div
        className="zona-soltar"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void importar(e.dataTransfer.files)
        }}
      >
        Suelta aquí archivos .md
      </div>
      <Buscador valor={q} alCambiar={setQ} />
      <div className="rejilla-tarjetas">
        {lista.map((o) => (
          <article key={o.id} className="tarjeta-objeto">
            <h3>{o.nombre}</h3>
            <p className="sutil">{titulo(o.rareza)} · {o.tipo}{o.sintonizacion ? ' · sintonización' : ''}{o.notaObsidian ? ` · ${o.notaObsidian}` : ''}</p>
            <pre className="efectos-resumen">{describirEfectos(o) || 'Sin efectos mecánicos'}</pre>
            <div className="fila-botones">
              <button className="boton secundario" onClick={() => setEditando(o)}>Editar</button>
              <button className="boton secundario" onClick={() => descargar(`${o.nombre}.md`, exportarNota(o))}>Exportar .md</button>
              <button className="boton peligro" onClick={() => confirm(`¿Borrar ${o.nombre}? Los personajes que lo tengan lo verán como objeto desconocido.`) && repo.borrarObjeto(o.id)}>Borrar</button>
            </div>
          </article>
        ))}
      </div>
      {editando && <EditorObjeto o={editando} alCerrar={() => setEditando(undefined)} alGuardar={async (o) => { await repo.guardarObjeto(o); setEditando(undefined) }} />}
    </div>
  )
}

const TIPOS_OBJ: ObjetoCampaña['tipo'][] = ['arma', 'armadura', 'escudo', 'maravilloso', 'anillo', 'varita', 'bastón', 'vara', 'poción', 'pergamino', 'otro']

function EditorObjeto({ o, alCerrar, alGuardar }: { o: ObjetoCampaña; alCerrar: () => void; alGuardar: (o: ObjetoCampaña) => void }) {
  const datos = useEstado((s) => s.datos)!
  const [x, setX] = useState<ObjetoCampaña>(structuredClone(o))
  const set = (p: Partial<ObjetoCampaña>) => setX({ ...x, ...p })
  const bases = useMemo(() => datos.objetos.filter((b) => (b.weapon || b.armor || String(b.type).startsWith('S|')) && !b.rarity?.match(/rare|uncommon|legendary|artifact/) && b.source === 'XPHB'), [datos])
  return (
    <Modal titulo={o.nombre || 'Nuevo objeto'} alCerrar={alCerrar} ancho="ancho">
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); alGuardar(x) }}>
        <label className="campo">Nombre<input required value={x.nombre} onChange={(e) => set({ nombre: e.target.value })} /></label>
        <div className="fila">
          <label className="campo">Tipo
            <select value={x.tipo} onChange={(e) => set({ tipo: e.target.value as ObjetoCampaña['tipo'] })}>{TIPOS_OBJ.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="campo">Rareza
            <select value={x.rareza} onChange={(e) => set({ rareza: e.target.value as ObjetoCampaña['rareza'] })}>{RAREZAS.map((r) => <option key={r} value={r}>{titulo(r)}</option>)}</select>
          </label>
          {['arma', 'armadura', 'escudo'].includes(x.tipo) && (
            <label className="campo">Objeto base
              <select value={x.base ?? ''} onChange={(e) => set({ base: e.target.value || undefined })}>
                <option value="">—</option>
                {bases.map((b) => <option key={b._clave} value={b._clave}>{b.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="fila">
          <label className="interruptor"><input type="checkbox" checked={x.sintonizacion} onChange={(e) => set({ sintonizacion: e.target.checked })} /> Requiere sintonización</label>
          {x.sintonizacion && <input placeholder="Requisito (by a Wizard…)" value={x.sintonizacionRequisito ?? ''} onChange={(e) => set({ sintonizacionRequisito: e.target.value || undefined })} />}
        </div>
        <div className="fila">
          <label className="interruptor"><input type="checkbox" checked={!!x.cargas} onChange={(e) => set({ cargas: e.target.checked ? { max: 3, recarga: 'amanecer' } : undefined })} /> Tiene cargas</label>
          {x.cargas && (
            <>
              <input type="number" min={1} value={x.cargas.max} onChange={(e) => set({ cargas: { ...x.cargas!, max: Number(e.target.value) || 1 } })} aria-label="Cargas máximas" />
              <select value={x.cargas.recarga} onChange={(e) => set({ cargas: { ...x.cargas!, recarga: e.target.value as 'amanecer' } })}>
                <option value="amanecer">Al amanecer</option><option value="largo">Long Rest</option><option value="corto">Short Rest</option><option value="nunca">No recarga</option>
              </select>
              <input placeholder="Recupera (1d3…)" value={x.cargas.recupera ?? ''} onChange={(e) => set({ cargas: { ...x.cargas!, recupera: e.target.value || undefined } })} />
            </>
          )}
        </div>
        <label className="campo">Descripción (lo que ven los jugadores)<textarea rows={5} value={x.descripcion} onChange={(e) => set({ descripcion: e.target.value })} /></label>
        <label className="campo">Secreto (solo DM)<textarea rows={2} value={x.secreto ?? ''} onChange={(e) => set({ secreto: e.target.value || undefined })} /></label>

        <h4>Efectos mecánicos</h4>
        <p className="sutil">Se aplican al personaje cuando el objeto está equipado (o sintonizado, si lo requiere).</p>
        {x.efectos.map((ef, i) => (
          <EditorEfecto key={i} e={ef} alCambiar={(n) => set({ efectos: x.efectos.map((y, j) => (j === i ? n : y)) })} alQuitar={() => set({ efectos: x.efectos.filter((_, j) => j !== i) })} />
        ))}
        <AñadirEfecto alAñadir={(ef) => set({ efectos: [...x.efectos, ef] })} />
        <div className="fila-botones">
          <button className="boton">Guardar</button>
          <button type="button" className="boton secundario" onClick={alCerrar}>Cancelar</button>
        </div>
      </form>
    </Modal>
  )
}

const PLANTILLAS: Record<string, Efecto> = {
  bono: { tipo: 'bono', objetivo: 'ca', valor: 1 },
  caracteristica: { tipo: 'caracteristica', car: 'str', valor: 2, max: 22 },
  fijarCaracteristica: { tipo: 'fijarCaracteristica', car: 'str', valor: 19 },
  resistencia: { tipo: 'resistencia', valor: 'fire' },
  inmunidad: { tipo: 'inmunidad', valor: 'poison' },
  inmunidadCondicion: { tipo: 'inmunidadCondicion', valor: 'charmed' },
  competencia: { tipo: 'competencia', categoria: 'habilidad', valor: 'perception' },
  pericia: { tipo: 'pericia', valor: 'perception' },
  conjuro: { tipo: 'conjuro', conjuro: 'misty step|xphb', usos: 1, recarga: 'largo' },
  ataque: { tipo: 'ataque', nombre: 'Rayo', dano: '2d6', tipoDano: 'lightning', car: 'dex', alcance: '60 ft' },
  velocidad: { tipo: 'velocidad', valor: 10 },
  sentido: { tipo: 'sentido', nombre: 'Darkvision', valor: 60 },
  recurso: { tipo: 'recurso', nombre: 'Usos especiales', usos: 1, recarga: 'largo' },
  caBase: { tipo: 'caBase', nombre: 'Piel de hierro', formula: '13+dex', sinArmadura: true, escudo: true },
  nota: { tipo: 'nota', texto: '' },
}
const NOMBRES_EFECTO: Record<string, string> = {
  bono: 'Bono (AC, ataque, salvaciones…)', caracteristica: 'Aumento de característica', fijarCaracteristica: 'Fijar característica', resistencia: 'Resistencia',
  inmunidad: 'Inmunidad a daño', inmunidadCondicion: 'Inmunidad a condición', competencia: 'Competencia', pericia: 'Expertise', conjuro: 'Conjuro',
  ataque: 'Ataque propio', velocidad: 'Velocidad', sentido: 'Sentido', recurso: 'Recurso con usos', caBase: 'AC base alternativa', nota: 'Nota',
}

function AñadirEfecto({ alAñadir }: { alAñadir: (e: Efecto) => void }) {
  const [t, setT] = useState('bono')
  return (
    <div className="fila">
      <select value={t} onChange={(e) => setT(e.target.value)}>{Object.keys(PLANTILLAS).map((k) => <option key={k} value={k}>{NOMBRES_EFECTO[k]}</option>)}</select>
      <button type="button" className="boton secundario" onClick={() => alAñadir(structuredClone(PLANTILLAS[t]))}>Añadir efecto</button>
    </div>
  )
}

const OBJETIVOS = ['ca', 'ataque', 'ataqueCuerpo', 'ataqueDistancia', 'dano', 'ataqueConjuro', 'cdConjuros', 'iniciativa', 'salvaciones', ...CARACTERISTICAS.map((c) => `salvacion:${c}`), 'pruebas', 'pgMax', 'pgPorNivel', 'percepcionPasiva']
const DANOS = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']

function EditorEfecto({ e, alCambiar, alQuitar }: { e: Efecto; alCambiar: (e: Efecto) => void; alQuitar: () => void }) {
  const datos = useEstado((s) => s.datos)!
  const [q, setQ] = useState('')
  const c = (p: Record<string, unknown>) => alCambiar({ ...e, ...p } as Efecto)
  const num = (v: string) => (/^-?\d+$/.test(v) ? Number(v) : v)
  const campo = (k: string, etq: string, tipo: 'texto' | 'numero' | 'formula' = 'formula') => (
    <label className="campo-mini">
      {etq}
      <input
        type={tipo === 'numero' ? 'number' : 'text'}
        value={String((e as Record<string, unknown>)[k] ?? '')}
        onChange={(ev) => c({ [k]: tipo === 'texto' ? ev.target.value : num(ev.target.value) })}
      />
    </label>
  )
  const sel = (k: string, etq: string, ops: string[]) => (
    <label className="campo-mini">
      {etq}
      <select value={String((e as Record<string, unknown>)[k] ?? '')} onChange={(ev) => c({ [k]: ev.target.value })}>
        {ops.map((o) => <option key={o} value={o}>{CARACTERISTICAS.includes(o as 'str') ? ABREV[o as 'str'] : o}</option>)}
      </select>
    </label>
  )
  const tipo = e.tipo as TipoEfecto
  return (
    <div className="editor-efecto">
      <b>{NOMBRES_EFECTO[tipo]}</b>
      <div className="fila">
        {tipo === 'bono' && <>{sel('objetivo', 'Sobre', OBJETIVOS)}{campo('valor', 'Valor (o fórmula: pb, wis…)')}{campo('condicion', 'Condición (opcional)', 'texto')}</>}
        {tipo === 'caracteristica' && <>{sel('car', 'Característica', CARACTERISTICAS)}{campo('valor', 'Aumento', 'numero')}{campo('max', 'Máximo', 'numero')}</>}
        {tipo === 'fijarCaracteristica' && <>{sel('car', 'Característica', CARACTERISTICAS)}{campo('valor', 'Valor', 'numero')}</>}
        {(tipo === 'resistencia' || tipo === 'inmunidad') && sel('valor', 'Tipo de daño', DANOS)}
        {tipo === 'inmunidadCondicion' && campo('valor', 'Condición', 'texto')}
        {tipo === 'competencia' && <>{sel('categoria', 'Categoría', ['habilidad', 'salvacion', 'herramienta', 'idioma', 'arma', 'armadura'])}{campo('valor', 'Valor (en inglés: perception, wis, martial…)', 'texto')}</>}
        {tipo === 'pericia' && sel('valor', 'Habilidad', datos.habilidades.map((h) => h.clave))}
        {tipo === 'conjuro' && (
          <>
            <label className="campo-mini">
              Conjuro
              <input list={`conj-${q}`} value={(e as { conjuro: string }).conjuro} onChange={(ev) => { setQ(ev.target.value.slice(0, 2)); c({ conjuro: ev.target.value }) }} />
              <datalist id={`conj-${q}`}>
                {datos.conjuros.filter((s) => normalizar(s.name).startsWith(normalizar(q))).slice(0, 50).map((s) => <option key={s._clave} value={s._clave}>{s.name}</option>)}
              </datalist>
            </label>
            {campo('usos', 'Usos (vacío: siempre preparado)')}
            {sel('recarga', 'Recarga', ['largo', 'corto', 'amanecer'])}
            {campo('cd', 'DC fija', 'numero')}
            {campo('ataque', 'Ataque fijo', 'numero')}
          </>
        )}
        {tipo === 'ataque' && <>{campo('nombre', 'Nombre', 'texto')}{campo('dano', 'Daño (2d6)', 'texto')}{sel('tipoDano', 'Tipo', DANOS)}{sel('car', 'Característica', [...CARACTERISTICAS, 'mejorFuerzaDestreza'])}{campo('bonoAtaque', 'Bono extra')}{campo('alcance', 'Alcance', 'texto')}</>}
        {tipo === 'velocidad' && <>{sel('modo', 'Tipo', ['andar', 'vuelo', 'nado', 'trepar', 'excavar'])}{campo('valor', 'ft (o «velocidad»)')}<label className="interruptor"><input type="checkbox" checked={!!(e as { fijar?: boolean }).fijar} onChange={(ev) => c({ fijar: ev.target.checked })} /> Fijar (en vez de sumar)</label></>}
        {tipo === 'sentido' && <>{campo('nombre', 'Sentido', 'texto')}{campo('valor', 'ft', 'numero')}</>}
        {tipo === 'recurso' && <>{campo('nombre', 'Nombre', 'texto')}{campo('usos', 'Usos (o fórmula)')}{sel('recarga', 'Recarga', ['largo', 'corto', 'amanecer', 'nunca'])}{campo('dado', 'Dado (opcional)', 'texto')}</>}
        {tipo === 'caBase' && <>{campo('nombre', 'Nombre', 'texto')}{campo('formula', 'Fórmula (13+dex)', 'texto')}<label className="interruptor"><input type="checkbox" checked={!!(e as { escudo?: boolean }).escudo} onChange={(ev) => c({ escudo: ev.target.checked })} /> Admite escudo</label></>}
        {tipo === 'nota' && campo('texto', 'Texto', 'texto')}
        <button type="button" className="boton-mini" onClick={alQuitar} aria-label="Quitar efecto">✕</button>
      </div>
      <small className="sutil">{describirEfecto(e)}</small>
    </div>
  )
}
