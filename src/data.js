/* Derived views over the legacy globals set by js/data/*.js and js/playground.js.
   These scripts run (classic, in order) before this module, so the globals
   are present at import time. Mirrors the derivation block in the old app.js. */

const R = window.ROADMAP || { meta: {}, modules: [], lessons: [] }

export const meta = R.meta
export const modules = R.modules
export const LABS = window.LABS || {}

export const lessons = R.lessons.slice().sort((a, b) =>
  a.module - b.module || a.num - b.num)

export const byId = {}
lessons.forEach((l, i) => { byId[l.id] = l; l._i = i })

export const modColor = {}
modules.forEach(m => { modColor[m.id] = m.color })

export const totalMinutes = lessons.reduce((a, l) => a + (l.minutes || 0), 0)

export function lessonsOf(mid) { return lessons.filter(l => l.module === mid) }

// first not-done lesson, else the last one
export function nextUp(isDone) {
  return lessons.find(l => !isDone(l.id)) || lessons[lessons.length - 1]
}
