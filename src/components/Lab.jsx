import { useEffect, useRef } from 'react'

/* Wraps a legacy imperative lab: window.LABS[key] = { title, desc, mount(el) }.
   The lab owns everything inside the mount node; React just gives it a host. */
export default function Lab({ labKey }) {
  const ref = useRef(null)
  const lab = (window.LABS || {})[labKey]

  useEffect(() => {
    const mount = ref.current
    if (!mount || !lab) return
    mount.innerHTML = ''
    try { lab.mount(mount) }
    catch (e) {
      mount.innerHTML = '<div class="out"><span class="bad">Lab failed to start: ' +
        String((e && e.message) || e) + '</span></div>'
      console.error('lab "' + labKey + '" failed', e)
    }
    return () => { mount.innerHTML = '' }
  }, [labKey])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!lab) {
    return (
      <section className="panel lab">
        <h2 data-jp="ラボ">Lab</h2>
        <div className="empty">No lab registered for key "{labKey}".</div>
      </section>
    )
  }

  return (
    <section className="panel lab">
      <h2 data-jp="ラボ">Lab · {lab.title}</h2>
      <p className="lab-desc" dangerouslySetInnerHTML={{ __html: lab.desc }} />
      <div ref={ref} />
    </section>
  )
}
