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

// Headline word that cycles through a list with a slide animation
export function Rotator({ words, interval = 2200 }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduced()) return
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval)
    return () => clearInterval(t)
  }, [words.length, interval])
  return (
    <span className="rotator" aria-live="polite">
      <span key={i} className="rotator-word">{words[i]}</span>
    </span>
  )
}

// Global pointer effects: 3D tilt + spotlight, magnetic buttons, click ripples, scroll progress
export function startEffects() {
  if (typeof window === 'undefined' || window.__fxStarted) return
  window.__fxStarted = true
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

  document.addEventListener('pointermove', (e) => {
    if (!fine || reduced()) return
    const tilt = e.target.closest?.('.tilt')
    document.querySelectorAll('.tilt.is-hover').forEach((el) => { if (el !== tilt) resetTilt(el) })
    if (tilt) {
      const r = tilt.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
      tilt.classList.add('is-hover')
      tilt.style.setProperty('--mx', x * 100 + '%')
      tilt.style.setProperty('--my', y * 100 + '%')
      tilt.style.setProperty('--rx', (0.5 - y) * 8 + 'deg')
      tilt.style.setProperty('--ry', (x - 0.5) * 10 + 'deg')
    }
    const mag = e.target.closest?.('.magnetic')
    document.querySelectorAll('.magnetic.is-mag').forEach((el) => { if (el !== mag) { el.classList.remove('is-mag'); el.style.transform = '' } })
    if (mag) {
      const r = mag.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
      mag.classList.add('is-mag')
      mag.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`
    }
  }, { passive: true })
  document.addEventListener('pointerleave', () => document.querySelectorAll('.tilt.is-hover').forEach(resetTilt))

  // ripple on every button click
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('.btn, .chip, .side-link')
    if (!b || reduced()) return
    const r = b.getBoundingClientRect()
    const s = document.createElement('span')
    const size = Math.max(r.width, r.height) * 2
    s.className = 'ripple'
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
    b.appendChild(s)
    setTimeout(() => s.remove(), 650)
  })

  // scroll progress + back-to-top visibility
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight
    document.documentElement.style.setProperty('--scroll', h > 0 ? (scrollY / h).toFixed(4) : 0)
    document.documentElement.classList.toggle('scrolled', scrollY > 500)
  }
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('hashchange', () => setTimeout(onScroll, 50))
  onScroll()
}
function resetTilt(el) {
  el.classList.remove('is-hover')
  el.style.removeProperty('--rx'); el.style.removeProperty('--ry')
}
