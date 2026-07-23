import { createContext, useContext, useState, useCallback } from 'react'
import { lessons } from '../data'

const PROGRESS_KEY = 'br.progress.v1'
const Ctx = createContext(null)

function load() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {} }
  catch { return {} }
}
function save(done) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)) } catch { /* private mode */ }
}

export function ProgressProvider({ children }) {
  const [done, setDone] = useState(load)

  const isDone = useCallback(id => !!done[id], [done])

  const toggle = useCallback(id => setDone(prev => {
    const next = { ...prev }
    if (next[id]) delete next[id]; else next[id] = 1
    save(next)
    return next
  }), [])

  const reset = useCallback(() => setDone(() => { save({}); return {} }), [])

  const doneCount = lessons.reduce((a, l) => a + (done[l.id] ? 1 : 0), 0)

  return (
    <Ctx.Provider value={{ done, isDone, toggle, reset, doneCount }}>
      {children}
    </Ctx.Provider>
  )
}

export const useProgress = () => useContext(Ctx)
