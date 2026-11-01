import { useEffect } from 'react'
import { usePath, Link, navigate } from './router.jsx'
import { useDB, currentUser, money, toggleTheme, logout } from './store.js'
import { Toasts } from './ui.jsx'
import Home from './pages/Home.jsx'
import Buy from './pages/Buy.jsx'
import Pricing from './pages/Pricing.jsx'
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
        <Link to="/" className="logo">📱 <b>{db.settings.siteName}</b></Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/buy">Buy Numbers</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/api">API</Link>
        </nav>
        <div className="top-actions">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode">
            {db.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user ? (
            <>
              <a href="#/dashboard/recharge" className="balance-pill" title="Recharge">💰 {money(user.balance)} <span>＋</span></a>
              <button className="btn ghost sm hide-sm" onClick={() => { logout(); navigate('/') }}>Logout</button>
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

function Footer() {
  const db = useDB()
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="logo">📱 <b>{db.settings.siteName}</b></div>
          <p className="muted small">Virtual numbers for receiving SMS verification codes. Pay only for what you use.</p>
        </div>
        <div className="footer-links">
          <Link to="/pricing">Pricing</Link>
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
      <Link to="/buy">📲<span>Numbers</span></Link>
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
  else if (path === '/pricing') page = <Pricing />
  else if (path === '/login') page = <Login />
  else if (path === '/register') page = <Register />
  else if (path.startsWith('/dashboard')) page = <Dashboard />
  else if (path === '/api') page = <ApiDocs />
  else if (path === '/terms') page = <Terms />
  else if (path === '/privacy') page = <Privacy />
  else page = <div className="container section center"><h1>404</h1><p>Page not found.</p><Link to="/" className="btn">Go home</Link></div>

  return (
    <>
      {db.settings.announcement && <div className="announce">{db.settings.announcement}</div>}
      <Header />
      <main>{page}</main>
      <Footer />
      <BottomNav />
      <Toasts />
    </>
  )
}
