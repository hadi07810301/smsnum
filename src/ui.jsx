import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useDB } from './store.js'

// ---------- toasts ----------
let toasts = []
const tl = new Set()
const emit = () => tl.forEach((l) => l())
export function toast(msg, type = 'success', ms) {
  const id = Math.random()
  toasts = [...toasts, { id, msg, type }].slice(-3)
  emit()
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit() }, ms || (type === 'error' ? 6000 : 3500))
}
export function Toasts() {
  const list = useSyncExternalStore((l) => { tl.add(l); return () => tl.delete(l) }, () => toasts)
  return (
    <div className="toasts">
      {list.map((t) => <div key={t.id} className={'toast ' + t.type}>{t.msg}</div>)}
    </div>
  )
}

// run an action and show errors as toasts
export function attempt(fn, okMsg) {
  try {
    const r = fn()
    if (okMsg) toast(okMsg)
    return r ?? true
  } catch (e) {
    toast(e.message, 'error')
    return false
  }
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  // lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  // rendered on <body> so it is always centred on screen
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const STATUS = {
  waiting: 'warn', received: 'ok', completed: 'muted', cancelled: 'muted', expired: 'bad',
  pending: 'warn', approved: 'ok', rejected: 'bad', open: 'warn', answered: 'ok', closed: 'muted',
  credit: 'ok', debit: 'bad', refund: 'info', info: 'info', active: 'ok', banned: 'bad',
}
export const Badge = ({ s, children }) => <span className={'badge ' + (STATUS[s] || 'muted')}>{children || s}</span>

export function Countdown({ to }) {
  const [, setT] = useState(0)
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i) }, [])
  const ms = Math.max(0, to - Date.now())
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  if (d >= 1) return <span className="mono">{d}d {h}h</span>
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000)
  if (m >= 60) return <span className="mono">{h}h {m % 60}m</span>
  return <span className="mono">{m}:{String(s).padStart(2, '0')}</span>
}

// Real flag image (Windows can't show flag emojis), falls back to the emoji
export function Flag({ id, country }) {
  const db = useDB()
  const c = country || db.countries.find((x) => x.id === id)
  if (!c) return null
  if (!c.iso) return <span className="flag-emoji">{c.flag}</span>
  return (
    <img className="flag" src={`https://flagcdn.com/w40/${c.iso.toLowerCase()}.png`} alt={c.iso.toUpperCase()} width="20" height="15" loading="lazy"
      onError={(e) => { const sp = document.createElement('span'); sp.className = 'flag-code'; sp.textContent = c.iso.toUpperCase(); e.currentTarget.replaceWith(sp) }} />
  )
}

export function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied: ' + text), () => toast('Copy failed', 'error'))
}

export function Empty({ icon = '📭', text }) {
  return <div className="empty"><div className="empty-icon">{icon}</div><p>{text}</p></div>
}

export function Stat({ icon, label, value, tone }) {
  return (
    <div className={'stat tilt ' + (tone || '')}>
      <div className="stat-icon">{icon}</div>
      <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>
    </div>
  )
}

// stable colour per account so accounts are easy to tell apart
export const avatarColor = (id) => {
  let h = 5381
  for (const ch of String(id)) h = ((h << 5) + h + ch.charCodeAt(0)) | 0
  return `hsl(${Math.abs(h) % 360} 58% 40%)`
}

// ---------- simple captcha (letters + numbers, drawn on a canvas) ----------
const CAPTCHA_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O, 1/I/L
export const newCaptcha = () => Array.from({ length: 4 }, () => CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]).join('')
export const captchaOk = (code, input) => String(input || '').trim().toUpperCase() === code

export function Captcha({ code, value, onChange, onRefresh }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const W = 150, H = 48
    c.width = W * dpr; c.height = H * dpr
    const g = c.getContext('2d')
    g.scale(dpr, dpr)
    const dark = document.documentElement.dataset.theme === 'dark'
    g.fillStyle = dark ? '#1a2723' : '#eef2f0'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 2; i++) { // light noise lines
      g.strokeStyle = `hsla(${Math.random() * 360},45%,${dark ? 60 : 45}%,.45)`
      g.lineWidth = 1 + Math.random()
      g.beginPath(); g.moveTo(Math.random() * W, Math.random() * H); g.bezierCurveTo(Math.random() * W, Math.random() * H, Math.random() * W, Math.random() * H, Math.random() * W, Math.random() * H); g.stroke()
    }
    ;[...code].forEach((ch, i) => {
      g.save()
      g.translate(18 + i * 32, 34 + (Math.random() * 4 - 2))
      g.rotate((Math.random() - 0.5) * 0.25)
      g.font = `bold 28px ui-monospace, Menlo, monospace`
      g.fillStyle = `hsl(${150 + Math.random() * 80},55%,${dark ? 70 : 28}%)`
      g.fillText(ch, 0, 0)
      g.restore()
    })
    for (let i = 0; i < 12; i++) { g.fillStyle = dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)'; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5) }
  }, [code])
  return (
    <label>Security check
      <div className="captcha">
        <canvas ref={ref} style={{ width: 150, height: 48 }} role="img" aria-label="Captcha: type the characters shown" />
        <button type="button" className="icon-btn" onClick={onRefresh} title="New code" aria-label="New captcha">↻</button>
        <input className="input mono" placeholder="Type the 4 characters" autoComplete="off" autoCapitalize="characters" spellCheck="false" maxLength={4}
          value={value} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} required />
      </div>
    </label>
  )
}

// ---------- sound alerts (generated with Web Audio, no files needed) ----------
let audioCtx
export function playAlert(kind = 'sms') {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const notes = {
      sms: [[880, 0], [1320, 0.13]], // bright two-tone chime: code arrived
      warn: [[740, 0], [740, 0.22], [740, 0.44]], // three beeps: expiring soon
      expired: [[660, 0], [440, 0.18], [330, 0.36]], // falling tones: expired
    }[kind] || [[880, 0]]
    const t0 = audioCtx.currentTime + 0.02
    notes.forEach(([f, at]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + at)
      g.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18)
      o.connect(g).connect(audioCtx.destination)
      o.start(t0 + at); o.stop(t0 + at + 0.2)
    })
    navigator.vibrate?.(kind === 'sms' ? 120 : [80, 60, 80])
  } catch { /* audio not available */ }
}
