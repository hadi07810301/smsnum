// Small animation helpers: scroll reveal + count-up numbers
import { useEffect, useRef, useState } from 'react'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Any element with class "reveal" fades/slides in when it scrolls into view.
// Works for elements added later too (MutationObserver).
export function startReveal() {
  if (typeof window === 'undefined' || window.__revealStarted) return
  window.__revealStarted = true
  const show = (el) => el.classList.add('in')
  if (reduced() || !('IntersectionObserver' in window)) {
    const all = () => document.querySelectorAll('.reveal:not(.in)').forEach(show)
    all()
    new MutationObserver(all).observe(document.body, { childList: true, subtree: true })
    return
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target) } })
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  const scan = () => document.querySelectorAll('.reveal:not(.in):not([data-obs])').forEach((el) => { el.dataset.obs = '1'; io.observe(el) })
  scan()
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
}

// Animated number that counts up to `value`
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', duration = 1100 }) {
  const [n, setN] = useState(reduced() ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduced()) { setN(value); return }
    const start = performance.now(), a = from.current, b = Number(value) || 0
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(a + (b - a) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{prefix}{Number(n).toFixed(decimals)}{suffix}</>
}
