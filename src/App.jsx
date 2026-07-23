import { useState, useEffect, useCallback } from 'react'
import { lessons, byId } from './data'
import { ProgressProvider, useProgress } from './hooks/useProgress'
import { useTheme } from './hooks/useTheme'
import { useHashRoute } from './hooks/useHashRoute'
import { flash } from './lib/flash'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import Lesson from './components/Lesson'

function Shell() {
  const route = useHashRoute()
  const activeId = route.name === 'lesson' ? route.id : null
  const [navOpen, setNavOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [, toggleTheme] = useTheme()
  const { doneCount, reset } = useProgress()

  // close the mobile nav on every navigation, like the old router did
  useEffect(() => { setNavOpen(false) }, [route.name, route.id])

  // CSS keys the mobile drawer off body.nav-open
  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen)
    return () => document.body.classList.remove('nav-open')
  }, [navOpen])

  const handleReset = useCallback(() => {
    if (!doneCount) { flash('Nothing to reset — no sessions marked complete yet.'); return }
    const msg = 'Reset progress?\n\n' + doneCount + ' completed session' +
      (doneCount === 1 ? '' : 's') + ' will be cleared from this browser. This cannot be undone.'
    if (!window.confirm(msg)) return
    reset()
    flash('Progress cleared.')
  }, [doneCount, reset])

  // keyboard shortcuts: / focuses search, Esc clears/closes, arrows page lessons
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable

      if (e.key === 'Escape') {
        if (typing && tag === 'input' && e.target.id === 'search') {
          setQuery('')
          e.target.blur()
        }
        setNavOpen(false)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '/') {
        e.preventDefault()
        const s = document.getElementById('search')
        if (s) s.focus()
        return
      }

      const cur = (window.location.hash.match(/^#\/lesson\/([a-z0-9-]+)/i) || [])[1]
      const l = cur && byId[cur]
      if (!l) return
      if (e.key === 'ArrowLeft' && lessons[l._i - 1]) window.location.hash = '#/lesson/' + lessons[l._i - 1].id
      if (e.key === 'ArrowRight' && lessons[l._i + 1]) window.location.hash = '#/lesson/' + lessons[l._i + 1].id
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <Topbar
        navOpen={navOpen}
        onToggleNav={() => setNavOpen(o => !o)}
        onToggleTheme={toggleTheme}
        onReset={handleReset}
      />

      <div className="shell">
        <Sidebar query={query} setQuery={setQuery} activeId={activeId} />

        <div className="scrim" hidden={!navOpen} onClick={() => setNavOpen(false)} />

        <main id="main" className="main" tabIndex={-1}>
          {route.name === 'lesson'
            ? <Lesson id={route.id} key={route.id} />
            : <Home />}
        </main>
      </div>
    </>
  )
}

export default function App() {
  return (
    <ProgressProvider>
      <Shell />
    </ProgressProvider>
  )
}
