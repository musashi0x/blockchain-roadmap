import { useEffect, useRef } from 'react'
import { byId, modules, lessons, meta } from '../data'
import { useProgress } from '../hooks/useProgress'
import CodeBlock from './CodeBlock'
import Lab from './Lab'
import Quiz from './Quiz'
import DiagramPanel from './DiagramPanel'

export default function Lesson({ id }) {
  const l = byId[id]
  const { isDone, toggle, doneCount } = useProgress()
  const bodyRef = useRef(null)

  // unknown lesson -> bounce home, matching the old renderLesson guard
  useEffect(() => {
    if (!l) window.location.hash = '#/'
  }, [l])

  // wrap wide tables so they scroll instead of blowing out the layout
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.querySelectorAll('table').forEach(t => {
      if (t.parentNode.classList.contains('table-scroll')) return
      const wrap = document.createElement('div')
      wrap.className = 'table-scroll'
      t.parentNode.insertBefore(wrap, t)
      wrap.appendChild(t)
    })
  }, [id])

  useEffect(() => {
    if (!l) return
    document.title = l.num + '. ' + l.title + ' — ' + meta.title
    window.scrollTo(0, 0)
    const main = document.getElementById('main')
    if (main) main.focus({ preventScroll: true })
  }, [id, l])

  if (!l) return null

  const m = modules.find(x => x.id === l.module) || { name: '', color: 'var(--accent)' }
  const dias = window.DIA ? window.DIA.get(l.id) : []
  const prev = lessons[l._i - 1], next = lessons[l._i + 1]
  const done = isDone(l.id)
  const total = lessons.length

  return (
    <>
      <header className="lesson-head">
        <div className="crumbs"><a href="#/">Roadmap</a> / Module {l.module} · {m.name}</div>
        <h1>{String(l.num).padStart(2, '0')}. {l.title}</h1>
        <div className="chips">
          <span className={'chip lvl-' + String(l.level).toLowerCase()}>{l.level}</span>
          <span className="chip">{l.minutes} min</span>
          <span className="chip">Session {l.num} of {total}</span>
          {l.lab && <span className="chip">interactive lab</span>}
          {done && <span className="chip" style={{ color: 'var(--ok)' }}>completed ✓</span>}
        </div>
        <p className="prose" style={{ marginBottom: '22px' }}>{l.summary}</p>
      </header>

      {l.objectives && l.objectives.length > 0 && (
        <section className="panel">
          <h2 data-jp="目標">By the end of this session</h2>
          <ul className="goals">
            {l.objectives.map((o, i) => <li key={i} dangerouslySetInnerHTML={{ __html: o }} />)}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2 data-jp="レッスン">Lesson</h2>
        <div className="prose" ref={bodyRef} dangerouslySetInnerHTML={{ __html: l.body }} />
      </section>

      {dias.length > 0 && <DiagramPanel list={dias} />}

      {l.code && l.code.length > 0 && (
        <section className="panel">
          <h2 data-jp="コード">Worked examples</h2>
          {l.code.map((c, i) => <CodeBlock c={c} key={i} />)}
        </section>
      )}

      {l.lab && <Lab labKey={l.lab} />}

      {l.quiz && l.quiz.length > 0 && <Quiz quiz={l.quiz} lid={l.id} />}

      {l.tasks && l.tasks.length > 0 && (
        <section className="panel">
          <h2 data-jp="演習">Exercises</h2>
          <ol className="tasks">
            {l.tasks.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
          </ol>
        </section>
      )}

      {l.resources && l.resources.length > 0 && (
        <section className="panel">
          <h2 data-jp="資料">Go deeper</h2>
          <ul className="reslist">
            {l.resources.map((r, i) => (
              <li key={i}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  <span className="rt">{r.type}</span><span>{r.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="done-bar">
        <button type="button" className={'btn' + (done ? ' ghost' : ' primary')} onClick={() => toggle(l.id)}>
          {done ? '✓ Completed — mark as not done' : 'Mark this session complete'}
        </button>
        <span className="txt">
          {doneCount} of {total} sessions complete · {Math.round(doneCount / total * 100)}%
        </span>
      </div>

      <nav className="pager">
        {prev
          ? <a href={'#/lesson/' + prev.id}><span className="dir">← previous</span><span className="t">{prev.title}</span></a>
          : <a href="#/"><span className="dir">←</span><span className="t">Roadmap overview</span></a>}
        {next
          ? <a className="next" href={'#/lesson/' + next.id}><span className="dir">next →</span><span className="t">{next.title}</span></a>
          : <a className="next" href="#/"><span className="dir">done →</span><span className="t">Back to the roadmap</span></a>}
      </nav>
    </>
  )
}
