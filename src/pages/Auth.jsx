import { useState } from 'react'
import { Link, navigate } from '../router.jsx'
import { useDB, login, register, switchAccount, signedInAccounts, currentUser } from '../store.js'
import { attempt, toast, avatarColor } from '../ui.jsx'

export function Login() {
  const db = useDB()
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const adding = params.get('add') === '1'
  const accounts = signedInAccounts(db)
  const cur = currentUser(db)
  const [f, setF] = useState({ email: '', password: '' })
  function submit(e) {
    e.preventDefault()
    if (accounts.some((a) => a.email === f.email.trim().toLowerCase())) {
      const a = accounts.find((x) => x.email === f.email.trim().toLowerCase())
      if (attempt(() => switchAccount(a.id), 'Switched to ' + a.name)) navigate('/dashboard')
      return
    }
    const u = attempt(() => login(f.email, f.password))
    if (u) { toast(adding ? `Added ${u.name}. You can switch accounts from the top bar.` : 'Welcome back!'); navigate('/dashboard') }
  }
  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={submit}>
        <h1>{adding ? 'Add another account' : 'Log in'}</h1>
        <p className="muted">{adding && cur ? `You'll stay signed in as ${cur.name}.` : 'Access your numbers and wallet.'}</p>
        {accounts.length > 0 && !adding && (
          <div className="acct-choose">
            <div className="muted small">Choose an account</div>
            {accounts.map((a) => (
              <button type="button" key={a.id} className="acct-item acct-other" onClick={() => { if (attempt(() => switchAccount(a.id), 'Switched to ' + a.name)) navigate('/dashboard') }}>
                <span className="avatar sm" style={{ background: avatarColor(a.id) }}>{a.name[0]?.toUpperCase()}</span>
                <span className="grow"><b>{a.name}</b><span className="muted small block">{a.email}</span></span>
                <span className="small muted">→</span>
              </button>
            ))}
            <div className="or"><span>or use another account</span></div>
          </div>
        )}
        <label>Email<input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input className="input" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <button className="btn full">{adding ? 'Add account' : 'Log in'}</button>
        {!adding && <p className="muted small center">Demo account: <b>demo@smsnum.com</b> / <b>demo123</b></p>}
        <p className="center small">No account? <Link to="/register" className="link">Sign up</Link>{adding && <> · <a href="#/dashboard" className="link">Cancel</a></>}</p>
      </form>
    </div>
  )
}

export function Register() {
  const ref = new URLSearchParams(window.location.hash.split('?')[1] || '').get('ref') || ''
  const [f, setF] = useState({ name: '', email: '', password: '', ref })
  function submit(e) {
    e.preventDefault()
    if (f.password.length < 6) return attempt(() => { throw new Error('Password must be at least 6 characters') })
    if (attempt(() => register(f), 'Account created!')) navigate('/dashboard')
  }
  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={submit}>
        <h1>Create account</h1>
        <p className="muted">Free forever. Pay only for numbers you use.</p>
        <label>Full name<input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Email<input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input className="input" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label>Referral code (optional)<input className="input" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></label>
        <button className="btn full">Sign up</button>
        <p className="center small">Already have an account? <Link to="/login" className="link">Log in</Link></p>
      </form>
    </div>
  )
}
