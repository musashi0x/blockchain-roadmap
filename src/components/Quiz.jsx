import { useState } from 'react'

function Question({ q, qi, lid }) {
  const [picked, setPicked] = useState(null)
  const answered = picked !== null

  return (
    <div className="quiz-q">
      <p className="q">{qi + 1}. {q.q}</p>
      {q.options.map((o, oi) => {
        let cls = 'opt'
        if (answered && oi === q.answer) cls += ' correct'
        if (answered && oi === picked && picked !== q.answer) cls += ' wrong'
        return (
          <label className={cls} key={oi}>
            <input
              type="radio"
              name={lid + '-q' + qi}
              value={oi}
              disabled={answered}
              checked={picked === oi}
              onChange={() => setPicked(oi)}
            />
            <span>{o}</span>
          </label>
        )
      })}
      {answered && (
        <div
          className="explain"
          dangerouslySetInnerHTML={{
            __html: (picked === q.answer ? '<strong>Correct.</strong> ' : '<strong>Not quite.</strong> ') + q.why
          }}
        />
      )}
    </div>
  )
}

export default function Quiz({ quiz, lid }) {
  return (
    <section className="panel">
      <h2 data-jp="クイズ">Check yourself</h2>
      {quiz.map((q, qi) => <Question q={q} qi={qi} lid={lid} key={qi} />)}
    </section>
  )
}
