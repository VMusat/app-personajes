import { useEstado } from '../../estado/store'
import { ListaElecciones } from '../creador/Creador'
import type { PropsPestaña } from './HojaPersonaje'

export function PestañaElecciones({ p, h, actualizar }: PropsPestaña) {
  const datos = useEstado((s) => s.datos)!
  const pendientes = h.resolucion.elecciones.filter((e) => !e.completa && (e.opciones.length > 0 || e.tipo === 'aumento' || e.tipo === 'pg'))
  const resto = h.resolucion.elecciones.filter((e) => !pendientes.includes(e) && e.tipo !== 'equipo')
  const fijar = (id: string, v: string[]) => actualizar((x) => void (x.elecciones[id] = v))
  return (
    <div className="pestaña-elecciones">
      {pendientes.length > 0 && (
        <section>
          <h3>Pendientes</h3>
          <ListaElecciones elecciones={pendientes} p={p} datos={datos} fijar={fijar} />
        </section>
      )}
      <details>
        <summary>Todas las elecciones del personaje ({resto.length})</summary>
        <p className="aviso-texto">
          Cambiar una elección ya hecha recalcula toda la hoja. Las que dicen «se puede cambiar tras un descanso» son para eso;
          las demás, consúltalas con el DM.
        </p>
        <ListaElecciones elecciones={resto} p={p} datos={datos} fijar={fijar} />
      </details>
    </div>
  )
}
