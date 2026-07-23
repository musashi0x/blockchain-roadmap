import { useEffect, useRef } from 'react'
import { esc, attr } from '../lib/highlight'

function figureHTML(d) {
  return '<figure class="dia-fig">' +
    '<div class="dia-head">' +
      (d.title ? '<p class="dia-title">' + esc(d.title) + '</p>' : '') +
      '<button class="dia-replay" type="button" title="Replay the animation">▶ replay</button>' +
    '</div>' +
    '<div class="dia-scroll" role="img" aria-label="' + attr(d.title || 'diagram') + '">' + d.svg + '</div>' +
    (d.cap ? '<figcaption class="dia-cap">' + esc(d.cap) + '</figcaption>' : '') +
    '</figure>'
}

/* window.DIA draws imperatively (SVG strings + animate/replay), so the panel
   is injected as HTML and DIA post-processes it, exactly like the old app.js. */
export default function DiagramPanel({ list }) {
  const ref = useRef(null)

  useEffect(() => {
    const p = ref.current
    if (!p) return
    const onClick = e => {
      const btn = e.target.closest('.dia-replay')
      if (!btn) return
      const svg = btn.closest('.dia-fig').querySelector('svg.dia')
      if (svg && window.DIA && window.DIA.replay) window.DIA.replay(svg)
    }
    p.addEventListener('click', onClick)
    // not rAF: that never fires while the tab is hidden, leaving diagrams unprepared
    const t = setTimeout(() => { if (window.DIA && window.DIA.animate) window.DIA.animate(p) }, 0)
    return () => { p.removeEventListener('click', onClick); clearTimeout(t) }
  }, [list])

  const html = '<h2 data-jp="図解">' + (list.length > 1 ? 'Diagrams' : 'Diagram') + '</h2>' +
    list.map(figureHTML).join('')

  return <section className="panel" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
