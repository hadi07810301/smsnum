import { useState } from 'react'
import { navigate } from '../router.jsx'
import { useDB, currentUser, priceFor, money, buyNumber } from '../store.js'
import { Modal, attempt, Empty } from '../ui.jsx'

export default function Buy() {
  const db = useDB()
  const user = currentUser(db)
  const countries = db.countries.filter((c) => c.enabled)
  const [country, setCountry] = useState(countries[0]?.id)
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const c = countries.find((x) => x.id === country) || countries[0]
  const services = db.services.filter((s) => s.enabled && s.name.toLowerCase().includes(q.toLowerCase()))

  function confirm() {
    const o = attempt(() => buyNumber(pick.id, c.id), 'Number purchased! Waiting for SMS…')
    if (o) { setPick(null); navigate('/dashboard/active') }
  }

  return (
    <div className="container section">
      <h1>Buy a number</h1>
      <p className="muted">Choose a country, then pick the service you want to verify.</p>

      <div className="chips" role="tablist">
        {countries.map((x) => (
          <button key={x.id} className={'chip' + (x.id === c?.id ? ' on' : '')} onClick={() => setCountry(x.id)}>
            {x.flag} {x.name}
          </button>
        ))}
      </div>

      <input className="input search" placeholder="🔍 Search services (e.g. WhatsApp)" value={q} onChange={(e) => setQ(e.target.value)} />

      {!c ? <Empty text="No countries available right now." /> : services.length === 0 ? <Empty icon="🔍" text="No service matches your search." /> : (
        <div className="list-card stagger" key={c?.id + q}>
          {services.map((s) => (
            <div className="list-row" key={s.id}>
              <span className="service-icon">{s.icon}</span>
              <div className="grow">
                <b>{s.name}</b>
                <div className="muted small">{c.flag} {c.name} · {s.stock > 0 ? `${s.stock} available` : 'Out of stock'}</div>
              </div>
              <b className="price">{money(priceFor(s, c))}</b>
              <button className="btn sm" disabled={s.stock <= 0} onClick={() => (user ? setPick(s) : navigate('/login'))}>Buy</button>
            </div>
          ))}
        </div>
      )}

      {pick && (
        <Modal title="Confirm purchase" onClose={() => setPick(null)}>
          <div className="confirm-box">
            <div className="service-icon xl">{pick.icon}</div>
            <h3>{pick.name}</h3>
            <p className="muted">{c.flag} {c.name}</p>
          </div>
          <ul className="info-list">
            <li><span>Price</span><b>{money(priceFor(pick, c))}</b></li>
            <li><span>Your balance</span><b>{money(user.balance)}</b></li>
            <li><span>Active for</span><b>{db.settings.orderMinutes} minutes</b></li>
            <li><span>Extend</span><b>+{db.settings.extendMinutes} min for {money(priceFor(pick, c) / 2)}</b></li>
          </ul>
          <p className="muted small">If no SMS arrives before the number expires, the full price is refunded automatically.</p>
          {user.balance < priceFor(pick, c) ? (
            <button className="btn full" onClick={() => navigate('/dashboard/recharge')}>Insufficient balance — Recharge</button>
          ) : (
            <button className="btn full" onClick={confirm}>Buy for {money(priceFor(pick, c))}</button>
          )}
        </Modal>
      )}
    </div>
  )
}
