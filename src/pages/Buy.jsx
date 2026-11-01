import { useState } from 'react'
import { navigate } from '../router.jsx'
import { useDB, currentUser, priceFor, money, purchase, quote, periodOptions, areaCodesOf, supportsAreaCode, resendCost } from '../store.js'
import { Modal, Empty, toast, Flag } from '../ui.jsx'

export default function Buy() {
  const db = useDB()
  const user = currentUser(db)
  const countries = db.countries.filter((c) => c.enabled)
  const [country, setCountry] = useState(countries[0]?.id)
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const live = db.settings.numberSource === 'api'
  const c = countries.find((x) => x.id === country) || countries[0]
  const services = db.services.filter((s) => s.enabled && s.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="container section">
      <h1>Buy a number</h1>
      <p className="muted">Choose a country, then pick the service you want to verify.</p>

      <div className="chips" role="tablist">
        {countries.map((x) => (
          <button key={x.id} className={'chip' + (x.id === c?.id ? ' on' : '')} onClick={() => setCountry(x.id)}>
            <Flag country={x} /> {x.name}
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
                <div className="muted small"><Flag country={c} /> {c.name} · {live ? 'Instant delivery' : s.stock > 0 ? `${s.stock} available` : 'Out of stock'}</div>
              </div>
              <b className="price">{money(priceFor(s, c))}</b>
              <button className="btn sm" disabled={!live && s.stock <= 0} onClick={() => (user ? setPick(s) : navigate('/login'))}>Buy</button>
            </div>
          ))}
        </div>
      )}

      {pick && <BuyModal service={pick} country={c} onClose={() => setPick(null)} />}
    </div>
  )
}

function BuyModal({ service, country: c, onClose }) {
  const db = useDB()
  const user = currentUser(db)
  const live = db.settings.numberSource === 'api'
  const maxQty = Math.min(db.settings.maxQty || 10, live ? 99 : Math.max(1, service.stock))
  const [area, setArea] = useState('') // '' = any
  const [customArea, setCustomArea] = useState('')
  const [periodId, setPeriodId] = useState('std')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const areaOK = supportsAreaCode(c, db)
  const codes = areaCodesOf(c)
  const areaCode = area === 'custom' ? customArea : area
  const areaValid = !areaCode || /^[2-9]\d{2}$/.test(areaCode)
  const q = quote(service.id, c.id, { areaCode: areaValid ? areaCode : '', periodId, qty }, db)
  const periods = periodOptions(db).map((p) => ({ ...p, cost: quote(service.id, c.id, { periodId: p.id }, db).periodCost }))
  const short = user && user.balance < q.total

  async function confirm() {
    if (!areaValid) return toast('Area code must be 3 digits, e.g. 212', 'error')
    setBusy(true)
    try {
      const r = await purchase(service.id, c.id, { areaCode, periodId, qty: q.qty })
      const n = r.orders.length
      toast(n > 1 ? `${n} numbers purchased! Waiting for SMS…` : 'Number purchased! Waiting for SMS…')
      if (r.failed) toast(`${r.failed} number(s) could not be bought: ${r.error || 'provider error'}. You were not charged for them.`, 'error')
      onClose()
      navigate('/dashboard/active')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Buy number" onClose={onClose} wide>
      <div className="buy-head">
        <div className="service-icon xl">{service.icon}</div>
        <div>
          <h3>{service.name}</h3>
          <p className="muted"><Flag country={c} /> {c.name} · {money(q.unit)} per number</p>
        </div>
      </div>

      {areaOK && (
        <section className="buy-section">
          <div className="buy-label"><b>📍 Area code</b><span className="muted small">Specific area code +{db.settings.areaCodeFeePct ?? 20}%</span></div>
          <div className="chips tight">
            <button type="button" className={'chip' + (area === '' ? ' on' : '')} onClick={() => setArea('')}>🎲 Any (random)</button>
            {codes.map((code) => (
              <button type="button" key={code} className={'chip mono' + (area === code ? ' on' : '')} onClick={() => setArea(code)}>{code}</button>
            ))}
            <button type="button" className={'chip' + (area === 'custom' ? ' on' : '')} onClick={() => setArea('custom')}>✏️ Custom</button>
          </div>
          {area === 'custom' && (
            <input className={'input mono area-input' + (customArea && !areaValid ? ' invalid' : '')} inputMode="numeric" maxLength={3} placeholder="e.g. 415" autoFocus
              value={customArea} onChange={(e) => setCustomArea(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          )}
          {areaCode && areaValid && <p className="muted small">Your number will look like <b className="mono">{c.code} ({areaCode}) •••-••••</b></p>}
        </section>
      )}

      <section className="buy-section">
        <div className="buy-label"><b>⏱️ Number period</b><span className="muted small">How long the number stays yours</span></div>
        <div className="plans">
          {periods.map((p) => (
            <button type="button" key={p.id} className={'plan' + (periodId === p.id ? ' on' : '')} onClick={() => setPeriodId(p.id)}>
              {p.standard && <span className="plan-tag">Standard</span>}
              <span className="plan-label">{p.label}</span>
              <span className="plan-price">{p.standard ? 'Included' : '+' + money(p.cost)}</span>
            </button>
          ))}
        </div>
        {live && periodId !== 'std' && <p className="note small">Long periods only work if your number provider keeps the number for that long.</p>}
      </section>

      <section className="buy-section">
        <div className="buy-label"><b>🔢 Quantity</b><span className="muted small">Up to {maxQty} at once</span></div>
        <div className="qty">
          <button type="button" className="icon-btn" aria-label="Less" disabled={q.qty <= 1} onClick={() => setQty(Math.max(1, q.qty - 1))}>−</button>
          <input className="input mono" type="number" min="1" max={maxQty} value={qty} onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))} aria-label="Quantity" />
          <button type="button" className="icon-btn" aria-label="More" disabled={q.qty >= maxQty} onClick={() => setQty(Math.min(maxQty, q.qty + 1))}>＋</button>
          <div className="chips tight">{[1, 3, 5, 10].filter((n) => n <= maxQty).map((n) => <button type="button" key={n} className={'chip' + (q.qty === n ? ' on' : '')} onClick={() => setQty(n)}>{n}</button>)}</div>
        </div>
      </section>

      <div className="buy-footer">
      <ul className="info-list">
        <li><span>Number price</span><b>{money(q.unit)}</b></li>
        {q.areaFee > 0 && <li><span>Area code {areaCode}</span><b>+{money(q.areaFee)}</b></li>}
        {q.periodCost > 0 && <li><span>Period: {q.period.label}</span><b>+{money(q.periodCost)}</b></li>}
        {q.qty > 1 && <li><span>× Quantity</span><b>{money(q.each)} × {q.qty}</b></li>}
        <li className="total"><span>Total</span><b key={q.total} className="bump">{money(q.total)}</b></li>
        <li><span>Your balance</span><b className={short ? 'neg' : ''}>{money(user?.balance)}</b></li>
      </ul>
      <p className="muted small">Resend code {money(resendCost({ price: q.unit, serviceId: service.id }, db))} · If no SMS arrives before a number expires, you get a full refund.</p>
      {short ? (
        <button className="btn full" onClick={() => { onClose(); navigate('/dashboard/recharge') }}>Insufficient balance — Recharge {money(q.total - user.balance)}</button>
      ) : (
        <button className="btn full lg-pad" onClick={confirm} disabled={busy || !areaValid}>
          {busy ? <><span className="spinner light" /> Getting your number{q.qty > 1 ? 's' : ''}…</> : <>Buy {q.qty > 1 ? q.qty + ' numbers' : 'number'} for {money(q.total)}</>}
        </button>
      )}
      </div>
    </Modal>
  )
}
