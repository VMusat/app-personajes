// Subida de nivel: se añade un nivel de clase y el asistente pide todas las elecciones nuevas
// (HP, subclase, dotes, conjuros, invocaciones, pericias...). No se puede confirmar con elecciones pendientes.
import { useMemo, useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { usePersonaje } from '../usePersonaje'
import { resolver } from '../../motor/resolver'
import { derivar } from '../../motor/derivar'
import { claveRasgoClase } from '../../datos/refs'
import { Entradas } from '../Entradas'
import { ListaElecciones } from './Creador'
import type { Clase, Datos } from '../../datos/tipos'
import type { Personaje } from '../../motor/personaje'
import { ABREV } from '../glosario'

/** Requisitos de multiclase de 2024: 13 en la característica principal de la clase. */
function cumpleMulticlase(c: Clase, valores: Record<string, number>): boolean {
  const req = c.multiclassing?.requirements ?? (c.primaryAbility ? { or: c.primaryAbility } : undefined)
  if (!req) return true
  if (req.or) return (req.or as Record<string, boolean | number>[]).some((o) => Object.keys(o).every((k) => (valores[k] ?? 0) >= 13))
  return Object.entries(req).every(([k, v]) => (valores[k] ?? 0) >= (typeof v === 'number' ? v : 13))
}

export function SubirNivel({ id }: { id: string }) {
  const [p, actualizar] = usePersonaje(id)
  const { datos, objetos } = useEstado()
  const [nivelInicial, setNivelInicial] = useState(() => p?.niveles.length ?? 0)
  const [hpInicial, setHpInicial] = useState(() => (p && datos ? safeDerivar(p, datos)?.pgMax : undefined))
  const res = useMemo(() => (p && datos ? resolver(p, datos) : undefined), [p, datos])
  if (!p || !datos || !res) return <p className="pantalla-centro">Personaje no encontrado.</p>

  const nivelNuevo = p.niveles.length
  const añadido = nivelNuevo > nivelInicial
  const hoja = safeDerivar(p, datos, objetos)
  const valores = Object.fromEntries(Object.entries(hoja?.car ?? {}).map(([k, v]) => [k, v.valor]))
  const clasesActuales = [...new Set(p.niveles.map((n) => n.clase))]
  const fijar = (eid: string, v: string[]) => actualizar((x) => void (x.elecciones[eid] = v))
  // Elecciones del nivel nuevo y cualquier otra que se haya quedado pendiente
  const elecciones = res.elecciones.filter((e) => (e.nivel === nivelNuevo && añadido) || (!e.completa && (e.opciones.length > 0 || e.tipo === 'aumento' || e.tipo === 'pg')))
  const pendientes = elecciones.filter((e) => !e.completa && (e.opciones.length > 0 || e.tipo === 'aumento' || e.tipo === 'pg'))

  const añadir = (clase: string) => actualizar((x) => void x.niveles.push({ clase }))
  const deshacer = () => actualizar((x) => void x.niveles.pop())
  const confirmar = (otro: boolean) => {
    const nuevo = safeDerivar(p, datos, objetos)
    if (nuevo && hpInicial !== undefined) {
      actualizar((x) => void (x.estado.pgActuales = Math.min(nuevo.pgMax, (x.estado.pgActuales ?? hpInicial) + (nuevo.pgMax - hpInicial))))
    }
    if (otro) {
      setNivelInicial(p.niveles.length)
      setHpInicial(nuevo?.pgMax)
      window.scrollTo(0, 0)
    } else ir({ tipo: 'hoja', id })
  }

  const claseNueva = añadido ? datos.clases.find((c) => c._clave === p.niveles[nivelNuevo - 1].clase) : undefined
  const nivelClase = claseNueva ? p.niveles.filter((n) => n.clase === claseNueva._clave).length : 0

  return (
    <div className="subir-nivel">
      <header className="cabecera-app">
        <button className="boton secundario" onClick={() => { if (añadido) deshacer(); ir({ tipo: 'hoja', id }) }}>← Cancelar</button>
        <h2>{p.nombre}: subir a nivel {añadido ? nivelNuevo : nivelInicial + 1}</h2>
      </header>

      {!añadido && (
        <section>
          <h3>¿En qué clase sube?</h3>
          {nivelInicial >= 20 && <p>Ya está a nivel 20.</p>}
          <div className="rejilla-tarjetas">
            {datos.clases.map((c) => {
              const tiene = clasesActuales.includes(c._clave)
              const puede = tiene || (cumpleMulticlase(c, valores) && clasesActuales.every((k) => cumpleMulticlase(datos.clases.find((x) => x._clave === k)!, valores)))
              if (!tiene && nivelInicial === 0) return null
              return (
                <button key={c._clave} className={`tarjeta-eleccion tarjeta-boton ${tiene ? 'elegida' : ''}`} disabled={!puede || nivelInicial >= 20} onClick={() => añadir(c._clave)}>
                  <h3>{c._nombre} {tiene && <small>(nivel {p.niveles.filter((n) => n.clase === c._clave).length + 1})</small>}</h3>
                  {!tiene && <p className="sutil">{puede ? 'Multiclase' : `Requiere 13 en ${requisitoTexto(c)}`}</p>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {añadido && claseNueva && (
        <>
          <section>
            <h3>Rasgos nuevos de {claseNueva._nombre} {nivelClase}</h3>
            <RasgosNivel clase={claseNueva} nivel={nivelClase} p={p} datos={datos} />
            {res.rasgos
              .filter((r) => r.nivel === nivelNuevo && r.tipo === 'marca')
              .map((r) => (
                <details key={r.nombre} open className="rasgo-marca">
                  <summary>{r.nombre} <small className="sutil">({r.origen})</small></summary>
                  <Entradas entries={r.entries} />
                </details>
              ))}
          </section>
          <section>
            <h3>Elecciones</h3>
            <ListaElecciones elecciones={elecciones} p={p} datos={datos} fijar={fijar} />
          </section>
          <footer className="pie-pasos">
            <button className="boton secundario" onClick={deshacer}>Deshacer este nivel</button>
            <span className={pendientes.length ? 'error' : 'ok'}>{pendientes.length ? `Faltan ${pendientes.length} elecciones` : 'Todo elegido'}</span>
            <button className="boton secundario" disabled={pendientes.length > 0 || nivelNuevo >= 20} onClick={() => confirmar(true)}>Confirmar y subir otro</button>
            <button className="boton" disabled={pendientes.length > 0} onClick={() => confirmar(false)}>Confirmar</button>
          </footer>
        </>
      )}
    </div>
  )
}

function requisitoTexto(c: Clase): string {
  const pa = (c.primaryAbility ?? []) as Record<string, boolean>[]
  return pa.map((o) => Object.keys(o).map((k) => ABREV[k as 'str']).join(' y ')).join(' o ')
}

function safeDerivar(p: Personaje, d: Datos, objetos = useEstado.getState().objetos) {
  try {
    return derivar(p, d, objetos)
  } catch {
    return undefined
  }
}

function RasgosNivel({ clase, nivel, p, datos }: { clase: Clase; nivel: number; p: Personaje; datos: Datos }) {
  const refs = clase.classFeatures.map((cf) => (typeof cf === 'string' ? cf : cf.classFeature)).filter((r) => Number(r.split('|')[3]) === nivel)
  const sub = datos.subclases.find((s) => s._clave === p.elecciones[`cls:${clase.name}:sub`]?.[0])
  const refsSub = sub ? sub.subclassFeatures.filter((r) => Number(r.split('|')[5]) === nivel) : []
  return (
    <div className="rasgos-nivel">
      {refs.map((r) => {
        const x = datos.rasgos[claveRasgoClase(r)]
        return x ? <details key={r} open={refs.length < 3}><summary>{x.name}</summary><Entradas entries={x.entries} /></details> : null
      })}
      {refsSub.map((r) => {
        const [n, c, cs, sc, ss, nv, f] = r.split('|')
        const x = datos.rasgos[`sf|${n}|${c}|${cs || 'phb'}|${sc}|${ss || 'phb'}|${nv}|${f || ss || 'phb'}`.toLowerCase()]
        return x ? <details key={r} open><summary>{x.name} ({sub!._nombre})</summary><Entradas entries={x.entries} /></details> : null
      })}
      {refs.length + refsSub.length === 0 && <p className="sutil">Sin rasgos nuevos en este nivel.</p>}
    </div>
  )
}
