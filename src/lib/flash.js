import { esc } from './highlight'

// transient bottom toast, ported from the old app.js flash()
export function flash(msg) {
  const n = document.createElement('div')
  n.innerHTML = esc(msg)
  n.style.cssText =
    'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99;' +
    'background:var(--bg-elev-2);border:1px solid var(--border);border-radius:10px;' +
    'padding:10px 18px;font-size:14px;box-shadow:var(--shadow)'
  document.body.appendChild(n)
  setTimeout(() => n.remove(), 2200)
}
