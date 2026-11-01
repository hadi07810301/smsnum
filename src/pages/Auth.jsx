import { useState } from 'react'
import { Link, navigate } from '../router.jsx'
import { login, register } from '../store.js'
import { attempt } from '../ui.jsx'

export function Login() {
  const [f, setF] = useState({ email: '', password: '' })
  function submit(e) {
    e.preventDefault()
    if (attempt(() => login(f.email, f.password), 'Welcome back!')) navigate('/dashboard')
  }
  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={submit}>
        <h1>Log in</h1>
        <p className="muted">Access your numbers and wallet.</p>
        <label>Email<input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input className="input" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <button className="btn full">Log in</button>
        <p className="muted small center">Demo account: <b>demo@smsnum.com</b> / <b>demo123</b></p>
        <p className="center small">No account? <Link to="/register" className="link">Sign up</Link></p>
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
