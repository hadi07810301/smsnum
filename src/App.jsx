import { useEffect, useRef, useState } from 'react'
import { usePath, Link, navigate } from './router.jsx'
import { useDB, currentUser, money, toggleTheme, logout, logoutAll, switchAccount, signedInAccounts, activeNotice } from './store.js'
import { Toasts, toast, attempt, avatarColor, playAlert } from './ui.jsx'
import Home from './pages/Home.jsx'
import Buy from './pages/Buy.jsx'
import Rent from './pages/Rent.jsx'
import { Login, Register } from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Admin from './pages/Admin.jsx'
import { Terms, Privacy, ApiDocs } from './pages/Legal.jsx'

function Header() {
  const db = useDB()
  const user = currentUser(db)
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="logo"><span className="logo-icon">📱</span> <b>{db.settings.siteName}</b></Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/buy">Buy Numbers</Link>
          <Link to="/rent">Rent Numbers</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/api">API</Link>
        </nav>
        <div className="top-actions">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode">
            {db.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user ? (
            <>
              <a href="#/dashboard/recharge" key={user.balance} className="balance-pill bump" title="Recharge">💰 {money(user.balance)} <span>＋</span></a>
              <AccountMenu user={user} />
            </>
          ) : (
            <>
              <Link to="/login" className="btn ghost sm">Login</Link>
              <Link to="/register" className="btn sm hide-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function AccountMenu({ user }) {
  const db = useDB()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const accounts = signedInAccounts(db)
  const others = accounts.filter((a) => a.id !== user.id)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const go = (fn) => { setOpen(false); fn() }
  return (
    <div className="acct" ref={ref}>
      <button className="acct-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title={user.email}>
        <span className="avatar sm" style={{ background: avatarColor(user.id) }}>{user.name[0]?.toUpperCase()}</span>
        {others.length > 0 && <span className="acct-count">{accounts.length}</span>}
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-current">
            <span className="avatar" style={{ background: avatarColor(user.id) }}>{user.name[0]?.toUpperCase()}</span>
            <div className="grow"><b>{user.name}</b><div className="muted small">{user.email}</div><div className="small pos">{money(user.balance)}</div></div>
          </div>
          <a className="acct-item" href="#/dashboard/profile" onClick={() => setOpen(false)}>👤 Manage account</a>
          {others.length > 0 && <div className="acct-label">Switch account</div>}
          {others.map((a) => (
            <button key={a.id} className="acct-item acct-other" role="menuitem" onClick={() => go(() => { if (attempt(() => switchAccount(a.id))) toast('Switched to ' + a.name) })}>
              <span className="avatar sm" style={{ background: avatarColor(a.id) }}>{a.name[0]?.toUpperCase()}</span>
              <span className="grow"><b>{a.name}</b><span className="muted small block">{a.email}</span></span>
              <span className="small muted">{money(a.balance)}</span>
            </button>
          ))}
          {accounts.length < 5 && <a className="acct-item" href="#/login?add=1" onClick={() => setOpen(false)}>➕ Add another account</a>}
          <div className="acct-sep" />
          <button className="acct-item" role="menuitem" onClick={() => go(() => { const next = logout(); if (next) toast('Signed out. Switched to ' + next.name); else navigate('/') })}>🚪 Sign out{others.length ? ' of this account' : ''}</button>
          {others.length > 0 && <button className="acct-item" role="menuitem" onClick={() => go(() => { logoutAll(); navigate('/'); toast('Signed out of all accounts') })}>⏏️ Sign out of all accounts</button>}
        </div>
      )}
    </div>
  )
}

// Plays a sound + shows a notice when a code arrives, a number is about to expire, or it expires.
// One-time numbers warn 2 minutes before; rentals warn 1 hour before.
function AlertWatcher() {
  const db = useDB()
  const user = currentUser(db)
  const seen = useRef(null)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(i) }, [])
  useEffect(() => {
    if (!user) { seen.current = null; return }
    const mine = db.orders.filter((o) => o.userId === user.id)
    const first = !seen.current || seen.current.user !== user.id
    if (first) {
      seen.current = { user: user.id, sms: {}, status: {}, warned: {} }
      mine.forEach((o) => { seen.current.sms[o.id] = o.sms.length; seen.current.status[o.id] = o.status })
      return
    }
    const st = seen.current
    const sound = user.sound !== false
    let play = null
    for (const o of mine) {
      const prevSms = st.sms[o.id] ?? 0, prevStatus = st.status[o.id]
      if (o.sms.length > prevSms) { play = 'sms'; toast(`📩 New code for ${o.service}: ${o.sms[o.sms.length - 1].code}`) }
      const live = ['waiting', 'received'].includes(o.status)
      const left = o.expiresAt - Date.now()
      const warnAt = o.rented ? 3600000 : 120000
      if (live && left > 0 && left <= warnAt && !st.warned[o.id + ':' + o.expiresAt]) {
        st.warned[o.id + ':' + o.expiresAt] = true
        play ||= 'warn'
        toast(`⏰ ${o.number} (${o.service}) expires in ${o.rented ? 'less than 1 hour' : 'about 2 minutes'}. Extend it to keep it.`, 'error', 10000)
      }
      if (['waiting', 'received'].includes(prevStatus) && ['expired', 'completed'].includes(o.status) && o.expiresAt <= Date.now() + 1000) {
        play = play === 'sms' ? 'sms' : 'expired'
        toast(`⌛ ${o.number} (${o.service}) has expired.`)
      }
      st.sms[o.id] = o.sms.length; st.status[o.id] = o.status
    }
    if (play && sound) playAlert(play)
  })
  return null
}

// admin notice to all users (24h), each user can hide it
function NoticeBar() {
  const db = useDB()
  const n = activeNotice(db)
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('smsnum_notice_hidden') } catch { return null } })
  if (!n || hidden === n.id) return null
  const icon = { info: 'ℹ️', success: '✅', warn: '⚠️' }[n.tone] || 'ℹ️'
  return (
    <div className={'notice-bar ' + n.tone} role="status">
      <div className="container notice-inner">
        <span className="notice-icon">{icon}</span>
        <span className="grow">{n.text}</span>
        <button className="notice-x" aria-label="Hide notice" onClick={() => { try { localStorage.setItem('smsnum_notice_hidden', n.id) } catch { /* ignore */ } setHidden(n.id) }}>✕</button>
      </div>
    </div>
  )
}

function Footer() {
  const db = useDB()
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="logo">📱 <b>{db.settings.siteName}</b></div>
          <p className="muted small">Virtual phone numbers for secure SMS verification and long-term rentals. Pay only for what you use.</p>
        </div>
        <div className="footer-links">
          <Link to="/buy">Buy Numbers</Link>
          <Link to="/rent">Rent Numbers</Link>
          <Link to="/api">API Docs</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/dashboard/support">Support</Link>
          <Link to="/admin">Admin</Link>
        </div>
      </div>
      <div className="container muted small copyright">© {new Date().getFullYear()} {db.settings.siteName}. All rights reserved.</div>
    </footer>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <Link to="/">🏠<span>Home</span></Link>
      <Link to="/buy">📲<span>Buy</span></Link>
      <Link to="/rent">📅<span>Rent</span></Link>
      <Link to="/dashboard">📊<span>Dashboard</span></Link>
      <Link to="/dashboard/profile">👤<span>Account</span></Link>
    </nav>
  )
}

export default function App() {
  const path = usePath()
  const db = useDB()
  useEffect(() => { document.documentElement.dataset.theme = db.theme }, [db.theme])
  useEffect(() => { document.title = db.settings.siteName + ' — Virtual Numbers for SMS Verification' }, [db.settings.siteName])

  if (path.startsWith('/admin')) return (<><Admin /><Toasts /></>)

  let page
  if (path === '/') page = <Home />
  else if (path === '/buy') page = <Buy />
  else if (path === '/rent') page = <Rent />
  else if (path === '/pricing') page = <Rent />
  else if (path === '/login') page = <Login />
  else if (path === '/register') page = <Register />
  else if (path.startsWith('/dashboard')) page = <Dashboard />
  else if (path === '/api') page = <ApiDocs />
  else if (path === '/terms') page = <Terms />
  else if (path === '/privacy') page = <Privacy />
  else page = <div className="container section center"><h1>404</h1><p>Page not found.</p><Link to="/" className="btn">Go home</Link></div>

  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      {db.settings.announcement && <div className="announce">{db.settings.announcement}</div>}
      <NoticeBar />
      <Header />
      <main key={path.startsWith('/dashboard') ? '/dashboard' : path} className="page-enter">{page}</main>
      <Footer />
      <BottomNav />
      <button className="to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
      <Toasts />
      <AlertWatcher />
    </>
  )
}
