import { useEffect, useRef } from 'react'
import { modules, lessonsOf } from '../data'
import { useProgress } from '../hooks/useProgress'

function lessonText(l) {
  return (l.title + ' ' + l.summary + ' ' + (l.objectives || []).join(' ')).toLowerCase()
}

export default function Sidebar({ query, setQuery, activeId }) {
  const { isDone } = useProgress()
  const navRef = useRef(null)
  const q = query.trim().toLowerCase()

  // keep the active lesson scrolled into view, like the old markActiveNav
  useEffect(() => {
    if (!activeId || !navRef.current) return
    const a = navRef.current.querySelector('a.active')
    if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  return (
    <aside id="sidebar" className="sidebar" aria-label="Course navigation">
      <div className="search-wrap">
        <input
          id="search"
          type="search"
          placeholder="Search lessons…  (/)"
          autoComplete="off"
          aria-label="Search lessons"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <a className={'nav-home' + (!activeId ? ' active' : '')} href="#/">◈ Roadmap overview</a>

      <nav id="nav" className="nav" ref={navRef}>
        {modules.map(m => {
          const list = lessonsOf(m.id)
          const hits = list.filter(l => !q || lessonText(l).indexOf(q) >= 0)
          if (q && hits.length === 0) return null
          const k = list.filter(l => isDone(l.id)).length
          return (
            <details className="nav-module" key={m.id} open data-module={m.id}>
              <summary>
                <span className="m-dot" style={{ background: m.color }}></span>
                <span>{m.name}</span>
                <span className="m-count">{k}/{list.length}</span>
              </summary>
              <ul className="nav-list">
                {list.map(l => {
                  const hit = !q || hits.indexOf(l) >= 0
                  const cls = (isDone(l.id) ? 'done' : '') + (activeId === l.id ? ' active' : '')
                  return (
                    <li key={l.id} hidden={!hit}>
                      <a href={'#/lesson/' + l.id} className={cls.trim()} data-nav={l.id}>
                        <span className="tick">✓</span>
                        <span className="num">{String(l.num).padStart(2, '0')}</span>
                        <span className="t">{l.title}</span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </nav>

      <footer className="sidebar-foot">
        <p className="mono">Progress saved in this browser (localStorage).</p>
      </footer>
    </aside>
  )
}
