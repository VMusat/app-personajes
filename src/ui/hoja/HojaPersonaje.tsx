// Hoja de personaje para jugar: estado vital, pestañas y descansos.
import { useMemo, useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { usePersonaje } from '../usePersonaje'
import { derivar, type Hoja } from '../../motor/derivar'
import type { Personaje } from '../../motor/personaje'
import { Contador, Modal, Pestañas } from '../comun'
import { CONDICIONES, conSigno } from '../glosario'
import { resumenPersonaje } from '../Inicio'
import { PestañaCombate } from './PestañaCombate'
import { PestañaHabilidades } from './PestañaHabilidades'
import { PestañaConjuros } from './PestañaConjuros'
import { PestañaInventario } from './PestañaInventario'
import { PestañaRasgos } from './PestañaRasgos'
import { PestañaNotas } from './PestañaNotas'
import { PestañaElecciones } from './PestañaElecciones'
import { exportarJSON, exportarObsidian } from './exportar'
import { aspectoEsInvertido } from '../../motor/resolver'

export type Act = (f: (p: Personaje) => void) => void
export type PropsPestaña = { p: Personaje; h: Hoja; actualizar: Act }

type IdPestaña = 'combate' | 'habilidades' | 'conjuros' | 'inventario' | 'rasgos' | 'notas' | 'elecciones'

export function HojaPersonaje({ id, pestañaInicial }: { id: string; pestañaInicial?: string }) {
  const [p, actualizar, guardando] = usePersonaje(id)
  const { datos, objetos, repo, usuario } = useEstado()
  const [pestaña, setPestaña] = useState<IdPestaña>((pestañaInicial as IdPestaña) ?? 'combate')
  const [descanso, setDescanso] = useState<'corto' | 'largo'>()
  const [menu, setMenu] = useState(false)
  const h = useMemo(() => {
    if (!p || !datos) return undefined
    try {
      return derivar(p, datos, objetos)
    } catch (e) {
      console.error(e)
      return undefined
    }
  }, [p, datos, objetos])
  if (!p || !datos) return <p className="pantalla-centro">Personaje no encontrado.</p>
  if (!h) return <p className="pantalla-centro">No se pudo calcular la hoja. Revisa las elecciones del personaje.</p>

  const pendientes = h.resolucion.elecciones.filter((e) => !e.completa && (e.opciones.length > 0 || e.tipo === 'aumento' || e.tipo === 'pg'))
  const tieneConjuros = h.conjuros.length > 0
  const pestañas = [
    { id: 'combate' as const, texto: 'Combate' },
    { id: 'habilidades' as const, texto: 'Habilidades' },
    ...(tieneConjuros ? [{ id: 'conjuros' as const, texto: 'Conjuros' }] : []),
    { id: 'inventario' as const, texto: 'Inventario' },
    { id: 'rasgos' as const, texto: 'Rasgos' },
    { id: 'notas' as const, texto: 'Notas' },
    { id: 'elecciones' as const, texto: `Elecciones${pendientes.length ? ` (${pendientes.length})` : ''}` },
  ]
  const props = { p, h, actualizar }
  const puedeEditar = repo?.modo === 'local' || p.propietario === usuario?.uid || repo?.esDM()

  return (
    <div className="hoja">
      <header className="cabecera-hoja">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>←</button>
        <div className="nombre-hoja">
          <h1>{p.nombre}</h1>
          <p className="sutil">
            {resumenPersonaje(p, datos)} · Nivel {h.nivel}
            {p.aspecto && <> · <span className={aspectoEsInvertido(p.aspecto) ? 'aspecto-inv' : 'aspecto-nombre'}>{p.aspecto}</span></>}
          </p>
        </div>
        <div className="acciones-hoja">
          <span className="sutil guardado">{guardando ? 'Guardando…' : ''}</span>
          {puedeEditar && (
            <>
              <button className="boton secundario" onClick={() => setDescanso('corto')}>Descanso corto</button>
              <button className="boton secundario" onClick={() => setDescanso('largo')}>Descanso largo</button>
              <button className="boton" disabled={h.nivel >= 20} onClick={() => ir({ tipo: 'nivel', id })}>Subir de nivel</button>
            </>
          )}
          <button className="boton-icono" onClick={() => setMenu(!menu)} aria-label="Más opciones">⋮</button>
          {menu && (
            <div className="menu" onClick={() => setMenu(false)}>
              <button onClick={() => exportarObsidian(p, h, datos)}>Exportar nota para Obsidian</button>
              <button onClick={() => exportarJSON(p)}>Copia de seguridad (JSON)</button>
              <button onClick={() => ir({ tipo: 'crear', id })}>Volver al asistente de creación</button>
              {puedeEditar && (
                <button
                  className="peligro"
                  onClick={async () => {
                    if (confirm(`¿Borrar a ${p.nombre} para siempre? No se puede deshacer.`)) {
                      await repo?.borrarPersonaje(p.id)
                      ir({ tipo: 'inicio' })
                    }
                  }}
                >
                  Borrar personaje
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {pendientes.length > 0 && (
        <button className="aviso-banda" onClick={() => setPestaña('elecciones')}>
          Hay {pendientes.length} elecciones pendientes. Pulsa para completarlas.
        </button>
      )}

      <BarraVital {...props} />

      <Pestañas valor={pestaña} opciones={pestañas} alCambiar={setPestaña} />
      <div className="pestaña-cuerpo">
        {pestaña === 'combate' && <PestañaCombate {...props} />}
        {pestaña === 'habilidades' && <PestañaHabilidades {...props} />}
        {pestaña === 'conjuros' && <PestañaConjuros {...props} />}
        {pestaña === 'inventario' && <PestañaInventario {...props} />}
        {pestaña === 'rasgos' && <PestañaRasgos {...props} />}
        {pestaña === 'notas' && <PestañaNotas {...props} />}
        {pestaña === 'elecciones' && <PestañaElecciones {...props} />}
      </div>

      {descanso && <ModalDescanso tipo={descanso} {...props} alCerrar={() => setDescanso(undefined)} />}
    </div>
  )
}

function BarraVital({ p, h, actualizar }: PropsPestaña) {
  const tirar = useEstado((s) => s.tirar)
  const [cantidad, setCantidad] = useState('')
  const [condiciones, setCondiciones] = useState(false)
  const hp = p.estado.pgActuales ?? h.pgMax
  const n = Math.max(0, parseInt(cantidad, 10) || 0)
  const daño = () =>
    actualizar((x) => {
      let resto = n
      const temp = x.estado.pgTemporales
      if (temp) {
        const absorbe = Math.min(temp, resto)
        x.estado.pgTemporales -= absorbe
        resto -= absorbe
      }
      x.estado.pgActuales = Math.max(0, (x.estado.pgActuales ?? h.pgMax) - resto)
      setCantidad('')
    })
  const curar = () =>
    actualizar((x) => {
      x.estado.pgActuales = Math.min(h.pgMax, (x.estado.pgActuales ?? h.pgMax) + n)
      if (x.estado.pgActuales > 0) x.estado.salvacionesMuerte = { exitos: 0, fallos: 0 }
      setCantidad('')
    })
  const temporales = () => actualizar((x) => void ((x.estado.pgTemporales = Math.max(x.estado.pgTemporales, n)), setCantidad('')))
  const pct = Math.max(0, Math.min(100, (100 * hp) / h.pgMax))

  return (
    <section className="barra-vital">
      <div className="bloque-hp">
        <div className="hp-numeros">
          <span className="etq">HP</span>
          <b className={hp === 0 ? 'error' : ''}>{hp}</b>
          <span>/ {h.pgMax}</span>
          {p.estado.pgTemporales > 0 && <span className="temp">+{p.estado.pgTemporales} temp</span>}
        </div>
        <div className="hp-barra"><div style={{ width: `${pct}%` }} className={pct < 25 ? 'baja' : pct < 50 ? 'media' : ''} /></div>
        <div className="fila hp-acciones">
          <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Cantidad" />
          <button className="boton peligro" disabled={!n} onClick={daño}>Daño</button>
          <button className="boton exito" disabled={!n} onClick={curar}>Curar</button>
          <button className="boton secundario" disabled={!n} onClick={temporales}>Temp</button>
        </div>
      </div>

      <div className="stats-grandes">
        <div title={h.ca.detalle}><span>AC</span><b>{h.ca.valor}</b></div>
        <button onClick={() => tirar({ etiqueta: 'Iniciativa', formula: `1d20${conSigno(h.iniciativa + h.penalizacionD20)}`, d20: true, personaje: p.nombre })}>
          <span>Iniciativa</span><b>{conSigno(h.iniciativa)}</b>
        </button>
        <div><span>Velocidad</span><b>{h.velocidad.andar} ft</b></div>
        <div><span>PB</span><b>{conSigno(h.pb)}</b></div>
        <button className={p.estado.inspiracion ? 'activo' : ''} onClick={() => actualizar((x) => void (x.estado.inspiracion = !x.estado.inspiracion))} title="Heroic Inspiration">
          <span>Inspiración</span><b>{p.estado.inspiracion ? '★' : '☆'}</b>
        </button>
      </div>

      {hp === 0 && (
        <div className="salvaciones-muerte">
          <b>Death saves</b>
          <span>Éxitos <Contador valor={p.estado.salvacionesMuerte.exitos} max={3} alCambiar={(v) => actualizar((x) => void (x.estado.salvacionesMuerte.exitos = v))} /></span>
          <span>Fallos <Contador valor={p.estado.salvacionesMuerte.fallos} max={3} alCambiar={(v) => actualizar((x) => void (x.estado.salvacionesMuerte.fallos = v))} /></span>
          <button
            className="boton"
            onClick={() =>
              tirar({
                etiqueta: 'Salvación de muerte',
                formula: '1d20',
                d20: true,
                personaje: p.nombre,
                alTerminar: (r) =>
                  actualizar((x) => {
                    const s = x.estado.salvacionesMuerte
                    if (r.natural === 20) {
                      x.estado.pgActuales = 1
                      x.estado.salvacionesMuerte = { exitos: 0, fallos: 0 }
                    } else if (r.natural === 1) s.fallos = Math.min(3, s.fallos + 2)
                    else if (r.total >= 10) s.exitos = Math.min(3, s.exitos + 1)
                    else s.fallos = Math.min(3, s.fallos + 1)
                  }),
              })
            }
          >
            Tirar
          </button>
        </div>
      )}

      <div className="estado-fila">
        <button className="chip" onClick={() => setCondiciones(true)}>Condiciones{p.estado.condiciones.length ? `: ${p.estado.condiciones.join(', ')}` : ''}</button>
        <span className="chip">
          Exhaustion
          <select value={p.estado.agotamiento} onChange={(e) => actualizar((x) => void (x.estado.agotamiento = Number(e.target.value)))}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </span>
        <span className="chip disolucion" title="Reglas de la miasma: niveles de Disolución">
          Disolución
          <select value={p.estado.disolucion} onChange={(e) => actualizar((x) => void (x.estado.disolucion = Number(e.target.value)))}>
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </span>
        {p.estado.concentracion && (
          <button className="chip concentracion" onClick={() => actualizar((x) => void (x.estado.concentracion = undefined))} title="Terminar concentración">
            Concentrando: {p.estado.concentracion} ✕
          </button>
        )}
      </div>
      {condiciones && (
        <Modal titulo="Condiciones" alCerrar={() => setCondiciones(false)}>
          <div className="rejilla-condiciones">
            {CONDICIONES.map((c) => (
              <label key={c} className="interruptor">
                <input
                  type="checkbox"
                  checked={p.estado.condiciones.includes(c)}
                  onChange={(e) => actualizar((x) => void (x.estado.condiciones = e.target.checked ? [...x.estado.condiciones, c] : x.estado.condiciones.filter((k) => k !== c)))}
                />
                {c}
              </label>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}

function ModalDescanso({ tipo, p, h, actualizar, alCerrar }: PropsPestaña & { tipo: 'corto' | 'largo'; alCerrar: () => void }) {
  const tirar = useEstado((s) => s.tirar)
  const [fueraMiasma, setFueraMiasma] = useState(true)
  const [amanecer, setAmanecer] = useState(true)
  const conMod = h.car.con.mod

  const aplicar = () => {
    actualizar((x) => {
      const g = x.estado.gastados
      for (const r of h.recursos) {
        // Los objetos que recargan al amanecer solo se recuperan en el descanso largo si se marca
        if (tipo === 'largo' || r.recarga === 'corto') delete g[r.id]
        else if (tipo === 'corto' && r.recargaCorta) g[r.id] = Math.max(0, (g[r.id] ?? 0) - r.recargaCorta)
      }
      if (tipo === 'largo' && !amanecer) for (const r of h.recursos) if (r.recarga === 'amanecer' && p.estado.gastados[r.id]) g[r.id] = p.estado.gastados[r.id]
      delete g.pacto
      if (tipo === 'largo') {
        for (let n = 1; n <= 9; n++) delete g[`espacio:${n}`]
        x.estado.pgActuales = h.pgMax
        x.estado.pgTemporales = 0
        x.estado.dadosGolpeGastados = {}
        x.estado.salvacionesMuerte = { exitos: 0, fallos: 0 }
        x.estado.agotamiento = Math.max(0, x.estado.agotamiento - 1)
        if (fueraMiasma) x.estado.disolucion = Math.max(0, x.estado.disolucion - 1)
        x.estado.concentracion = undefined
      }
    })
    alCerrar()
  }

  return (
    <Modal titulo={tipo === 'corto' ? 'Descanso corto' : 'Descanso largo'} alCerrar={alCerrar}>
      {tipo === 'corto' ? (
        <>
          <p>Gasta Hit Dice para recuperar HP (cada dado + {conSigno(conMod)} CON). Se recuperan los recursos de descanso corto y los espacios de pacto.</p>
          {h.dadosGolpe.map((d) => {
            const gastados = p.estado.dadosGolpeGastados[d.caras] ?? 0
            return (
              <div key={d.caras} className="fila">
                <span>d{d.caras}: {d.total - gastados} de {d.total}</span>
                <button
                  className="boton"
                  disabled={gastados >= d.total}
                  onClick={() =>
                    tirar({
                      etiqueta: `Hit Die (d${d.caras})`,
                      formula: `1d${d.caras}${conMod ? conSigno(conMod) : ''}`,
                      personaje: p.nombre,
                      alTerminar: (r) =>
                        actualizar((x) => {
                          x.estado.dadosGolpeGastados[d.caras] = (x.estado.dadosGolpeGastados[d.caras] ?? 0) + 1
                          x.estado.pgActuales = Math.min(h.pgMax, (x.estado.pgActuales ?? h.pgMax) + Math.max(1, r.total))
                        }),
                    })
                  }
                >
                  Gastar y tirar
                </button>
              </div>
            )
          })}
        </>
      ) : (
        <>
          <p>Recuperas todos los HP, los Hit Dice, los espacios de conjuro y los recursos. El Exhaustion baja un nivel.</p>
          <label className="interruptor"><input type="checkbox" checked={fueraMiasma} onChange={(e) => setFueraMiasma(e.target.checked)} /> Fuera de la miasma (quita un nivel de Disolución)</label>
          <label className="interruptor"><input type="checkbox" checked={amanecer} onChange={(e) => setAmanecer(e.target.checked)} /> Ha amanecido (recargan los objetos «al amanecer»)</label>
        </>
      )}
      <div className="fila-botones">
        <button className="boton" onClick={aplicar}>Terminar descanso</button>
      </div>
    </Modal>
  )
}
