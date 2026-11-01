import { useState } from 'react'
import { usePath, navigate } from '../router.jsx'
import {
  useDB, money, fmtDate, adminLogin, adminLogout, approveRecharge, rejectRecharge, adjustBalance, toggleBan, deleteUser,
  saveService, deleteService, saveCountry, deleteCountry, saveSettings, adminCancelOrder, replyTicket, closeTicket, toggleTheme, resetDB, priceFor,
} from '../store.js'
import { Badge, Stat, Empty, Modal, attempt, toast } from '../ui.jsx'
import { Thread } from './Dashboard.jsx'

const TABS = [
  ['', '📊', 'Overview'], ['users', '👥', 'Users'], ['orders', '🧾', 'Orders'], ['recharges', '💳', 'Recharges'],
  ['services', '📲', 'Services'], ['countries', '🌍', 'Countries'], ['sms', '💬', 'SMS Center'],
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
  const Page = { '': Overview, users: Users, orders: Orders, recharges: Recharges, services: Services, countries: Countries, sms: SmsCenter, tickets: Tickets, transactions: Transactions, settings: Settings }[tab] || Overview

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
  const revenue = db.orders.filter((o) => !['cancelled', 'expired'].includes(o.status)).reduce((a, o) => a + o.price, 0)
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
          <thead><tr><th>User</th><th>Balance</th><th>Orders</th><th>Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td><b>{x.name}</b><div className="muted small">{x.email}</div></td>
                <td>{money(x.balance)}</td>
                <td>{db.orders.filter((o) => o.userId === x.id).length}</td>
                <td className="small">{fmtDate(x.createdAt)}</td>
                <td><Badge s={x.banned ? 'banned' : 'active'} /></td>
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
            <li><span>Password</span><b className="mono">{u.password}</b></li>
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
            <button className="btn ghost sm" onClick={() => toggleBan(u.id)}>{u.banned ? 'Unban user' : 'Ban user'}</button>
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
                  <td>{o.icon} {o.service}<div className="muted small">{o.flag} {o.country}</div></td>
                  <td className="mono">{o.number}</td>
                  <td>{money(o.price)}</td>
                  <td className="mono">{o.sms[o.sms.length - 1]?.code || '—'}</td>
                  <td><Badge s={o.status} /></td>
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
                  <td className="small">{email(r.userId)}</td><td><b>{money(r.amount)}</b></td><td>{r.method}</td>
                  <td className="mono small">{r.txid}</td><td className="small">{fmtDate(r.at)}</td><td><Badge s={r.status} /></td>
                  <td className="btn-row">
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

function Services({ db }) {
  const [edit, setEdit] = useState(null)
  const base = db.countries.find((c) => c.enabled) || { mult: 1 }
  return (
    <>
      <div className="row-between"><h1>Services & prices</h1><button className="btn sm" onClick={() => setEdit({ name: '', icon: '🌐', price: 0.1, stock: 100, enabled: true })}>＋ Add service</button></div>
      <p className="muted small">Base price is multiplied by each country's multiplier (see Countries).</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Service</th><th>Base price</th><th>Example ({base.name})</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {db.services.map((s) => (
              <tr key={s.id}>
                <td><b>{s.icon} {s.name}</b></td><td>{money(s.price)}</td><td>{money(priceFor(s, base))}</td><td>{s.stock}</td>
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
        <Modal title={edit.id ? 'Edit service' : 'New service'} onClose={() => setEdit(null)}>
          <EditForm
            value={edit}
            fields={[['name', 'Name'], ['icon', 'Icon (emoji)'], ['price', 'Base price (USD)', 'number'], ['stock', 'Stock', 'number']]}
            onSave={(v) => { if (attempt(() => { if (!v.name.trim()) throw new Error('Name is required'); saveService(v) }, 'Service saved')) setEdit(null) }}
            onDelete={edit.id && (() => { deleteService(edit.id); setEdit(null); toast('Service deleted') })}
          />
        </Modal>
      )}
    </>
  )
}

function Countries({ db }) {
  const [edit, setEdit] = useState(null)
  return (
    <>
      <div className="row-between"><h1>Countries</h1><button className="btn sm" onClick={() => setEdit({ name: '', flag: '🏳️', code: '+', mult: 1, enabled: true })}>＋ Add country</button></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Country</th><th>Dial code</th><th>Price multiplier</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {db.countries.map((c) => (
              <tr key={c.id}>
                <td><b>{c.flag} {c.name}</b></td><td className="mono">{c.code}</td><td>×{c.mult}</td>
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
            fields={[['name', 'Name'], ['flag', 'Flag (emoji)'], ['code', 'Dial code'], ['mult', 'Price multiplier', 'number']]}
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

function Settings({ db }) {
  const s = db.settings
  const [f, setF] = useState({ siteName: s.siteName, announcement: s.announcement, minRecharge: s.minRecharge, referralPercent: s.referralPercent, orderMinutes: s.orderMinutes, extendMinutes: s.extendMinutes })
  const [pm, setPm] = useState(s.paymentMethods)
  const [cred, setCred] = useState({ adminUser: s.adminUser, adminPass: '' })
  const num = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) })
  return (
    <>
      <h1>Settings</h1>
      <div className="grid-2">
        <form className="card form" onSubmit={(e) => { e.preventDefault(); saveSettings(f); toast('Settings saved') }}>
          <h3>General</h3>
          <label>Site name<input className="input" value={f.siteName} onChange={(e) => setF({ ...f, siteName: e.target.value })} /></label>
          <label>Announcement bar (leave empty to hide)<input className="input" value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} /></label>
          <label>Minimum recharge (USD)<input className="input" type="number" step="0.01" value={f.minRecharge} onChange={num('minRecharge')} /></label>
          <label>Referral commission (%)<input className="input" type="number" value={f.referralPercent} onChange={num('referralPercent')} /></label>
          <label>Number active time (minutes)<input className="input" type="number" value={f.orderMinutes} onChange={num('orderMinutes')} /></label>
          <label>Extend time (minutes)<input className="input" type="number" value={f.extendMinutes} onChange={num('extendMinutes')} /></label>
          <button className="btn full">Save settings</button>
        </form>
        <div>
          <form className="card form" onSubmit={(e) => { e.preventDefault(); saveSettings({ paymentMethods: pm }); toast('Payment methods saved') }}>
            <h3>Payment methods</h3>
            {pm.map((m, i) => (
              <div key={m.id} className="pm-row">
                <label className="check"><input type="checkbox" checked={m.enabled} onChange={(e) => setPm(pm.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} /> <b>{m.name}</b></label>
                <input className="input" value={m.details} onChange={(e) => setPm(pm.map((x, j) => (j === i ? { ...x, details: e.target.value } : x)))} />
              </div>
            ))}
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
