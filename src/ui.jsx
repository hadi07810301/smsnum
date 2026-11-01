import { useEffect, useState, useSyncExternalStore } from 'react'

// ---------- toasts ----------
let toasts = []
const tl = new Set()
const emit = () => tl.forEach((l) => l())
export function toast(msg, type = 'success') {
  const id = Math.random()
  toasts = [...toasts, { id, msg, type }].slice(-3)
  emit()
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit() }, 3500)
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
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const STATUS = {
  waiting: 'warn', received: 'ok', completed: 'muted', cancelled: 'muted', expired: 'bad',
  pending: 'warn', approved: 'ok', rejected: 'bad', open: 'warn', answered: 'ok', closed: 'muted',
  credit: 'ok', debit: 'bad', refund: 'info', active: 'ok', banned: 'bad',
}
export const Badge = ({ s, children }) => <span className={'badge ' + (STATUS[s] || 'muted')}>{children || s}</span>

export function Countdown({ to }) {
  const [, setT] = useState(0)
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i) }, [])
  const ms = Math.max(0, to - Date.now())
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000)
  return <span className="mono">{m}:{String(s).padStart(2, '0')}</span>
}

export function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied: ' + text), () => toast('Copy failed', 'error'))
}

export function Empty({ icon = '📭', text }) {
  return <div className="empty"><div className="empty-icon">{icon}</div><p>{text}</p></div>
}

export function Stat({ icon, label, value, tone }) {
  return (
    <div className={'stat ' + (tone || '')}>
      <div className="stat-icon">{icon}</div>
      <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>
    </div>
  )
}
