import { useState, useEffect } from 'react'

// mirrors the old app.js router: #/lesson/:id -> lesson, anything else -> home
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const h = hash.replace(/^#/, '')
  const mm = h.match(/^\/lesson\/([a-z0-9-]+)/i)
  return mm ? { name: 'lesson', id: mm[1] } : { name: 'home' }
}
