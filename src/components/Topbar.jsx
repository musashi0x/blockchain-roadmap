import { lessons, modules } from '../data'
import { useProgress } from '../hooks/useProgress'

export default function Topbar({ navOpen, onToggleNav, onToggleTheme, onReset }) {
  const { doneCount } = useProgress()
  const total = lessons.length
  const pct = total ? doneCount / total : 0

  return (
    <header className="topbar">
      <button
        id="navToggle"
        className="icon-btn"
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        onClick={onToggleNav}
      >
        <span className="burger"></span>
      </button>

      <a className="brand" href="#/">
        <span className="brand-mark">⛓</span>
        <span className="brand-text">
          <strong>Blockchain Roadmap</strong>
          <em>{total} lessons · {modules.length} modules · live labs</em>
        </span>
      </a>

      <div className="topbar-progress" title="Overall progress">
        <div className="bar"><span id="globalBarFill" style={{ width: (pct * 100).toFixed(1) + '%' }}></span></div>
        <span id="globalBarLabel" className="mono">{Math.round(pct * 100)}%</span>
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" aria-label="Toggle light/dark theme" title="Toggle theme" onClick={onToggleTheme}>◐</button>
        <button className="icon-btn" aria-label="Reset progress" title="Reset progress" onClick={onReset}>⟲</button>
      </div>
    </header>
  )
}
