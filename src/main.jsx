import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// No StrictMode: it double-invokes effects in dev, which would mount each
// imperative lab twice. Labs are single-mount by design.
createRoot(document.getElementById('root')).render(<App />)

// sanity-check the hand-rolled crypto once, in the console, on load
if (window.CL && window.CL.selfTest) {
  setTimeout(() => {
    try {
      if (!window.CL.selfTest())
        console.warn('crypto-lite self-test FAILED — labs using hashes or signatures may be wrong.')
    } catch (e) { console.warn('crypto-lite self-test threw', e) }
  }, 0)
}
