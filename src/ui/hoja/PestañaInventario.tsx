import { useMemo, useState } from 'react'
import { useEstado } from '../../estado/store'
import { nuevoId, type ItemInventario } from '../../motor/personaje'
import { Buscador, Modal, Pestañas, normalizar } from '../comun'
import { MONEDAS, NOMBRE_MONEDA, titulo } from '../glosario'
import { abrirDetalle } from '../Detalle'
import type { PropsPestaña } from './HojaPersonaje'
import { Entradas } from '../Entradas'
import type { Crudo } from '../../datos/tipos'

const MAX_SINTONIA = 3

export function PestañaInventario({ p, h, actualizar }: PropsPestaña) {
  const { datos, objetos } = useEstado()
  const [añadir, setAñadir] = useState(false)
  const [verCamp, setVerCamp] = useState<string>()
  const def = (it: ItemInventario): Crudo | undefined =>
    it.origen === '5etools' ? datos?.objetos.find((o) => o._clave === it.ref) : it.origen === 'campaña' ? (() => {
      const c = objetos.find((o) => o.id === it.ref)
      return c ? { ...c, reqAttune: c.sintonizacion, campaña: true } : undefined
    })() : undefined

  const cambiar = (id: string, f: (it: ItemInventario) => void) =>
    actualizar((x) => {
      const it = x.inventario.find((i) => i.id === id)
      if (it) f(it)
    })

  return (
    <div className="pestaña-inventario">
      <section className="monedas">
        {MONEDAS.map((m) => (
          <label key={m} className="moneda">
            {NOMBRE_MONEDA[m]}
            <input type="number" min={0} value={p.monedas[m]} onChange={(e) => actualizar((x) => void (x.monedas[m] = Math.max(0, Number(e.target.value) || 0)))} />
          </label>
        ))}
      </section>

      <div className="fila-titulo">
        <h3>Objetos</h3>
        <span className="sutil">Sintonizados {h.sintonizados}/{MAX_SINTONIA} · Carga {Math.round(h.carga.peso)} / {h.carga.capacidad} lb</span>
        <button className="boton" onClick={() => setAñadir(true)}>Añadir objeto</button>
      </div>
      {h.sintonizados > MAX_SINTONIA && <p className="error">Más de {MAX_SINTONIA} objetos sintonizados.</p>}

      <ul className="lista-inventario">
        {p.inventario.map((it) => {
          const d = def(it)
          const tipo = String(d?.type ?? '').split('|')[0]
          const equipable = d && (d.weapon || d.armor || ['S', 'LA', 'MA', 'HA', 'RG', 'WD', 'RD', 'ST'].includes(tipo) || d.wondrous || d.campaña || d.baseItem)
          const requiere = !!d?.reqAttune
          return (
            <li key={it.id} className={it.equipado || it.sintonizado ? 'activo' : ''}>
              <div className="inv-principal">
                <button
                  className="enlace"
                  onClick={() => (it.origen === '5etools' && it.ref ? abrirDetalle({ tipo: 'objeto', clave: it.ref }) : it.origen === 'campaña' ? setVerCamp(it.ref) : undefined)}
                >
                  {it.nombre}
                </button>
                {it.origen === 'campaña' && <span className="insignia campaña">Campaña</span>}
                {d?.rarity && d.rarity !== 'none' && <small className="sutil"> {titulo(d.rarity)}</small>}
              </div>
              <div className="inv-controles">
                <span className="contador">
                  <button className="boton-mini" onClick={() => cambiar(it.id, (x) => void (x.cantidad = Math.max(0, x.cantidad - 1)))}>−</button>
                  <span>{it.cantidad}</span>
                  <button className="boton-mini" onClick={() => cambiar(it.id, (x) => void (x.cantidad += 1))}>+</button>
                </span>
                {equipable && (
                  <label className="interruptor pequeño"><input type="checkbox" checked={!!it.equipado} onChange={(e) => cambiar(it.id, (x) => void (x.equipado = e.target.checked))} /> Equipado</label>
                )}
                {requiere && (
                  <label className="interruptor pequeño">
                    <input type="checkbox" checked={!!it.sintonizado} disabled={!it.sintonizado && h.sintonizados >= MAX_SINTONIA} onChange={(e) => cambiar(it.id, (x) => void (x.sintonizado = e.target.checked))} /> Sintonizado
                  </label>
                )}
                <button className="boton-mini" aria-label="Quitar" onClick={() => confirm(`¿Quitar ${it.nombre}?`) && actualizar((x) => void (x.inventario = x.inventario.filter((i) => i.id !== it.id)))}>✕</button>
              </div>
              <input className="inv-notas" placeholder="Notas" value={it.notas ?? ''} onChange={(e) => cambiar(it.id, (x) => void (x.notas = e.target.value))} />
            </li>
          )
        })}
      </ul>
      {p.inventario.length === 0 && <p className="sutil">El inventario está vacío.</p>}
      <p className="sutil">Los objetos mágicos aplican sus efectos (CA, bonos, conjuros, cargas) cuando están equipados, o sintonizados si lo requieren.</p>

      {añadir && <ModalAñadir alCerrar={() => setAñadir(false)} añadir={(it) => actualizar((x) => void x.inventario.push(it))} />}
      {verCamp && (() => {
        const o = objetos.find((x) => x.id === verCamp)
        return o ? (
          <Modal titulo={o.nombre} alCerrar={() => setVerCamp(undefined)}>
            <p className="sutil">{titulo(o.rareza)}{o.sintonizacion ? ` · requires attunement${o.sintonizacionRequisito ? ` ${o.sintonizacionRequisito}` : ''}` : ''}</p>
            <Entradas entries={o.descripcion.split('\n').filter(Boolean)} />
          </Modal>
        ) : null
      })()}
    </div>
  )
}

function ModalAñadir({ alCerrar, añadir }: { alCerrar: () => void; añadir: (it: ItemInventario) => void }) {
  const { datos, objetos } = useEstado()
  const [pest, setPest] = useState<'5e' | 'camp' | 'libre'>('5e')
  const [q, setQ] = useState('')
  const [soloMagicos, setSoloMagicos] = useState(false)
  const lista = useMemo(() => {
    if (!datos) return []
    const n = normalizar(q)
    return datos.objetos
      .filter((o) => (!soloMagicos || (o.rarity && o.rarity !== 'none')) && (!n || normalizar(o.name).includes(n)))
      .slice(0, 80)
  }, [datos, q, soloMagicos])
  const [libre, setLibre] = useState({ nombre: '', cantidad: 1, peso: 0, notas: '' })

  return (
    <Modal titulo="Añadir objeto" alCerrar={alCerrar} ancho="ancho">
      <Pestañas
        valor={pest}
        alCambiar={setPest}
        opciones={[
          { id: '5e', texto: 'Reglas (5etools)' },
          { id: 'camp', texto: `Objetos de la campaña (${objetos.length})` },
          { id: 'libre', texto: 'Objeto libre' },
        ]}
      />
      {pest === '5e' && (
        <>
          <div className="fila">
            <Buscador valor={q} alCambiar={setQ} texto="Buscar objeto (en inglés: Longsword, Potion of Healing…)" />
            <label className="interruptor"><input type="checkbox" checked={soloMagicos} onChange={(e) => setSoloMagicos(e.target.checked)} /> Solo mágicos</label>
          </div>
          <ul className="lista-busqueda">
            {lista.map((o) => (
              <li key={o._clave}>
                <button className="enlace" onClick={() => abrirDetalle({ tipo: 'objeto', clave: o._clave })}>{o.name}</button>
                <small className="sutil"> {o.rarity && o.rarity !== 'none' ? titulo(o.rarity) : ''} {o.value ? `${o.value / 100} GP` : ''} · {o.source}</small>
                <button className="boton-mini" onClick={() => { añadir({ id: nuevoId(), origen: '5etools', ref: o._clave, nombre: o.name, cantidad: 1 }); alCerrar() }}>Añadir</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {pest === 'camp' && (
        <ul className="lista-busqueda">
          {objetos.length === 0 && <p className="sutil">El DM todavía no ha creado objetos de la campaña.</p>}
          {objetos.map((o) => (
            <li key={o.id}>
              <b>{o.nombre}</b>
              <small className="sutil"> {titulo(o.rareza)}{o.sintonizacion ? ' · sintonización' : ''}</small>
              <button className="boton-mini" onClick={() => { añadir({ id: nuevoId(), origen: 'campaña', ref: o.id, nombre: o.nombre, cantidad: 1 }); alCerrar() }}>Añadir</button>
            </li>
          ))}
        </ul>
      )}
      {pest === 'libre' && (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault()
            añadir({ id: nuevoId(), origen: 'libre', nombre: libre.nombre, cantidad: libre.cantidad, peso: libre.peso || undefined, notas: libre.notas })
            alCerrar()
          }}
        >
          <label className="campo">Nombre<input required value={libre.nombre} onChange={(e) => setLibre({ ...libre, nombre: e.target.value })} /></label>
          <label className="campo">Cantidad<input type="number" min={1} value={libre.cantidad} onChange={(e) => setLibre({ ...libre, cantidad: Number(e.target.value) || 1 })} /></label>
          <label className="campo">Peso (lb)<input type="number" min={0} step={0.1} value={libre.peso} onChange={(e) => setLibre({ ...libre, peso: Number(e.target.value) || 0 })} /></label>
          <label className="campo">Notas<textarea value={libre.notas} onChange={(e) => setLibre({ ...libre, notas: e.target.value })} /></label>
          <button className="boton">Añadir</button>
        </form>
      )}
    </Modal>
  )
}
