import { useState } from 'react'
import { useEstado } from '../../estado/store'
import { CARACTERISTICAS } from '../../datos/tipos'
import { ABREV, NOMBRE_CAR, conSigno, titulo } from '../glosario'
import type { PropsPestaña } from './HojaPersonaje'
import { SelectorVentaja, type ModoD20 } from './PestañaCombate'

export function PestañaHabilidades({ p, h }: PropsPestaña) {
  const tirar = useEstado((s) => s.tirar)
  const [modo, setModo] = useState<ModoD20>('normal')
  const ventaja = modo === 'normal' ? undefined : modo
  const pen = h.penalizacionD20
  const t = (etiqueta: string, mod: number, extra = '') =>
    tirar({ etiqueta, formula: `1d20${conSigno(mod + pen)}${extra}`, d20: true, ventaja, personaje: p.nombre })

  return (
    <div className="pestaña-habilidades">
      <div className="fila-titulo">
        <h3>Características y salvaciones</h3>
        <SelectorVentaja modo={modo} alCambiar={setModo} />
      </div>
      <div className="rejilla-car">
        {CARACTERISTICAS.map((c) => (
          <div key={c} className="caja-car">
            <span className="car-nombre" title={NOMBRE_CAR[c]}>{ABREV[c]}</span>
            <button className="car-mod" onClick={() => t(`Prueba de ${ABREV[c]}`, h.car[c].mod)} title="Prueba de característica">{conSigno(h.car[c].mod)}</button>
            <span className="car-valor">{h.car[c].valor}</span>
            <button className={`car-salv ${h.car[c].competenteSalv ? 'competente' : ''}`} onClick={() => t(`Salvación de ${ABREV[c]}`, h.car[c].salvacion)}>
              Save {conSigno(h.car[c].salvacion)}
            </button>
          </div>
        ))}
      </div>

      <h3>Habilidades</h3>
      <ul className="lista-habilidades">
        {h.habilidades.map((s) => (
          <li key={s.clave}>
            <span className={`marca-comp ${s.pericia ? 'pericia' : s.competente ? 'competente' : ''}`} title={s.pericia ? 'Expertise' : s.competente ? 'Competente' : ''} />
            <button
              className="hab-boton"
              onClick={() => {
                // Los dados extra de las marcas (1d4/1d6) se suman a la tirada
                const extra = s.dados.map((d) => `+${d}`).join('')
                t(s.nombre, s.bono, extra)
              }}
            >
              <span>{s.nombre} <small className="sutil">({ABREV[s.car]})</small></span>
              <b>{conSigno(s.bono)}{s.dados.length ? ` +${s.dados.join('+')}` : ''}</b>
            </button>
          </li>
        ))}
      </ul>
      <p><b>Percepción pasiva</b> {h.percepcionPasiva}</p>
      {h.resolucion.tamaño && <p><b>Tamaño</b> {h.resolucion.tamaño.nombre}{h.resolucion.tamaño.altura ? ` (unos ${h.resolucion.tamaño.altura})` : ''}</p>}
      {h.sentidos.length > 0 && <p><b>Sentidos:</b> {h.sentidos.map((s) => `${s.nombre} ${s.valor} ft`).join(', ')}</p>}
      {Object.keys(h.velocidad).length > 1 && (
        <p><b>Velocidades:</b> {Object.entries(h.velocidad).map(([k, v]) => `${{ andar: 'Walk', nado: 'Swim', vuelo: 'Fly', trepar: 'Climb', excavar: 'Burrow' }[k] ?? k} ${v} ft`).join(', ')}</p>
      )}

      <h3>Competencias</h3>
      <p><b>Armaduras:</b> {h.competencias.armaduras.map(titulo).join(', ') || '—'}</p>
      <p><b>Armas:</b> {h.competencias.armas.map(titulo).join(', ') || '—'}</p>
      <p><b>Herramientas:</b> {h.competencias.herramientas.map(titulo).join(', ') || '—'}</p>
      <p><b>Idiomas:</b> {h.competencias.idiomas.join(', ') || '—'}</p>
    </div>
  )
}
