import { useState } from 'react'
import { Link, usePath, navigate } from '../router.jsx'
import {
  useDB, currentUser, money, fmtDate, cancelOrder, extendOrder, extendOptions, canExtend, finishOrder, resendCode, resendCost, canResend, requestRecharge,
  transferBalance, regenerateApiKey, updateProfile, createTicket, replyTicket, closeTicket, logout,
} from '../store.js'
import { Badge, Countdown, copy, Empty, Stat, attempt, Modal, Flag, toast as toast_, avatarColor } from '../ui.jsx'
import { explorerTx } from '../chain.js'

const TABS = [
  ['', '📊', 'Overview'], ['active', '📲', 'Active Numbers'], ['rentals', '📅', 'My Rentals'], ['orders', '🧾', 'Orders'], ['sms', '💬', 'SMS History'],
  ['recharge', '💳', 'Recharge'], ['transactions', '📜', 'Transactions'], ['transfer', '🔁', 'Transfer'],
  ['referrals', '🤝', 'Referrals'], ['api', '🔌', 'API Access'], ['support', '🎧', 'Support'], ['profile', '👤', 'Profile'],
]

export default function Dashboard() {
  const db = useDB()
  const user = currentUser(db)
  const path = usePath()
  const tab = path.split('/')[2] || ''

  if (!user) {
    return (
      <div className="container section center">
        <h1>Dashboard</h1>
        <p className="muted">Log in to see your numbers, SMS codes and wallet.</p>
        <div className="hero-cta center-row"><Link to="/login" className="btn">Log in</Link><Link to="/register" className="btn ghost">Sign up</Link></div>
      </div>
    )
  }

  const orders = db.orders.filter((o) => o.userId === user.id)
  const Page = { '': Overview, active: Active, rentals: Rentals, orders: Orders, sms: Sms, recharge: Recharge, transactions: Transactions, transfer: Transfer, referrals: Referrals, api: Api, support: Support, profile: Profile }[tab] || Overview

  return (
    <div className="container dash">
      <aside className="sidebar">
        <div className="side-user">
          <div className="avatar" style={{ background: avatarColor(user.id) }}>{user.name[0]?.toUpperCase()}</div>
          <div><b>{user.name}</b><div className="muted small">{user.email}</div></div>
        </div>
        {TABS.map(([k, i, l]) => (
          <a key={k} href={'#/dashboard' + (k ? '/' + k : '')} className={'side-link' + (tab === k ? ' active' : '')}>
            <span>{i}</span>{l}
            {k === 'active' && orders.some((o) => ['waiting', 'received'].includes(o.status)) && (
              <span className="dot-count">{orders.filter((o) => ['waiting', 'received'].includes(o.status)).length}</span>
            )}
          </a>
        ))}
        <button className="side-link" onClick={() => { const next = logout(); if (!next) navigate('/') }}><span>🚪</span>Sign out</button>
      </aside>
      <section className="dash-main tab-enter" key={tab}>
        <Page db={db} user={user} orders={orders} />
      </section>
    </div>
  )
}

function Overview({ db, user, orders }) {
  const active = orders.filter((o) => ['waiting', 'received'].includes(o.status))
  return (
    <>
      <h1>Welcome, {user.name.split(' ')[0]} 👋</h1>
      {user.balance < 0.5 && (
        <div className="alert warn">⚠️ Your balance is low. <a href="#/dashboard/recharge" className="link">Recharge now</a> to keep buying numbers.</div>
      )}
      <div className="stats">
        <Stat icon="💰" label="Balance" value={money(user.balance)} tone="primary" />
        <Stat icon="🧾" label="Total orders" value={orders.length} />
        <Stat icon="📲" label="Active numbers" value={active.length} />
        <Stat icon="🤝" label="Referrals" value={db.users.filter((u) => u.referredBy === user.id).length} />
      </div>
      <div className="quick">
        <Link to="/buy" className="btn">📲 Buy number</Link>
        <a href="#/dashboard/recharge" className="btn ghost">💳 Recharge</a>
        <a href="#/dashboard/support" className="btn ghost">🎧 Get help</a>
      </div>
      <h2 className="h2">Active numbers</h2>
      {active.length ? <OrderCards orders={active} db={db} /> : <Empty icon="📲" text="No active numbers. Buy one to receive an SMS code." />}
      <h2 className="h2">Recent orders</h2>
      <OrderTable orders={orders.slice(0, 5)} />
    </>
  )
}

const appName = (o) => (/any service/i.test(o.service) ? 'any app' : o.service)

function OrderCards({ orders, db }) {
  return (
    <div className="order-cards">
      {orders.map((o) => (
        <div className={'card order-card tilt soft' + (o.status === 'received' ? ' got-sms' : '')} key={o.id}>
          <div className="row-between">
            <div><span className="service-icon">{o.icon}</span> <b>{o.service}</b> <span className="muted small"><Flag id={o.countryId} /> {o.country}</span></div>
            <Badge s={o.rented ? 'info' : o.status}>{o.rented ? '📅 Rented' : o.status === 'waiting' ? (o.sms.length ? '🔁 Waiting for new code' : '⏳ Waiting for SMS') : '✅ SMS received'}</Badge>
          </div>
          <div className="number-line">
            <span className="mono big">{o.number}</span>
            <button className="btn ghost sm" onClick={() => copy(o.number.replace(/\s/g, ''))}>📋 Copy</button>
          </div>
          {o.sms.length > 0 ? o.sms.map((m, i) => (
            <div className="sms-bubble sms-new" key={i}>
              <small>{fmtDate(m.at)}</small>{m.text}
              <div className="code-row"><span className="mono code">{m.code}</span><button className="btn sm" onClick={() => copy(m.code)}>Copy code</button></div>
            </div>
          )) : null}
          {o.status === 'waiting' && <div className="waiting"><span className="spinner" /> {o.sms.length ? 'Waiting for a new code… request it again on ' + appName(o) + ' now.' : `Waiting for SMS… use this number on ${appName(o)} now.`}</div>}
          {o.rented && o.sms.length > 0 && <div className="waiting small"><span className="spinner" /> Listening for new SMS until {fmtDate(o.expiresAt)}</div>}
          <div className="row-between order-foot">
            <span className="muted small">{o.rented ? 'Rental ends in' : 'Expires in'} <Countdown to={o.expiresAt} /></span>
            <div className="btn-row">
              {canResend(o) && <ResendButton o={o} />}
              <ExtendButton o={o} />
              {o.status === 'waiting'
                ? <button className="btn danger sm" onClick={() => attempt(() => cancelOrder(o.id), 'Cancelled and refunded')}>Cancel</button>
                : !o.rented && <button className="btn sm" onClick={() => finishOrder(o.id)}>Done</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function OrderTable({ orders }) {
  if (!orders.length) return <Empty text="No orders yet." />
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Service</th><th>Number</th><th>Price</th><th>Code</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.icon} {o.service}<div className="muted small"><Flag id={o.countryId} /> {o.country}</div></td>
              <td className="mono">{o.number}</td>
              <td>{money(o.price)}</td>
              <td className="mono">{o.sms[o.sms.length - 1]?.code || '—'}</td>
              <td>
                {o.rented && ['waiting', 'received'].includes(o.status) ? <Badge s="info">📅 Rented</Badge> : <Badge s={o.status} />}
                {o.rented && ['waiting', 'received'].includes(o.status) && <div className="muted small">until {new Date(o.expiresAt).toLocaleDateString()}</div>}
              </td>
              <td className="small">{fmtDate(o.createdAt)}</td>
              <td><div className="btn-row nowrap">{canResend(o) && <ResendButton o={o} />}{canExtend(o) && <ExtendButton o={o} />}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResendButton({ o }) {
  const db = useDB()
  const [busy, setBusy] = useState(false)
  const cost = resendCost(o, db)
  async function go() {
    setBusy(true)
    try {
      await resendCode(o.id)
      toast_(`New code requested for ${money(cost)} — waiting for SMS…`)
      if (!window.location.hash.startsWith('#/dashboard/active') && window.location.hash !== '#/dashboard') navigate('/dashboard/active')
    } catch (e) {
      toast_(e.message, 'error')
    }
    setBusy(false)
  }
  return (
    <button className="btn sm resend" onClick={go} disabled={busy} title="Get another code on this same number">
      {busy ? <span className="spinner light" /> : <span className="spin-icon">🔁</span>} Resend {money(cost)}
    </button>
  )
}

function ExtendButton({ o }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn ghost sm" onClick={() => setOpen(true)}>⏱️ Extend</button>
      {open && <ExtendModal o={o} onClose={() => setOpen(false)} />}
    </>
  )
}

function ExtendModal({ o, onClose }) {
  const db = useDB()
  const user = currentUser(db)
  const order = db.orders.find((x) => x.id === o.id) || o
  const plans = extendOptions(order, db)
  const [pick, setPick] = useState(plans[plans.length - 1]?.id)
  const plan = plans.find((p) => p.id === pick)
  const newEnd = plan && Math.max(order.expiresAt, Date.now()) + plan.minutes * 60000
  function confirm() {
    const r = attempt(() => extendOrder(order.id, pick))
    if (r) { toast_(`Extended by ${plan.label} — active until ${new Date(newEnd).toLocaleString()}`); onClose() }
  }
  return (
    <Modal title="Extend your number" onClose={onClose}>
      <div className="extend-head">
        <span className="service-icon">{order.icon}</span>
        <div><b className="mono">{order.number}</b><div className="muted small">{order.service} · <Flag id={order.countryId} /> {order.country}</div></div>
      </div>
      <p className="muted small">Keep this number and receive more SMS on it. Current end: <b>{fmtDate(Math.max(order.expiresAt, Date.now()))}</b></p>
      <div className="plans" role="radiogroup">
        {plans.map((p) => (
          <button key={p.id} role="radio" aria-checked={pick === p.id} className={'plan' + (pick === p.id ? ' on' : '') + (p.minutes >= 129600 ? ' best' : '')} onClick={() => setPick(p.id)}>
            {p.minutes >= 129600 && <span className="plan-tag">Best value</span>}
            <span className="plan-label">{p.label}</span>
            <span className="plan-price">{money(p.cost)}</span>
            {p.minutes >= 1440 && <span className="muted small">{money(p.cost / (p.minutes / 1440))}/day</span>}
          </button>
        ))}
      </div>
      {plan && (
        <ul className="info-list">
          <li><span>New end date</span><b>{fmtDate(newEnd)}</b></li>
          <li><span>Cost</span><b>{money(plan.cost)}</b></li>
          <li><span>Your balance</span><b>{money(user?.balance)}</b></li>
        </ul>
      )}
      {order.live && plan?.minutes >= 1440 && <p className="note small">This number comes from an API provider. Long rentals only work if your provider keeps the number for that long.</p>}
      {user && plan && user.balance < plan.cost
        ? <a className="btn full" href="#/dashboard/recharge" onClick={onClose}>Insufficient balance — Recharge</a>
        : <button className="btn full" onClick={confirm} disabled={!plan}>Extend for {plan ? money(plan.cost) : ''}</button>}
    </Modal>
  )
}

function Rentals({ db, orders }) {
  const active = orders.filter((o) => o.rented && ['waiting', 'received'].includes(o.status))
  const past = orders.filter((o) => o.rented && !['waiting', 'received'].includes(o.status))
  return (
    <>
      <div className="row-between"><h1>My rentals</h1><Link to="/rent" className="btn sm">📅 Rent a number</Link></div>
      {active.length ? <OrderCards orders={active} db={db} /> : <Empty icon="📅" text="You have no rented numbers. Rent one to keep the same number for days." />}
      {past.length > 0 && <><h2 className="h2">Ended rentals</h2><OrderTable orders={past} /></>}
    </>
  )
}

function Active({ db, orders }) {
  const active = orders.filter((o) => ['waiting', 'received'].includes(o.status))
  return (
    <>
      <div className="row-between"><h1>Active numbers</h1><Link to="/buy" className="btn sm">＋ New number</Link></div>
      {active.length ? <OrderCards orders={active} db={db} /> : <Empty icon="📲" text="No active numbers right now." />}
    </>
  )
}

function Orders({ orders }) {
  const [f, setF] = useState('all')
  const list = f === 'all' ? orders : orders.filter((o) => o.status === f)
  return (
    <>
      <h1>Order management</h1>
      <div className="chips">
        {['all', 'waiting', 'received', 'completed', 'cancelled', 'expired'].map((s) => (
          <button key={s} className={'chip' + (f === s ? ' on' : '')} onClick={() => setF(s)}>{s}</button>
        ))}
      </div>
      <OrderTable orders={list} />
    </>
  )
}

function Sms({ orders }) {
  const msgs = orders.flatMap((o) => o.sms.map((m) => ({ ...m, o }))).sort((a, b) => b.at - a.at)
  return (
    <>
      <h1>SMS history</h1>
      {!msgs.length ? <Empty icon="💬" text="No SMS received yet." /> : (
        <div className="list-card">
          {msgs.map((m, i) => (
            <div className="list-row" key={i}>
              <span className="service-icon">{m.o.icon}</span>
              <div className="grow"><b>{m.o.service}</b> <span className="muted small mono">{m.o.number}</span><div className="small">{m.text}</div></div>
              <button className="btn ghost sm mono" onClick={() => copy(m.code)}>{m.code} 📋</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Recharge({ db, user }) {
  const methods = db.settings.paymentMethods.filter((m) => m.enabled)
  const [f, setF] = useState({ amount: 5, method: methods[0]?.name || '', txid: '' })
  const method = methods.find((m) => m.name === f.method)
  const mine = db.recharges.filter((r) => r.userId === user.id)
  const [busy, setBusy] = useState(false)
  const auto = db.settings.autoVerify && !!method?.chain
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await requestRecharge(f)
      if (r.status === 'ok') toast_(`✅ Payment confirmed on the blockchain — ${money(Math.floor(r.amount * 100) / 100)} added to your balance!`)
      else if (r.status === 'pending') toast_('⏳ ' + (r.reason || 'Waiting for the blockchain.') + ' Your balance updates automatically.')
      else if (r.status === 'invalid') toast_('❌ ' + r.reason, 'error')
      else toast_('Recharge request sent. Balance is added after admin approval.')
      if (r.status !== 'invalid') setF({ ...f, txid: '' })
    } catch (err) {
      toast_(err.message, 'error')
    }
    setBusy(false)
  }
  return (
    <>
      <h1>Recharge wallet</h1>
      <div className="grid-2">
        <form className="card form" onSubmit={submit}>
          <label>Amount (USD)
            <input className="input" type="number" min={db.settings.minRecharge} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </label>
          <div className="chips">{[1, 5, 10, 25, 50].map((a) => <button type="button" key={a} className="chip" onClick={() => setF({ ...f, amount: a })}>${a}</button>)}</div>
          <label>Payment method
            <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {methods.map((m) => <option key={m.id}>{m.name}</option>)}
            </select>
          </label>
          {method && (
            <div className="pay-box">
              <div className="row-between">
                <b>Send {money(f.amount)} {/usdt|binance/i.test(method.name) ? 'USDT' : ''}</b>
                {method.network && <span className="badge info">{method.network}</span>}
              </div>
              {method.qr && method.details && (
                <img className="pay-qr" width="168" height="168" alt={'QR code for ' + method.details}
                  src={'https://api.qrserver.com/v1/create-qr-code/?size=336x336&margin=8&data=' + encodeURIComponent(method.details)} />
              )}
              <div className="copy-field">
                <code className="addr">{method.details}</code>
                <button type="button" className="btn" onClick={() => copy(method.details)}>Copy</button>
              </div>
              {/bep20/i.test(method.network + method.name) && (
                <p className="pay-warn">⚠️ Send only <b>USDT</b> on <b>BNB Smart Chain (BEP20)</b>. Other coins or networks will be lost.</p>
              )}
              {/trc20/i.test(method.network + method.name) && (
                <p className="pay-warn">⚠️ Send only <b>USDT</b> on the <b>Tron (TRC20)</b> network. Other coins or networks will be lost.</p>
              )}
              {/binance pay/i.test(method.name) && (
                <ol className="pay-steps">
                  <li>Open the Binance app → <b>Pay</b> → <b>Send</b></li>
                  <li>Choose <b>Pay ID</b> and enter <b className="mono">{method.details}</b></li>
                  <li>Send <b>{money(f.amount)}</b> in USDT, then paste the <b>Order ID</b> below</li>
                </ol>
              )}
            </div>
          )}
          {!methods.length && <div className="alert warn">No payment method is available right now. Please contact support.</div>}
          <label>{method && /binance pay/i.test(method.name) ? 'Binance Pay Order ID' : 'Transaction ID (TxID / hash)'}
            <input className="input mono" placeholder={method?.chain === 'bep20' ? '0x… (66 characters) or BscScan link' : method?.chain === 'trc20' ? '64-character TxID or Tronscan link' : 'Paste the transaction / reference ID'} value={f.txid} onChange={(e) => setF({ ...f, txid: e.target.value })} />
          </label>
          <button className="btn full" disabled={busy}>
            {busy ? <><span className="spinner light" /> Checking the blockchain…</> : auto ? '⚡ Verify & add balance' : 'Submit recharge'}
          </button>
          {auto && <p className="auto-note">⚡ <b>Instant:</b> after you paste the TxID we check the blockchain and add your balance automatically, usually within a minute.</p>}
          <p className="muted small">Minimum {money(db.settings.minRecharge)}. Requests are reviewed and approved by an admin.</p>
        </form>
        <div>
          <h3>Your recharge requests</h3>
          {!mine.length ? <Empty icon="💳" text="No recharge requests yet." /> : (
            <div className="list-card">
              {mine.map((r) => (
                <div className="list-row" key={r.id}>
                  <div className="grow">
                    <b>{money(r.amount)}</b> · {r.method} {r.auto && <span className="badge info">⚡ auto</span>}
                    <div className="muted small">{fmtDate(r.at)} · TX {explorerTx(r.chain, r.txid) ? <a className="link mono" href={explorerTx(r.chain, r.txid)} target="_blank" rel="noreferrer">{r.txid.slice(0, 10)}…{r.txid.slice(-6)}</a> : <span className="mono">{r.txid}</span>}</div>
                    {r.status === 'pending' && r.auto && <div className="small pending-note"><span className="spinner" /> {r.note || 'Checking the blockchain…'}</div>}
                    {r.status === 'rejected' && r.note && <div className="small neg">{r.note}</div>}
                    {r.requested && r.requested !== r.amount && <div className="small muted">You entered {money(r.requested)}, received {money(r.amount)}</div>}
                  </div>
                  <Badge s={r.status}>{r.status === 'approved' && r.approvedBy === 'Auto-confirmed' ? 'confirmed' : r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Transactions({ db, user }) {
  const list = db.transactions.filter((t) => t.userId === user.id)
  return (
    <>
      <h1>Transactions</h1>
      {!list.length ? <Empty text="No transactions yet." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td><Badge s={t.type} /></td><td>{t.note}</td>
                  <td className={t.type === 'debit' ? 'neg' : 'pos'}>{t.type === 'debit' ? '−' : '+'}{money(t.amount)}</td>
                  <td className="small">{fmtDate(t.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Transfer({ user }) {
  const [f, setF] = useState({ email: '', amount: '' })
  function submit(e) {
    e.preventDefault()
    if (attempt(() => transferBalance(f.email, f.amount), 'Transfer complete')) setF({ email: '', amount: '' })
  }
  return (
    <>
      <h1>Transfer balance</h1>
      <form className="card form narrow" onSubmit={submit}>
        <p className="muted">Send balance instantly to another {''}user by their email. Available: <b>{money(user.balance)}</b></p>
        <label>Recipient email<input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Amount (USD)<input className="input" type="number" step="0.01" min="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <button className="btn full">Send</button>
      </form>
    </>
  )
}

function Referrals({ db, user }) {
  const link = window.location.href.split('#')[0] + '#/register?ref=' + user.refCode
  const refs = db.users.filter((u) => u.referredBy === user.id)
  return (
    <>
      <h1>Referrals</h1>
      <div className="stats">
        <Stat icon="🤝" label="Friends referred" value={refs.length} />
        <Stat icon="💵" label="Earned" value={money(user.refEarnings)} tone="primary" />
        <Stat icon="📈" label="Commission" value={db.settings.referralPercent + '%'} />
      </div>
      <div className="card form">
        <p>Share your link. You earn <b>{db.settings.referralPercent}%</b> of every approved recharge your friends make.</p>
        <div className="copy-field"><input className="input mono" readOnly value={link} /><button className="btn" onClick={() => copy(link)}>Copy</button></div>
        <p className="muted small">Your code: <b className="mono">{user.refCode}</b></p>
      </div>
      {refs.length > 0 && (
        <div className="list-card">{refs.map((r) => <div className="list-row" key={r.id}><div className="grow"><b>{r.name}</b><div className="muted small">Joined {fmtDate(r.createdAt)}</div></div></div>)}</div>
      )}
    </>
  )
}

function Api({ user }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <h1>API access</h1>
      <div className="card form">
        <p>Use this key to access the {''}REST API. Keep it secret.</p>
        <div className="copy-field">
          <input className="input mono" readOnly value={show ? user.apiKey : '•'.repeat(32)} />
          <button className="btn ghost" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          <button className="btn" onClick={() => copy(user.apiKey)}>Copy</button>
        </div>
        <div className="btn-row">
          <button className="btn danger sm" onClick={() => attempt(regenerateApiKey, 'New API key generated')}>Regenerate key</button>
          <Link to="/api" className="btn ghost sm">Read API docs →</Link>
        </div>
      </div>
    </>
  )
}

function Support({ db, user }) {
  const [f, setF] = useState({ subject: '', message: '' })
  const [open, setOpen] = useState(null)
  const [reply, setReply] = useState('')
  const mine = db.tickets.filter((t) => t.userId === user.id)
  const ticket = mine.find((t) => t.id === open)
  function submit(e) {
    e.preventDefault()
    if (attempt(() => createTicket(f.subject, f.message), 'Ticket created. We will reply soon.')) setF({ subject: '', message: '' })
  }
  return (
    <>
      <h1>Support tickets</h1>
      <div className="grid-2">
        <form className="card form" onSubmit={submit}>
          <h3>New ticket</h3>
          <label>Subject<input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
          <label>Message<textarea className="input" rows="5" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
          <button className="btn full">Send ticket</button>
        </form>
        <div>
          <h3>Your tickets</h3>
          {!mine.length ? <Empty icon="🎧" text="No tickets yet." /> : (
            <div className="list-card">
              {mine.map((t) => (
                <button className="list-row clickable" key={t.id} onClick={() => setOpen(t.id)}>
                  <div className="grow"><b>{t.subject}</b><div className="muted small">{fmtDate(t.at)} · {t.messages.length} messages</div></div>
                  <Badge s={t.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {ticket && (
        <Modal title={ticket.subject} onClose={() => setOpen(null)} wide>
          <Thread ticket={ticket} />
          {ticket.status !== 'closed' && (
            <form className="reply" onSubmit={(e) => { e.preventDefault(); if (attempt(() => replyTicket(ticket.id, reply, 'user'))) setReply('') }}>
              <input className="input" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn">Send</button>
              <button type="button" className="btn ghost" onClick={() => closeTicket(ticket.id)}>Close</button>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}

export function Thread({ ticket }) {
  return (
    <div className="thread">
      {ticket.messages.map((m, i) => (
        <div key={i} className={'msg ' + m.from}>
          <small>{m.from === 'admin' ? 'Support' : 'User'} · {fmtDate(m.at)}</small>
          <div>{m.text}</div>
        </div>
      ))}
    </div>
  )
}

function Profile({ user }) {
  const [f, setF] = useState({ name: user.name, password: '' })
  function submit(e) {
    e.preventDefault()
    if (f.password && f.password.length < 6) return attempt(() => { throw new Error('Password must be at least 6 characters') })
    if (attempt(() => updateProfile(f), 'Profile updated')) setF({ ...f, password: '' })
  }
  return (
    <>
      <h1>Profile</h1>
      <form className="card form narrow" onSubmit={submit}>
        <label>Name<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Email<input className="input" value={user.email} disabled /></label>
        <label>New password<input className="input" type="password" placeholder="Leave blank to keep current" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <button className="btn full">Save changes</button>
        <p className="muted small">Member since {fmtDate(user.createdAt)}</p>
      </form>
    </>
  )
}
