import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'br.theme.v1'

function initial() {
  try { const t = localStorage.getItem(THEME_KEY); if (t) return t } catch { /* ignore */ }
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
    ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const toggle = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), [])
  return [theme, toggle]
}
