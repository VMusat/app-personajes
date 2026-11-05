import { useMemo, useState } from 'react'
import { useEstado } from '../../estado/store'
import { nuevoId, type ItemInventario } from '../../motor/personaje'
import { Buscador, Modal, Pestañas, normalizar } from '../comun'
import { MONEDAS, MONEDA_SETTING, NOMBRE_MONEDA, titulo } from '../glosario'
import { gastarMonedas, moverEn, sumarMonedas, valorTotal, type Cantidades } from '../../motor/monedas'
import { abrirDetalle } from '../Detalle'
import type { PropsPestaña } from './HojaPersonaje'
import { Entradas } from '../Entradas'
import type { Crudo } from '../../datos/tipos'

const MAX_SINTONIA = 3

export function PestañaInventario({ p, h, actualizar }: PropsPestaña) {
  const { datos, objetos } = useEstado()
  const [añadir, setAñadir] = useState(false)
  const [verCamp, setVerCamp] = useState<string>()
  const [arrastrando, setArrastrando] = useState<number>()
  const [encima, setEncima] = useState<number>()
  const mover = (de: number, a: number) => actualizar((x) => moverEn(x.inventario, de, a))
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
      <Monedero p={p} actualizar={actualizar} />

      <div className="fila-titulo">
        <h3>Objetos</h3>
        <span className="sutil">Sintonizados {h.sintonizados}/{MAX_SINTONIA} · Carga {Math.round(h.carga.peso)} / {h.carga.capacidad} lb</span>
        <button className="boton" onClick={() => setAñadir(true)}>Añadir objeto</button>
      </div>
      {h.sintonizados > MAX_SINTONIA && <p className="error">Más de {MAX_SINTONIA} objetos sintonizados.</p>}

      <ul className="lista-inventario">
        {p.inventario.map((it, i) => {
          const d = def(it)
          const tipo = String(d?.type ?? '').split('|')[0]
          const equipable = d && (d.weapon || d.armor || ['S', 'LA', 'MA', 'HA', 'RG', 'WD', 'RD', 'ST'].includes(tipo) || d.wondrous || d.campaña || d.baseItem)
          const requiere = !!d?.reqAttune
          return (
            <li
              key={it.id}
              className={[it.equipado || it.sintonizado ? 'activo' : '', arrastrando === i ? 'arrastrando' : '', encima === i && arrastrando !== i ? 'destino' : ''].join(' ')}
              onDragOver={(e) => { if (arrastrando !== undefined) { e.preventDefault(); setEncima(i) } }}
              onDrop={(e) => { e.preventDefault(); if (arrastrando !== undefined) mover(arrastrando, i); setArrastrando(undefined); setEncima(undefined) }}
            >
              <div className="inv-principal">
                <span
                  className="asa-mover"
                  draggable
                  onDragStart={(e) => { setArrastrando(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id) }}
                  onDragEnd={() => { setArrastrando(undefined); setEncima(undefined) }}
                  title="Arrastra para cambiar el orden"
                  aria-hidden
                >⠿</span>
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
                <span className="inv-orden">
                  <button className="boton-mini" disabled={i === 0} onClick={() => mover(i, i - 1)} aria-label={`Subir ${it.nombre}`} title="Subir">▲</button>
                  <button className="boton-mini" disabled={i === p.inventario.length - 1} onClick={() => mover(i, i + 1)} aria-label={`Bajar ${it.nombre}`} title="Bajar">▼</button>
                </span>
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

/** El dinero: se escribe cuánto entra o sale y se suma o se gasta (con cambio si hace falta). */
function Monedero({ p, actualizar }: Pick<PropsPestaña, 'p' | 'actualizar'>) {
  const [q, setQ] = useState<Record<string, string>>({})
  const nombreCorto = (m: (typeof MONEDAS)[number]) => MONEDA_SETTING[m]?.[1] ?? m.toUpperCase()
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean }>()
  const [aMano, setAMano] = useState(false)
  const cantidades: Cantidades = Object.fromEntries(MONEDAS.map((m) => [m, Math.max(0, parseInt(q[m] ?? '', 10) || 0)]))
  const hay = valorTotal(cantidades) > 0
  const resumen = MONEDAS.filter((m) => cantidades[m]).map((m) => `${cantidades[m]} ${nombreCorto(m)}`).join(', ')
  const aplicar = (gastar: boolean) => {
    if (!hay) return
    if (gastar && valorTotal(cantidades) > valorTotal(p.monedas)) {
      setAviso({ texto: 'No tienes dinero suficiente.', error: true })
      return
    }
    actualizar((x) => {
      if (gastar) gastarMonedas(x.monedas, cantidades)
      else sumarMonedas(x.monedas, cantidades)
    })
    setAviso({ texto: `${gastar ? 'Gastado' : 'Añadido'}: ${resumen}.` })
    setQ({})
  }
  const total = valorTotal(p.monedas) / 100
  return (
    <section className="monedero">
      <div className="monedas">
        {MONEDAS.map((m) => (
          <div key={m} className="moneda">
            <span>{NOMBRE_MONEDA[m]}</span>
            {aMano ? (
              <input type="number" min={0} value={p.monedas[m]} onChange={(e) => actualizar((x) => void (x.monedas[m] = Math.max(0, Number(e.target.value) || 0)))} />
            ) : (
              <b className="moneda-valor">{p.monedas[m]}</b>
            )}
          </div>
        ))}
        <div className="moneda total">
          <span>En total</span>
          <b className="moneda-valor">{total.toLocaleString('es', { maximumFractionDigits: 2 })} aros</b>
        </div>
      </div>
      <form
        className="monedas-cambio"
        onSubmit={(e) => {
          e.preventDefault()
          aplicar(false)
        }}
      >
        {MONEDAS.map((m) => (
          <label key={m} className="campo-moneda">
            <span>{nombreCorto(m)}</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={q[m] ?? ''}
              onChange={(e) => { setQ({ ...q, [m]: e.target.value.replace(/\D/g, '') }); setAviso(undefined) }}
              aria-label={`Cantidad de ${NOMBRE_MONEDA[m]}`}
            />
          </label>
        ))}
        <div className="monedas-botones">
          <button type="submit" className="boton exito" disabled={!hay}>+ Añadir</button>
          <button type="button" className="boton peligro" disabled={!hay} onClick={() => aplicar(true)}>− Gastar</button>
        </div>
      </form>
      <div className="fila monedas-pie">
        {aviso ? <span className={aviso.error ? 'error' : 'sutil'}>{aviso.texto}</span> : <span className="sutil">Si no tienes monedas de un tipo, se paga con otras y se te da el cambio.</span>}
        <button className="boton-mini" onClick={() => setAMano(!aMano)}>{aMano ? 'Hecho' : 'Corregir a mano'}</button>
      </div>
      {(p.monedas.ep ?? 0) > 0 && (
        <p className="aviso-texto">
          Tienes {p.monedas.ep} EP, que ya no se usan.{' '}
          <button className="boton-mini" onClick={() => actualizar((x) => void ((x.monedas.sp += 5 * (x.monedas.ep ?? 0)), delete x.monedas.ep))}>Cambiar por {5 * p.monedas.ep!} estrellas</button>
        </p>
      )}
    </section>
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
