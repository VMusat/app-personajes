// Equipo inicial (clase y trasfondo): se añade una sola vez al inventario.
import type { Datos } from '../datos/tipos'
import { claveDeRef } from '../datos/refs'
import type { Hoja } from '../motor/derivar'
import { nuevoId, type Personaje } from '../motor/personaje'

const NOMBRES_TIPO: Record<string, string> = {
  toolArtisan: "Artisan's Tools (a elegir)",
  instrumentMusical: 'Musical Instrument (a elegir)',
  setGaming: 'Gaming Set (a elegir)',
  weaponSimple: 'Simple weapon (a elegir)',
  weaponMartial: 'Martial weapon (a elegir)',
  focusSpellcastingArcane: 'Arcane Focus (a elegir)',
  focusSpellcastingDruidic: 'Druidic Focus (a elegir)',
  focusSpellcastingHoly: 'Holy Symbol (a elegir)',
}

export function equipoPendiente(p: Personaje, h: Hoja): boolean {
  return !p.detalles.equipoAplicado && h.resolucion.equipo.some((g) => g.items.length > 0)
}

/** Añade el equipo inicial elegido (objetos y monedas) al inventario del personaje. */
export function aplicarEquipo(x: Personaje, h: Hoja, datos: Datos) {
  if (x.detalles.equipoAplicado) return
  for (const g of h.resolucion.equipo) {
    for (const it of g.items) {
      if (it.value) x.monedas.gp += it.value / 100
      else if (it.item) {
        const o = datos.objetos.find((ob) => ob._clave === claveDeRef(it.item))
        x.inventario.push({ id: nuevoId(), origen: o ? '5etools' : 'libre', ref: o?._clave, nombre: it.displayName ?? o?.name ?? it.item.split('|')[0].replace(/(^|s)S/g, (m: string) => m.toUpperCase()), cantidad: it.quantity ?? 1 })
      } else if (it.special) x.inventario.push({ id: nuevoId(), origen: 'libre', nombre: it.special, cantidad: it.quantity ?? 1 })
      else if (it.equipmentType)
        x.inventario.push({ id: nuevoId(), origen: 'libre', nombre: NOMBRES_TIPO[it.equipmentType] ?? it.equipmentType, cantidad: it.quantity ?? 1, notas: 'Elige el objeto concreto con el DM' })
    }
  }
  x.detalles.equipoAplicado = 'sí'
}
