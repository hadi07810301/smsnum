import { useState } from 'react'
import { usePath, navigate } from '../router.jsx'
import {
  useDB, money, fmtDate, adminLogin, adminLogout, approveRecharge, rejectRecharge, adjustBalance, toggleBan, deleteUser, adminLogoutAllDevices,
  saveService, deleteService, saveCountry, deleteCountry, saveSettings, adminCancelOrder, replyTicket, closeTicket, toggleTheme, resetDB, priceFor,
  saveProvider, deleteProvider, setActiveProvider, setNumberSource, testProvider, planCost, shortPlan, checkRecharge, postNotice, clearNotice, activeNotice,
} from '../store.js'
import { explorerTx } from '../chain.js'
import { PROVIDER_TYPES, emptyProvider } from '../providers.js'
import { Badge, Stat, Empty, Modal, attempt, toast, Flag } from '../ui.jsx'
import { Thread } from './Dashboard.jsx'

const TABS = [
  ['', '📊', 'Overview'], ['users', '👥', 'Users'], ['orders', '🧾', 'Orders'], ['recharges', '💳', 'Recharges'],
  ['providers', '🔌', 'API Providers'], ['services', '📲', 'Services'], ['countries', '🌍', 'Countries'], ['sms', '💬', 'SMS Center'],
  ['tickets', '🎧', 'Tickets'], ['transactions', '📜', 'Transactions'], ['settings', '⚙️', 'Settings'],
]

function AdminLogin() {
  const [f, setF] = useState({ user: '', pass: '' })
  return (
    <div className="auth-wrap admin-bg">
      <form className="card auth" onSubmit={(e) => { e.preventDefault(); attempt(() => adminLogin(f.user, f.pass), 'Logged in as admin') }}>
        <h1>🛡️ Admin panel</h1>
        <p className="muted">Sign in to manage the site.</p>
        <label>Username<input className="input" autoComplete="username" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /></label>
        <label>Password<input className="input" type="password" autoComplete="current-password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} /></label>
        <button className="btn full">Log in</button>
        <p className="center small"><a href="#/" className="link">← Back to site</a></p>
      </form>
    </div>
  )
}

export default function Admin() {
  const db = useDB()
  const path = usePath()
  const tab = path.split('/')[2] || ''
  if (!db.session.admin) return <AdminLogin />

  const pendingR = db.recharges.filter((r) => r.status === 'pending').length
  const openT = db.tickets.filter((t) => t.status === 'open').length
  const Page = { '': Overview, users: Users, orders: Orders, recharges: Recharges, providers: Providers, services: Services, countries: Countries, sms: SmsCenter, tickets: Tickets, transactions: Transactions, settings: Settings }[tab] || Overview

  return (
    <div className="admin">
      <header className="topbar admin-top">
        <div className="topbar-inner wide">
          <a href="#/admin" className="logo">🛡️ <b>{db.settings.siteName} Admin</b></a>
          <div className="top-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode">{db.theme === 'dark' ? '☀️' : '🌙'}</button>
            <a href="#/" className="btn ghost sm">View site</a>
            <button className="btn sm" onClick={() => { adminLogout(); navigate('/admin') }}>Logout</button>
          </div>
        </div>
      </header>
      <div className="dash wide">
        <aside className="sidebar">
          {TABS.map(([k, i, l]) => (
            <a key={k} href={'#/admin' + (k ? '/' + k : '')} className={'side-link' + (tab === k ? ' active' : '')}>
              <span>{i}</span>{l}
              {k === 'recharges' && pendingR > 0 && <span className="dot-count">{pendingR}</span>}
              {k === 'tickets' && openT > 0 && <span className="dot-count">{openT}</span>}
            </a>
          ))}
        </aside>
        <section className="dash-main tab-enter" key={tab}><Page db={db} /></section>
      </div>
    </div>
  )
}

function Overview({ db }) {
  const revenue = db.orders.filter((o) => !['cancelled', 'expired'].includes(o.status)).reduce((a, o) => a + (o.paid ?? o.price), 0)
  // users by country (from IP lookup at sign-up / login)
  const byCountry = Object.values(db.users.reduce((m, u) => {
    const k = u.countryCode || '??'
    m[k] ||= { code: k, name: u.country || 'Unknown', n: 0 }
    m[k].n++
    return m
  }, {})).sort((a, b) => b.n - a.n)
  const maxC = Math.max(1, ...byCountry.map((c) => c.n))
  const deposits = db.recharges.filter((r) => r.status === 'approved').reduce((a, r) => a + r.amount, 0)
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i))
    const end = d.getTime() + 86400000
    return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), n: db.orders.filter((o) => o.createdAt >= d.getTime() && o.createdAt < end).length }
  })
  const max = Math.max(1, ...days.map((d) => d.n))
  const top = Object.entries(db.orders.reduce((m, o) => ({ ...m, [o.service]: (m[o.service] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <>
      <h1>Overview</h1>
      <div className="stats">
        <Stat icon="👥" label="Users" value={db.users.length} />
        <Stat icon="🧾" label="Orders" value={db.orders.length} />
        <Stat icon="💵" label="Sales" value={money(revenue)} tone="primary" />
        <Stat icon="🏦" label="Approved deposits" value={money(deposits)} />
        <Stat icon="⏳" label="Pending recharges" value={db.recharges.filter((r) => r.status === 'pending').length} />
        <Stat icon="📲" label="Active numbers" value={db.orders.filter((o) => ['waiting', 'received'].includes(o.status)).length} />
        <Stat icon="🎧" label="Open tickets" value={db.tickets.filter((t) => t.status === 'open').length} />
        <Stat icon="💰" label="User balances" value={money(db.users.reduce((a, u) => a + u.balance, 0))} />
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Orders — last 7 days</h3>
          <div className="bars">
            {days.map((d) => (
              <div className="bar-col" key={d.label}>
                <span className="bar-val">{d.n}</span>
                <div className="bar grow" style={{ height: (d.n / max) * 100 + '%' }} />
                <span className="bar-label">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="row-between"><h3>Users by country</h3><span className="muted small">{db.users.length} users · {byCountry.filter((c) => c.code !== '??').length} countries</span></div>
          {!byCountry.length ? <Empty text="No users yet." /> : (
            <div className="country-bars">
              {byCountry.slice(0, 10).map((c) => (
                <div className="cbar" key={c.code}>
                  <span className="cbar-name">{c.code !== '??' ? <Flag country={{ iso: c.code.toLowerCase(), flag: '' }} /> : '🌐'} {c.name}</span>
                  <span className="cbar-track"><span className="cbar-fill grow-x" style={{ width: (c.n / maxC) * 100 + '%' }} /></span>
                  <b>{c.n}</b><span className="muted small">{Math.round((c.n / db.users.length) * 100)}%</span>
                </div>
              ))}
            </div>
          )}
          <p className="muted small">Country is detected from the user's IP address when they sign up or log in.</p>
        </div>
        <div className="card">
          <h3>Top services</h3>
          {!top.length ? <Empty text="No orders yet." /> : top.map(([name, n]) => (
            <div className="list-row" key={name}><div className="grow">{name}</div><b>{n}</b></div>
          ))}
        </div>
      </div>
    </>
  )
}

function Users({ db }) {
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [amt, setAmt] = useState('')
  const [note, setNote] = useState('')
  const list = db.users.filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()))
  const u = db.users.find((x) => x.id === edit)
  return (
    <>
      <h1>Users</h1>
      <input className="input search" placeholder="🔍 Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>User</th><th>Country</th><th>Balance</th><th>Orders</th><th>Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td><b>{x.name}</b><div className="muted small">{x.email}</div></td>
                <td className="small">{x.countryCode ? <><Flag country={{ iso: x.countryCode.toLowerCase(), flag: '' }} /> {x.country}</> : '—'}{x.lastIp && <div className="muted mono">{x.lastIp}</div>}</td>
                <td>{money(x.balance)}</td>
                <td>{db.orders.filter((o) => o.userId === x.id).length}</td>
                <td className="small">{fmtDate(x.createdAt)}</td>
                <td><Badge s={x.banned ? 'banned' : 'active'}>{x.banned ? 'suspended' : 'active'}</Badge></td>
                <td className="btn-row">
                  <button className="btn ghost sm" onClick={() => { setEdit(x.id); setAmt(''); setNote('') }}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {u && (
        <Modal title={u.name} onClose={() => setEdit(null)}>
          <ul className="info-list">
            <li><span>Email</span><b>{u.email}</b></li>
            <li><span>Country</span><b>{u.country || '—'}</b></li>
            <li><span>Last IP</span><b className="mono">{u.lastIp || '—'}</b></li>
            <li><span>Devices logged in</span><b>{(u.sessions || []).length}</b></li>
            <li><span>Status</span><b className={u.banned ? 'neg' : 'pos'}>{u.banned ? 'Suspended' + (u.suspendedAt ? ' · ' + fmtDate(u.suspendedAt) : '') : 'Active'}</b></li>
            <li><span>Balance</span><b>{money(u.balance)}</b></li>
            <li><span>Referral code</span><b className="mono">{u.refCode}</b></li>
            <li><span>Referred by</span><b>{db.users.find((r) => r.id === u.referredBy)?.email || '—'}</b></li>
          </ul>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (attempt(() => adjustBalance(u.id, amt, note), 'Balance updated')) { setAmt(''); setNote('') } }}>
            <label>Add / deduct balance (use − to deduct)
              <input className="input" type="number" step="0.01" placeholder="e.g. 10 or -2.5" value={amt} onChange={(e) => setAmt(e.target.value)} />
            </label>
            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn full">Apply</button>
          </form>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className={'btn sm ' + (u.banned ? '' : 'danger')} onClick={() => { toggleBan(u.id); toast(u.banned ? 'Account reactivated' : 'Account suspended — the user is signed out everywhere') }}>{u.banned ? '✅ Reactivate account' : '⛔ Suspend account'}</button>
            {(u.sessions || []).length > 0 && <button className="btn ghost sm" onClick={() => { adminLogoutAllDevices(u.id); toast('User logged out of all devices') }}>Log out all devices</button>}
            <button className="btn danger sm" onClick={() => { if (confirm('Delete this user permanently?')) { deleteUser(u.id); setEdit(null); toast('User deleted') } }}>Delete user</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Orders({ db }) {
  const [f, setF] = useState('all')
  const list = f === 'all' ? db.orders : db.orders.filter((o) => o.status === f)
  const email = (id) => db.users.find((u) => u.id === id)?.email || 'deleted'
  return (
    <>
      <h1>Orders</h1>
      <div className="chips">
        {['all', 'waiting', 'received', 'completed', 'cancelled', 'expired'].map((s) => (
          <button key={s} className={'chip' + (f === s ? ' on' : '')} onClick={() => setF(s)}>{s}</button>
        ))}
      </div>
      {!list.length ? <Empty text="No orders." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>User</th><th>Service</th><th>Number</th><th>Price</th><th>Code</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td className="small">{email(o.userId)}</td>
                  <td>{o.icon} {o.service}<div className="muted small"><Flag id={o.countryId} /> {o.country}</div></td>
                  <td className="mono">{o.number}<div className="muted small">{o.live ? `🔌 ${o.providerName} #${o.providerOrderId}` : 'demo'}</div></td>
                  <td>{money(o.paid ?? o.price)}</td>
                  <td className="mono">{o.sms[o.sms.length - 1]?.code || '—'}</td>
                  <td><Badge s={o.status} />{o.rented && <div className="muted small">📅 rented until {new Date(o.expiresAt).toLocaleDateString()}</div>}</td>
                  <td className="small">{fmtDate(o.createdAt)}</td>
                  <td>{['waiting', 'received'].includes(o.status) && <button className="btn danger sm" onClick={() => adminCancelOrder(o.id)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Recharges({ db }) {
  const [f, setF] = useState('pending')
  const list = f === 'all' ? db.recharges : db.recharges.filter((r) => r.status === f)
  const email = (id) => db.users.find((u) => u.id === id)?.email || 'deleted'
  return (
    <>
      <h1>Recharge requests</h1>
      <div className="chips">
        {['pending', 'approved', 'rejected', 'all'].map((s) => <button key={s} className={'chip' + (f === s ? ' on' : '')} onClick={() => setF(s)}>{s}</button>)}
      </div>
      {!list.length ? <Empty icon="💳" text="Nothing here." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Transaction ID</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="small">{email(r.userId)}</td>
                  <td><b>{money(r.amount)}</b>{r.requested && r.requested !== r.amount && <div className="muted small">entered {money(r.requested)}</div>}{r.received != null && r.status === 'pending' && <div className="muted small">on-chain {r.received}</div>}</td>
                  <td>{r.method}{r.auto && <div><span className="badge info">⚡ auto</span></div>}</td>
                  <td className="mono small">{explorerTx(r.chain, r.txid) ? <a className="link" href={explorerTx(r.chain, r.txid)} target="_blank" rel="noreferrer">{r.txid.slice(0, 12)}…</a> : r.txid}{r.note && <div className="muted small cell-note">{r.note}</div>}</td>
                  <td className="small">{fmtDate(r.at)}</td>
                  <td><Badge s={r.status} />{r.approvedBy && <div className="muted small">{r.approvedBy}</div>}</td>
                  <td className="btn-row">
                    {r.status === 'pending' && r.chain && <button className="btn ghost sm" onClick={async () => { const x = await checkRecharge(r.id); toast(x.status === 'ok' ? 'Confirmed and credited' : x.reason || x.status, x.status === 'invalid' ? 'error' : 'success') }}>Check now</button>}
                    {r.status === 'pending' && <>
                      <button className="btn sm" onClick={() => { approveRecharge(r.id); toast('Approved — balance added') }}>Approve</button>
                      <button className="btn danger sm" onClick={() => { rejectRecharge(r.id); toast('Rejected') }}>Reject</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Providers({ db }) {
  const [edit, setEdit] = useState(null)
  const [testing, setTesting] = useState(null)
  const live = db.settings.numberSource === 'api'
  async function test(id) {
    setTesting(id)
    try { const b = await testProvider(id); toast('Connected ✓ Provider balance: ' + b) } catch (e) { toast(e.message, 'error') }
    setTesting(null)
  }
  return (
    <>
      <div className="row-between">
        <h1>API providers</h1>
        <button className="btn sm" onClick={() => setEdit(emptyProvider())}>＋ Add API</button>
      </div>

      <div className="card source-card">
        <div>
          <h3>Number source</h3>
          <p className="muted small">Choose where customer numbers come from.</p>
        </div>
        <div className="segmented" role="radiogroup">
          <button role="radio" aria-checked={!live} className={!live ? 'on' : ''} onClick={() => setNumberSource('demo')}>🧪 Demo numbers</button>
          <button role="radio" aria-checked={live} className={live ? 'on' : ''} onClick={() => {
            if (!db.providers.length) return toast('Add an API provider first', 'error')
            setNumberSource('api'); toast('Live API mode on — numbers now come from your provider')
          }}>🔌 Live API</button>
          <span className="seg-thumb" style={{ transform: live ? 'translateX(100%)' : 'none' }} />
        </div>
      </div>

      {!db.providers.length ? <Empty icon="🔌" text="No API added yet. Click “Add API” and paste your provider's API link and key." /> : (
        <div className="provider-grid">
          {db.providers.map((p) => {
            const active = db.settings.activeProvider === p.id
            return (
              <div key={p.id} className={'card provider-card tilt' + (active ? ' is-active' : '')}>
                <div className="row-between">
                  <div><b>{p.name}</b><div className="muted small">{PROVIDER_TYPES[p.type]?.label}</div></div>
                  {active ? <Badge s="active">{live ? '● Live' : 'Active'}</Badge> : <Badge s="closed">{p.enabled ? 'standby' : 'disabled'}</Badge>}
                </div>
                <ul className="info-list">
                  <li><span>API URL</span><b className="mono trunc">{p.baseUrl}</b></li>
                  <li><span>API key</span><b className="mono">{p.apiKey ? p.apiKey.slice(0, 4) + '••••••' + p.apiKey.slice(-3) : '—'}</b></li>
                  <li><span>Balance</span><b>{p.lastBalance != null ? p.lastBalance : '—'}</b></li>
                  <li><span>Last check</span><b className="small">{p.lastCheck ? fmtDate(p.lastCheck) : 'never'}</b></li>
                </ul>
                {p.lastError && <div className="alert bad small">⚠️ {p.lastError}</div>}
                <div className="btn-row">
                  <button className="btn sm" disabled={testing === p.id} onClick={() => test(p.id)}>
                    {testing === p.id ? <><span className="spinner light" /> Testing…</> : '⚡ Test & balance'}
                  </button>
                  {!active && <button className="btn ghost sm" onClick={() => { setActiveProvider(p.id); toast(p.name + ' is now the active provider') }}>Use this</button>}
                  <button className="btn ghost sm" onClick={() => setEdit(p)}>Edit</button>
                  <button className="btn danger sm" onClick={() => confirm('Delete this provider?') && deleteProvider(p.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card how-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li>Click <b>Add API</b>, choose your provider type and paste the <b>API link</b> and <b>API key</b> from your provider's website.</li>
          <li>Press <b>Test & balance</b>. If it shows your provider balance, the connection works.</li>
          <li>Check the <b>API codes</b> in <a className="link" href="#/admin/services">Services</a> and <a className="link" href="#/admin/countries">Countries</a> match your provider's code list.</li>
          <li>Switch <b>Number source</b> to <b>Live API</b>. Customers now get real numbers, and codes appear automatically.</li>
        </ol>
        <p className="muted small">If the test says “network or CORS blocked”, your provider doesn't allow calls straight from a browser. Deploy the small proxy in <span className="mono">proxy/worker.js</span> (free on Cloudflare) and paste its link in the provider's <b>Proxy URL</b>.</p>
      </div>

      {edit && <ProviderForm value={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function ProviderForm({ value, onClose }) {
  const [v, setV] = useState({ ...emptyProvider(), ...value, custom: { ...emptyProvider().custom, ...(value.custom || {}) } })
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  const setC = (k) => (e) => setV({ ...v, custom: { ...v.custom, [k]: e.target.value } })
  return (
    <Modal title={v.id ? 'Edit API provider' : 'Add API provider'} onClose={onClose} wide>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (attempt(() => saveProvider(v), 'Provider saved')) onClose() }}>
        <label>Provider name<input className="input" placeholder="e.g. HeroSMS" value={v.name} onChange={set('name')} /></label>
        <label>API type
          <select className="input" value={v.type} onChange={(e) => {
            const t = e.target.value
            const isDefault = Object.values(PROVIDER_TYPES).some((x) => x.base === v.baseUrl) || !v.baseUrl
            setV({ ...v, type: t, baseUrl: isDefault ? PROVIDER_TYPES[t].base : v.baseUrl })
          }}>
            {Object.entries(PROVIDER_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </label>
        <label>API link (URL)<input className="input mono" value={v.baseUrl} onChange={set('baseUrl')} /></label>
        <label>API key<input className="input mono" type="password" autoComplete="off" value={v.apiKey} onChange={set('apiKey')} /></label>
        <label>Proxy URL (optional)<input className="input mono" placeholder="https://your-proxy.workers.dev" value={v.proxy} onChange={set('proxy')} /></label>
        {v.type === 'custom' && (
          <fieldset className="custom-box">
            <legend>Custom API settings</legend>
            <p className="muted small">Use placeholders <span className="mono">{'{base} {key} {service} {country} {id}'}</span>. Paths read values from the JSON reply, e.g. <span className="mono">data.phone</span>.</p>
            <label>Authorization header (optional)<input className="input mono" placeholder="Bearer xxx" value={v.custom.authHeader} onChange={setC('authHeader')} /></label>
            <label>Get number URL<input className="input mono" value={v.custom.getNumberUrl} onChange={setC('getNumberUrl')} /></label>
            <div className="grid-2">
              <label>Order ID path<input className="input mono" value={v.custom.idPath} onChange={setC('idPath')} /></label>
              <label>Phone number path<input className="input mono" value={v.custom.numberPath} onChange={setC('numberPath')} /></label>
            </div>
            <label>Check SMS URL<input className="input mono" value={v.custom.statusUrl} onChange={setC('statusUrl')} /></label>
            <div className="grid-2">
              <label>Code path<input className="input mono" value={v.custom.codePath} onChange={setC('codePath')} /></label>
              <label>SMS text path<input className="input mono" value={v.custom.smsTextPath} onChange={setC('smsTextPath')} /></label>
            </div>
            <label>Cancel URL<input className="input mono" value={v.custom.cancelUrl} onChange={setC('cancelUrl')} /></label>
            <label>Finish URL<input className="input mono" value={v.custom.finishUrl} onChange={setC('finishUrl')} /></label>
            <div className="grid-2">
              <label>Balance URL<input className="input mono" value={v.custom.balanceUrl} onChange={setC('balanceUrl')} /></label>
              <label>Balance path<input className="input mono" value={v.custom.balancePath} onChange={setC('balancePath')} /></label>
            </div>
          </fieldset>
        )}
        <fieldset className="custom-box">
          <legend>How this provider charges you</legend>
          <label className="check"><input type="checkbox" checked={v.allowExtend !== false} onChange={(e) => setV({ ...v, allowExtend: e.target.checked })} /> Allow customers to extend these numbers (only if your provider supports extending; you pay the provider's extension fee)</label>
          <label className="check"><input type="checkbox" checked={!!v.freeResend} onChange={(e) => setV({ ...v, freeResend: e.target.checked })} /> Second code is free with this provider — don't charge customers for Resend</label>
          <p className="muted small">If a number isn't available, the customer sees "No numbers available right now" and is not charged.</p>
        </fieldset>
        <label className="check"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
        <button className="btn full">Save provider</button>
      </form>
    </Modal>
  )
}

function Services({ db }) {
  const [edit, setEdit] = useState(null)
  const base = db.countries.find((c) => c.enabled) || { mult: 1 }
  return (
    <>
      <div className="row-between"><h1>Services & prices</h1><button className="btn sm" onClick={() => setEdit({ name: '', icon: '🌐', pcode: '', price: 0.1, stock: 100, enabled: true })}>＋ Add service</button></div>
      <p className="muted small">Base price is multiplied by each country's multiplier (see Countries).</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Service</th><th>API code</th><th>Base price</th><th>Example ({base.name})</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {db.services.map((s) => (
              <tr key={s.id}>
                <td><b>{s.icon} {s.name}</b>{Object.keys(s.rentPrices || {}).length > 0 && <div><span className="badge info">custom extension prices</span></div>}</td><td className="mono">{s.pcode || '—'}</td><td>{money(s.price)}</td><td>{money(priceFor(s, base))}</td><td>{s.stock}</td>
                <td><Badge s={s.enabled ? 'active' : 'closed'}>{s.enabled ? 'enabled' : 'disabled'}</Badge></td>
                <td className="btn-row">
                  <button className="btn ghost sm" onClick={() => setEdit(s)}>Edit</button>
                  <button className="btn ghost sm" onClick={() => saveService({ ...s, enabled: !s.enabled })}>{s.enabled ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit service' : 'New service'} onClose={() => setEdit(null)} wide>
          <ServiceForm db={db} value={edit} onDone={() => setEdit(null)} />
        </Modal>
      )}
    </>
  )
}

function ServiceForm({ db, value, onDone }) {
  const [v, setV] = useState({ ...value, rentPrices: { ...(value.rentPrices || {}) } })
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  const base = db.countries.find((c) => c.enabled) || { mult: 1, name: '' }
  const numberPrice = priceFor({ price: Number(v.price) || 0 }, base)
  const plans = [shortPlan(db), ...(db.settings.rentPlans || []).filter((p) => p.enabled)]
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault()
      if (attempt(() => { if (!v.name.trim()) throw new Error('Name is required'); saveService(v) }, 'Service saved')) onDone()
    }}>
      <div className="grid-2">
        <label>Name<input className="input" value={v.name} onChange={set('name')} /></label>
        <label>Icon (emoji)<input className="input" value={v.icon} onChange={set('icon')} /></label>
        <label>Provider service code (e.g. wa, tg)<input className="input mono" value={v.pcode || ''} onChange={set('pcode')} /></label>
        <label>Base price (USD)<input className="input" type="number" step="0.01" value={v.price} onChange={set('price')} /></label>
        <label>Stock (demo mode)<input className="input" type="number" value={v.stock} onChange={set('stock')} /></label>
      </div>

      <fieldset className="custom-box">
        <legend>Resend price for this service</legend>
        <label className="rent-cell" style={{ maxWidth: 220 }}>
          <span>🔁 Resend code</span>
          <div className="money-input"><span>$</span>
            <input className="input" type="number" step="0.01" min="0" placeholder={(numberPrice * (db.settings.resendMult ?? 0.5)).toFixed(2)} value={v.resendPrice ?? ''} onChange={set('resendPrice')} />
          </div>
          <small className="muted">{v.resendPrice == null || v.resendPrice === '' ? `default (${Math.round((db.settings.resendMult ?? 0.5) * 100)}% of price)` : 'custom'}</small>
        </label>
      </fieldset>

      <fieldset className="custom-box">
        <legend>Extension prices for this service</legend>
        <p className="muted small">Leave empty to use the default from Settings. Prices are the same for every country. Default shown for {base.name} ({money(numberPrice)} number).</p>
        <div className="rent-grid">
          {plans.map((p) => {
            const def = planCost(p, numberPrice, null)
            const val = v.rentPrices[p.id] ?? ''
            return (
              <label key={p.id} className="rent-cell">
                <span>{p.label}</span>
                <div className="money-input">
                  <span>$</span>
                  <input className="input" type="number" step="0.01" min="0" placeholder={def.toFixed(2)} value={val}
                    onChange={(e) => setV({ ...v, rentPrices: { ...v.rentPrices, [p.id]: e.target.value } })} />
                </div>
                <small className="muted">{val === '' ? 'default' : 'custom'}</small>
              </label>
            )
          })}
        </div>
        {Object.values(v.rentPrices).some((x) => x !== '') && (
          <button type="button" className="btn ghost sm" onClick={() => setV({ ...v, rentPrices: {} })}>Reset to defaults</button>
        )}
      </fieldset>

      <label className="check"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
      <div className="btn-row">
        <button className="btn">Save</button>
        {v.id && <button type="button" className="btn danger" onClick={() => { if (confirm('Delete permanently?')) { deleteService(v.id); onDone(); toast('Service deleted') } }}>Delete</button>}
      </div>
    </form>
  )
}

function Countries({ db }) {
  const [edit, setEdit] = useState(null)
  return (
    <>
      <div className="row-between"><h1>Countries</h1><button className="btn sm" onClick={() => setEdit({ name: '', flag: '🏳️', iso: '', code: '+', pcode: '', areaCodes: '', mult: 1, enabled: true })}>＋ Add country</button></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Country</th><th>API code</th><th>Dial code</th><th>Price multiplier</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {db.countries.map((c) => (
              <tr key={c.id}>
                <td><b><Flag country={c} /> {c.name}</b></td><td className="mono">{c.pcode || '—'}</td><td className="mono">{c.code}</td><td>×{c.mult}</td>
                <td><Badge s={c.enabled ? 'active' : 'closed'}>{c.enabled ? 'enabled' : 'disabled'}</Badge></td>
                <td className="btn-row">
                  <button className="btn ghost sm" onClick={() => setEdit(c)}>Edit</button>
                  <button className="btn ghost sm" onClick={() => saveCountry({ ...c, enabled: !c.enabled })}>{c.enabled ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit country' : 'New country'} onClose={() => setEdit(null)}>
          <EditForm
            value={edit}
            fields={[['name', 'Name'], ['flag', 'Flag (emoji)'], ['iso', 'Country ISO code for flag image (e.g. us, gb, bd)'], ['code', 'Dial code'], ['pcode', 'Provider country code (e.g. 187)'], ['mult', 'Price multiplier', 'number'], ['areaCodes', 'Area codes customers can pick (comma separated, empty = off)']]}
            onSave={(v) => { if (attempt(() => { if (!v.name.trim()) throw new Error('Name is required'); saveCountry(v) }, 'Country saved')) setEdit(null) }}
            onDelete={edit.id && (() => { deleteCountry(edit.id); setEdit(null); toast('Country deleted') })}
          />
        </Modal>
      )}
    </>
  )
}

function EditForm({ value, fields, onSave, onDelete }) {
  const [v, setV] = useState(value)
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(v) }}>
      {fields.map(([k, label, type]) => (
        <label key={k}>{label}<input className="input" type={type || 'text'} step="0.01" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
      ))}
      <label className="check"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
      <div className="btn-row">
        <button className="btn">Save</button>
        {onDelete && <button type="button" className="btn danger" onClick={() => confirm('Delete permanently?') && onDelete()}>Delete</button>}
      </div>
    </form>
  )
}

function SmsCenter({ db }) {
  const msgs = db.orders.flatMap((o) => o.sms.map((m) => ({ ...m, o }))).sort((a, b) => b.at - a.at)
  const email = (id) => db.users.find((u) => u.id === id)?.email || 'deleted'
  return (
    <>
      <h1>SMS center</h1>
      {!msgs.length ? <Empty icon="💬" text="No SMS received yet." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Number</th><th>Service</th><th>User</th><th>Code</th><th>Message</th><th>Time</th></tr></thead>
            <tbody>
              {msgs.map((m, i) => (
                <tr key={i}><td className="mono">{m.o.number}</td><td>{m.o.icon} {m.o.service}</td><td className="small">{email(m.o.userId)}</td><td className="mono"><b>{m.code}</b></td><td className="small">{m.text}</td><td className="small">{fmtDate(m.at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Tickets({ db }) {
  const [open, setOpen] = useState(null)
  const [reply, setReply] = useState('')
  const t = db.tickets.find((x) => x.id === open)
  const email = (id) => db.users.find((u) => u.id === id)?.email || 'deleted'
  return (
    <>
      <h1>Support tickets</h1>
      {!db.tickets.length ? <Empty icon="🎧" text="No tickets yet." /> : (
        <div className="list-card">
          {db.tickets.map((k) => (
            <button className="list-row clickable" key={k.id} onClick={() => setOpen(k.id)}>
              <div className="grow"><b>{k.subject}</b><div className="muted small">{email(k.userId)} · {fmtDate(k.at)} · {k.messages.length} messages</div></div>
              <Badge s={k.status} />
            </button>
          ))}
        </div>
      )}
      {t && (
        <Modal title={t.subject} onClose={() => setOpen(null)} wide>
          <Thread ticket={t} />
          <form className="reply" onSubmit={(e) => { e.preventDefault(); if (attempt(() => replyTicket(t.id, reply, 'admin'), 'Reply sent')) setReply('') }}>
            <input className="input" placeholder="Reply as support…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className="btn">Send</button>
            {t.status !== 'closed' && <button type="button" className="btn ghost" onClick={() => closeTicket(t.id)}>Close</button>}
          </form>
        </Modal>
      )}
    </>
  )
}

function Transactions({ db }) {
  const email = (id) => db.users.find((u) => u.id === id)?.email || 'deleted'
  return (
    <>
      <h1>All transactions</h1>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>User</th><th>Type</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>
            {db.transactions.map((t) => (
              <tr key={t.id}>
                <td className="small">{email(t.userId)}</td><td><Badge s={t.type} /></td><td>{t.note}</td>
                <td className={t.type === 'debit' ? 'neg' : 'pos'}>{t.type === 'debit' ? '−' : '+'}{money(t.amount)}</td><td className="small">{fmtDate(t.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function NoticeCard({ db }) {
  const n = activeNotice(db)
  const [text, setText] = useState('')
  const [tone, setTone] = useState('info')
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); if (attempt(() => postNotice(text, tone, 24), 'Notice posted for 24 hours')) setText('') }}>
      <h3>📢 Notice for all users (24 hours)</h3>
      {n && (
        <div className={'notice-preview ' + n.tone}>
          <div className="small"><b>Live now</b> · ends {fmtDate(n.until)}</div>
          <div>{n.text}</div>
          <button type="button" className="btn danger sm" onClick={() => { clearNotice(); toast('Notice removed') }}>Remove now</button>
        </div>
      )}
      <textarea className="input" rows="3" maxLength={200} placeholder="e.g. WhatsApp numbers are back in stock! / Maintenance tonight 2–3 AM." value={text} onChange={(e) => setText(e.target.value)} />
      <div className="chips tight">
        {[['info', 'ℹ️ Info'], ['success', '✅ Good news'], ['warn', '⚠️ Warning']].map(([k, l]) => (
          <button type="button" key={k} className={'chip' + (tone === k ? ' on' : '')} onClick={() => setTone(k)}>{l}</button>
        ))}
      </div>
      <button className="btn full">{n ? 'Replace notice' : 'Post notice'} (24 hours)</button>
      <p className="muted small">Appears as a small bar at the top of the site for everyone and disappears automatically after 24 hours.</p>
    </form>
  )
}

function Settings({ db }) {
  const s = db.settings
  const [f, setF] = useState({ areaCodeFeePct: s.areaCodeFeePct ?? 20, maxQty: s.maxQty ?? 10, siteName: s.siteName, announcement: s.announcement, minRecharge: s.minRecharge, referralPercent: s.referralPercent, orderMinutes: s.orderMinutes, extendMinutes: s.extendMinutes })
  const [pm, setPm] = useState(s.paymentMethods)
  const [tg, setTg] = useState(s.telegramSupport || '')
  const [av, setAv] = useState({ autoVerify: s.autoVerify ?? true, minConfirmations: s.minConfirmations ?? 3, bscRpc: s.bscRpc || '', tronApiKey: s.tronApiKey || '' })
  const [plans, setPlans] = useState(s.rentPlans || [])
  const [shortMult, setShortMult] = useState(s.extendMult ?? 0.5)
  const [resendPct, setResendPct] = useState(Math.round((s.resendMult ?? 0.5) * 100))
  const setPlan = (i, k, val) => setPlans(plans.map((p, j) => (j === i ? { ...p, [k]: val } : p)))
  const [cred, setCred] = useState({ adminUser: s.adminUser, adminPass: '' })
  const num = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) })
  return (
    <>
      <h1>Settings</h1>
      <div className="grid-2">
        <div className="form" style={{ gap: 20 }}>
          <NoticeCard db={db} />
          <form className="card form" onSubmit={(e) => {
            e.preventDefault()
            let url = tg.trim()
            if (url && !/^https?:\/\//.test(url)) url = 'https://t.me/' + url.replace(/^@/, '').replace(/^t\.me\//, '')
            saveSettings({ telegramSupport: url }); setTg(url); toast(url ? 'Telegram support link saved' : 'Telegram link removed')
          }}>
            <h3>✈️ Telegram support</h3>
            <p className="muted small">Shown on every user's Overview instead of "Get help". Paste your Telegram username or link.</p>
            <input className="input" placeholder="@yoursupport or https://t.me/yoursupport" value={tg} onChange={(e) => setTg(e.target.value)} />
            <button className="btn full">Save Telegram link</button>
          </form>
        <form className="card form" onSubmit={(e) => { e.preventDefault(); saveSettings(f); toast('Settings saved') }}>
          <h3>General</h3>
          <label>Site name<input className="input" value={f.siteName} onChange={(e) => setF({ ...f, siteName: e.target.value })} /></label>
          <label>Announcement bar (leave empty to hide)<input className="input" value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} /></label>
          <label>Minimum recharge (USD)<input className="input" type="number" step="0.01" value={f.minRecharge} onChange={num('minRecharge')} /></label>
          <label>Referral commission (%)<input className="input" type="number" value={f.referralPercent} onChange={num('referralPercent')} /></label>
          <label>Number active time (minutes)<input className="input" type="number" value={f.orderMinutes} onChange={num('orderMinutes')} /></label>
          <label>Extend time (minutes)<input className="input" type="number" value={f.extendMinutes} onChange={num('extendMinutes')} /></label>
          <label>Custom area code surcharge (%)<input className="input" type="number" min="0" value={f.areaCodeFeePct} onChange={num('areaCodeFeePct')} /></label>
          <label>Max numbers per purchase<input className="input" type="number" min="1" max="100" value={f.maxQty} onChange={num('maxQty')} /></label>
          <button className="btn full">Save settings</button>
        </form>
        </div>
        <div>
          <form className="card form" onSubmit={(e) => {
            e.preventDefault()
            const clean = plans.filter((p) => p.label.trim()).map((p) => ({ ...p, minutes: Math.max(1, Math.round(Number(p.days) ? Number(p.days) * 1440 : p.minutes)), mult: Number(p.mult) || 0, price: Number(p.price) || 0, days: undefined }))
            saveSettings({ rentPlans: clean, extendMult: Number(shortMult) || 0, resendMult: (Number(resendPct) || 0) / 100 }); setPlans(clean); toast('Resend & extension prices saved')
          }}>
            <h3>Resend price</h3>
            <div className="plan-edit short">
              <span><b>🔁 Resend code</b> <span className="muted small">(new code on the same number)</span></span>
              <div className="money-input"><input className="input" type="number" min="0" max="500" step="1" value={resendPct} onChange={(e) => setResendPct(e.target.value)} /><span style={{ paddingRight: 10 }}>%</span></div>
              <span className="muted small">of the buying price, e.g. {money(0.24 * (Number(resendPct) || 0) / 100)} for a $0.24 number</span>
            </div>
            <h3>Number extension plans</h3>
            <p className="muted small">Default prices for keeping a number longer. Choose <b>Fixed $</b> for one price for every number, or <b>× number</b> to multiply the number's price. You can still set a different price per service in <a className="link" href="#/admin/services">Services</a>.</p>
            <div className="plan-edit short">
              <span><b>{s.extendMinutes} minutes</b> <span className="muted small">(short)</span></span>
              <div className="money-input"><span>×</span><input className="input" type="number" min="0" step="0.05" value={shortMult} onChange={(e) => setShortMult(e.target.value)} /></div>
              <span className="muted small">e.g. {money(0.24 * (Number(shortMult) || 0))} for a $0.24 number</span>
            </div>
            <div className="plan-edit head"><span>Label</span><span>Days</span><span>Price type</span><span>Price</span><span>On</span><span /></div>
            {plans.map((p, i) => (
              <div className="plan-edit" key={p.id}>
                <input className="input" value={p.label} onChange={(e) => setPlan(i, 'label', e.target.value)} />
                <input className="input" type="number" min="1" step="1" value={p.days ?? Math.round(p.minutes / 1440)} onChange={(e) => setPlan(i, 'days', e.target.value)} />
                <select className="input" value={p.priceType || 'mult'} onChange={(e) => setPlan(i, 'priceType', e.target.value)}>
                  <option value="mult">× number</option>
                  <option value="fixed">Fixed $</option>
                </select>
                {p.priceType === 'fixed'
                  ? <div className="money-input"><span>$</span><input className="input" type="number" min="0" step="0.01" value={p.price} onChange={(e) => setPlan(i, 'price', e.target.value)} /></div>
                  : <div className="money-input"><span>×</span><input className="input" type="number" min="0" step="0.1" value={p.mult} onChange={(e) => setPlan(i, 'mult', e.target.value)} /></div>}
                <input type="checkbox" aria-label="Enabled" checked={p.enabled} onChange={(e) => setPlan(i, 'enabled', e.target.checked)} />
                <button type="button" className="icon-btn" aria-label="Remove plan" onClick={() => setPlans(plans.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className="btn-row">
              <button type="button" className="btn ghost sm" onClick={() => setPlans([...plans, { id: 'p' + Date.now(), label: 'New plan', minutes: 1440, days: 1, priceType: 'fixed', price: 1, mult: 3, enabled: true }])}>＋ Add plan</button>
            </div>
            <p className="muted small">Change the short extension's length under General → Extend time.</p>
            <button className="btn full">Save resend & extension prices</button>
          </form>
          <form className="card form" onSubmit={(e) => { e.preventDefault(); saveSettings({ autoVerify: av.autoVerify, minConfirmations: Number(av.minConfirmations) || 1, bscRpc: av.bscRpc, tronApiKey: av.tronApiKey }); toast('Auto-verification settings saved') }}>
            <h3>⚡ Automatic crypto payments</h3>
            <label className="check"><input type="checkbox" checked={av.autoVerify} onChange={(e) => setAv({ ...av, autoVerify: e.target.checked })} /> Verify USDT BEP20 / TRC20 payments on the blockchain and add balance automatically</label>
            <p className="muted small">Checks that the TxID is a successful USDT transfer to your wallet, credits the amount that actually arrived, and blocks reused TxIDs. Binance Pay stays manual.</p>
            <label>BEP20 confirmations required<input className="input" type="number" min="1" max="50" value={av.minConfirmations} onChange={(e) => setAv({ ...av, minConfirmations: e.target.value })} /></label>
            <label>BSC RPC URL (optional, default = public BNB Chain nodes)<input className="input mono small" placeholder="https://bsc-dataseed.bnbchain.org" value={av.bscRpc} onChange={(e) => setAv({ ...av, bscRpc: e.target.value })} /></label>
            <label>TronGrid API key (optional, for higher limits)<input className="input mono small" value={av.tronApiKey} onChange={(e) => setAv({ ...av, tronApiKey: e.target.value })} /></label>
            <button className="btn full">Save auto-verification</button>
          </form>
          <form className="card form" onSubmit={(e) => {
            e.preventDefault()
            if (pm.some((m) => m.enabled && !m.details.trim())) return toast('An enabled method has no address. Fill it in or switch it off.', 'error')
            saveSettings({ paymentMethods: pm }); toast('Payment methods saved')
          }}>
            <h3>Payment methods</h3>
            <p className="muted small">Customers see the enabled methods on the Recharge page. Wallet addresses get a QR code and a copy button.</p>
            {pm.map((m, i) => {
              const setM = (k, val) => setPm(pm.map((x, j) => (j === i ? { ...x, [k]: val } : x)))
              return (
                <div key={m.id} className={'pm-card' + (m.enabled ? ' on' : '')}>
                  <div className="row-between">
                    <label className="check"><input type="checkbox" checked={m.enabled} onChange={(e) => setM('enabled', e.target.checked)} /> <b>{m.name || 'New method'}</b></label>
                    <button type="button" className="icon-btn" aria-label="Remove method" onClick={() => confirm('Remove this payment method?') && setPm(pm.filter((_, j) => j !== i))}>✕</button>
                  </div>
                  <div className="grid-2">
                    <input className="input" placeholder="Name (e.g. USDT (BEP20))" value={m.name} onChange={(e) => setM('name', e.target.value)} />
                    <input className="input" placeholder="Network (e.g. BNB Smart Chain (BEP20))" value={m.network || ''} onChange={(e) => setM('network', e.target.value)} />
                  </div>
                  <input className="input mono small" placeholder="Wallet address / account number / Pay ID" value={m.details} onChange={(e) => setM('details', e.target.value)} />
                  <div className="btn-row">
                    <label className="check small"><input type="checkbox" checked={!!m.qr} onChange={(e) => setM('qr', e.target.checked)} /> Show QR code</label>
                    <select className="input small" style={{ width: 'auto' }} value={m.chain || ''} onChange={(e) => setM('chain', e.target.value)}>
                      <option value="">Manual approval</option>
                      <option value="bep20">⚡ Auto-verify USDT BEP20</option>
                      <option value="trc20">⚡ Auto-verify USDT TRC20</option>
                    </select>
                  </div>
                  {m.enabled && !m.details.trim() && <span className="badge bad">Add the address before enabling</span>}
                </div>
              )
            })}
            <button type="button" className="btn ghost sm" onClick={() => setPm([...pm, { id: 'm' + Date.now(), name: '', network: '', details: '', qr: false, enabled: false }])}>＋ Add payment method</button>
            <button className="btn full">Save payment methods</button>
          </form>
          <form className="card form" onSubmit={(e) => {
            e.preventDefault()
            if (!cred.adminUser.trim() || cred.adminPass.length < 4) return toast('Username required, password at least 4 characters', 'error')
            saveSettings(cred); setCred({ ...cred, adminPass: '' }); toast('Admin login updated')
          }}>
            <h3>Admin login</h3>
            <label>Username<input className="input" value={cred.adminUser} onChange={(e) => setCred({ ...cred, adminUser: e.target.value })} /></label>
            <label>New password<input className="input" type="password" value={cred.adminPass} onChange={(e) => setCred({ ...cred, adminPass: e.target.value })} /></label>
            <button className="btn full">Update admin login</button>
          </form>
          <div className="card form">
            <h3>Danger zone</h3>
            <p className="muted small">Reset all data (users, orders, settings) back to the demo defaults.</p>
            <button className="btn danger" onClick={() => { if (confirm('Reset ALL data?')) { resetDB(); toast('Data reset') } }}>Reset demo data</button>
          </div>
        </div>
      </div>
    </>
  )
}
