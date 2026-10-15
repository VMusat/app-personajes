// Acceso a un personaje con guardado automático (con un pequeño retardo para no saturar el almacén).
// Los cambios se aplican de forma síncrona sobre una referencia, así no se pierden aunque el componente
// se desmonte justo después (p. ej. al confirmar una subida de nivel y volver a la hoja).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEstado } from '../estado/store'
import type { Personaje } from '../motor/personaje'

export function usePersonaje(id: string): [Personaje | undefined, (f: (p: Personaje) => void) => void, boolean] {
  const remoto = useEstado((s) => s.personajes.find((p) => p.id === id))
  const repo = useEstado((s) => s.repo)
  const actual = useRef<Personaje | undefined>(remoto)
  const [, setVersion] = useState(0)
  const pendiente = useRef<number | undefined>(undefined)
  const [guardando, setGuardando] = useState(false)
  const repoRef = useRef(repo)
  repoRef.current = repo

  // Si llega una versión remota más nueva y no hay cambios pendientes, se adopta
  if (remoto && pendiente.current === undefined && (!actual.current || remoto.actualizado > actual.current.actualizado)) {
    actual.current = remoto
  }

  const guardarYa = useCallback(() => {
    window.clearTimeout(pendiente.current)
    pendiente.current = undefined
    const p = actual.current
    if (p) void repoRef.current?.guardarPersonaje(p).finally(() => setGuardando(false))
  }, [])

  const actualizar = useCallback(
    (f: (p: Personaje) => void) => {
      if (!actual.current) return
      const copia = structuredClone(actual.current)
      f(copia)
      copia.actualizado = new Date().toISOString()
      actual.current = copia
      setVersion((v) => v + 1)
      setGuardando(true)
      window.clearTimeout(pendiente.current)
      pendiente.current = window.setTimeout(guardarYa, 500)
    },
    [guardarYa],
  )

  // Al salir, se guarda enseguida lo que quedara pendiente
  useEffect(
    () => () => {
      if (pendiente.current !== undefined) guardarYa()
    },
    [guardarYa],
  )

  return [actual.current, actualizar, guardando]
}
