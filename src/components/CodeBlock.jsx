import { useState } from 'react'
import { highlight } from '../lib/highlight'

export default function CodeBlock({ c }) {
  const [label, setLabel] = useState('copy')

  function copy() {
    const done = ok => {
      setLabel(ok ? 'copied' : 'select + ⌘C')
      setTimeout(() => setLabel('copy'), 1400)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(c.src).then(() => done(true), () => done(false))
    } else done(false)
  }

  return (
    <div className="code-block">
      <header>
        <span className="lang">{c.lang || 'code'}</span>
        {c.file && <span className="file">{c.file}</span>}
        <button className="copy" type="button" onClick={copy}>{label}</button>
      </header>
      <pre><code dangerouslySetInnerHTML={{ __html: highlight(c.src, c.lang) }} /></pre>
      {c.caption && <div className="cap" dangerouslySetInnerHTML={{ __html: c.caption }} />}
    </div>
  )
}
