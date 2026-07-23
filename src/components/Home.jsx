import { Fragment, useEffect } from 'react'
import { meta, modules, lessons, lessonsOf, totalMinutes, LABS, nextUp } from '../data'
import { useProgress } from '../hooks/useProgress'
import DiagramPanel from './DiagramPanel'

const HOW_TO_HTML =
  '<p>One lesson is one session. Each has the same shape: what you will be able to do, the explanation, ' +
  'annotated code you can copy and run, a live lab in the page, a short quiz, and exercises that need a real keyboard.</p>' +
  '<ul>' +
  '<li><strong>Do the lab before the quiz.</strong> The labs are not illustrations — they compute the real thing. ' +
  'The hashing, signing and address derivation all run genuine algorithms in your browser.</li>' +
  '<li><strong>Type the exercises out.</strong> Reading Solidity and writing Solidity are different skills, and only the second one gets you a job or keeps your funds.</li>' +
  '<li><strong>Never reuse a key from any lab or tutorial.</strong> Test keys are public knowledge; bots sweep them within seconds.</li>' +
  '</ul>' +
  '<p>Everything works offline. Progress is stored in this browser only.</p>'

function Stat({ b, s }) {
  return <div className="stat"><b>{b}</b><span>{s}</span></div>
}

export default function Home() {
  const { isDone, doneCount } = useProgress()
  const n = doneCount
  const nu = nextUp(isDone)

  useEffect(() => {
    document.title = meta.title + ' — ' + lessons.length + ' lessons with live examples'
  }, [])

  return (
    <>
      <section className="hero">
        <h1>{meta.title}</h1>
        <p className="lede">{meta.tagline}</p>
        <div className="hero-stats">
          <Stat b={lessons.length} s="lessons" />
          <Stat b={modules.length} s="modules" />
          <Stat b={Math.round(totalMinutes / 60) + 'h'} s="guided time" />
          <Stat b={Object.keys(LABS).length} s="live labs" />
          <Stat b={n + '/' + lessons.length} s="completed" />
        </div>
        <div className="cta-row">
          <a className="btn primary" href={'#/lesson/' + nu.id}>
            {n ? 'Continue: lesson ' + nu.num : 'Start lesson 1'} →
          </a>
          <a className="btn ghost" href={'#/lesson/' + lessons[0].id}>Back to the beginning</a>
        </div>
      </section>

      {window.DIA && (
        <>
          <div className="section-head">
            <h2>The route</h2>
            <span className="hint">{modules.length} modules, in order</span>
          </div>
          <DiagramPanel list={[window.DIA.home()]} />
        </>
      )}

      <div className="section-head"><h2>How to use this roadmap</h2></div>
      <section className="panel">
        <div className="prose" dangerouslySetInnerHTML={{ __html: HOW_TO_HTML }} />
      </section>

      <div className="section-head">
        <h2>Curriculum</h2>
        <span className="hint">{lessons.length} lessons · click any to open</span>
      </div>

      {modules.map(m => {
        const list = lessonsOf(m.id)
        const k = list.filter(l => isDone(l.id)).length
        const w = (list.length ? k / list.length * 100 : 0) + '%'
        return (
          <Fragment key={m.id}>
            <section className="module-card">
              <header>
                <div className="mc-badge" style={{ background: m.color }}>{m.id}</div>
                <div>
                  <h3>{m.name}</h3>
                  <p className="mc-sub">{m.summary}</p>
                </div>
                <div className="mc-prog">
                  <span className="mc-num">{k} / {list.length} done</span>
                  <div className="bar" data-mbar={m.id}>
                    <span style={{ background: m.color, width: w }}></span>
                  </div>
                </div>
              </header>
              <div className="lesson-grid">
                {list.map(l => (
                  <a className={'lesson-tile' + (isDone(l.id) ? ' done' : '')} data-tile={l.id} href={'#/lesson/' + l.id} key={l.id}>
                    <span className="lt-num">{String(l.num).padStart(2, '0')}</span>
                    <span>
                      <span className="lt-title">{l.title}</span>
                      <span className="lt-meta">
                        <span>{l.minutes} min</span>
                        <span>{l.level}</span>
                        {l.lab && <span>lab</span>}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
            <div className="note"><span className="tag">Outcome</span>{m.outcome}</div>
          </Fragment>
        )
      })}
    </>
  )
}
