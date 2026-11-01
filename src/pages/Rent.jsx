import { useState } from 'react'
import { Link, navigate } from '../router.jsx'
import { useDB, currentUser, money, purchase, quote, periodOptions, supportsAreaCode } from '../store.js'
import { toast, Flag, Empty } from '../ui.jsx'

// Long-term number rental: keep a number for days and receive SMS on it the whole time
export default function Rent() {
  const db = useDB()
  const user = currentUser(db)
  const countries = db.countries.filter((c) => c.enabled)
  const services = db.services.filter((s) => s.enabled)
  const plans = periodOptions(db).filter((p) => !p.standard)
  const anyService = services.find((s) => /any service/i.test(s.name)) || services[0]
  const [countryId, setCountryId] = useState(countries[0]?.id)
  const [serviceId, setServiceId] = useState(anyService?.id)
  const [planId, setPlanId] = useState(plans[plans.length - 1]?.id)
  const [area, setArea] = useState('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const c = countries.find((x) => x.id === countryId) || countries[0]
  const s = services.find((x) => x.id === serviceId) || anyService
  const live = db.settings.numberSource === 'api'
  const maxQty = Math.min(db.settings.maxQty || 10, live ? 99 : Math.max(1, s?.stock || 1))

  if (!c || !s || !plans.length) {
    return <div className="container section"><h1>Rent a number</h1><Empty icon="📅" text="Number rental is not available right now." /></div>
  }

  const areaOK = supportsAreaCode(c, db)
  const areaValid = !area || /^[2-9]\d{2}$/.test(area)
  const plan = plans.find((p) => p.id === planId) || plans[0]
  const q = quote(s.id, c.id, { areaCode: areaOK && areaValid ? area : '', periodId: plan.id, qty }, db)
  const priceOf = (p) => quote(s.id, c.id, { periodId: p.id }, db).each
  const days = (p) => Math.max(1, Math.round(p.minutes / 1440))

  async function rent() {
    if (!user) return navigate('/login')
    if (!areaValid) return toast('Area code must be 3 digits, e.g. 415', 'error')
    setBusy(true)
    try {
      const r = await purchase(s.id, c.id, { areaCode: areaOK ? area : '', periodId: plan.id, qty: q.qty })
      toast(r.orders.length > 1 ? `${r.orders.length} numbers rented for ${plan.label}!` : `Number rented for ${plan.label}!`)
      if (r.failed) toast(`${r.failed} number(s) could not be rented: ${r.error || 'provider error'}. You were not charged for them.`, 'error')
      navigate('/dashboard/rentals')
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy(false)
  }

  return (
    <>
      <section className="rent-hero">
        <div className="container">
          <span className="eyebrow rise" style={{ '--d': 0 }}>📅 Number rental</span>
          <h1 className="rise" style={{ '--d': 1 }}>Rent a number for <span className="grad">days, not minutes</span></h1>
          <p className="lead rise" style={{ '--d': 2 }}>Keep the same phone number for up to {plans[plans.length - 1].label} and receive unlimited SMS on it. Perfect for accounts you log in to again and again.</p>
          <div className="rent-perks rise" style={{ '--d': 3 }}>
            <span>♾️ Unlimited SMS</span><span>🔁 Same number every time</span><span>⏱️ Extend anytime</span><span>♻️ Refund if no SMS arrives</span>
          </div>
        </div>
      </section>

      <div className="container rent-layout">
        <div className="rent-config">
          <section className="card rent-step reveal">
            <h3><span className="step-no">1</span> Choose a rental period</h3>
            <div className="rent-plans">
              {plans.map((p) => {
                const each = priceOf(p)
                return (
                  <button type="button" key={p.id} className={'rent-plan tilt' + (plan.id === p.id ? ' on' : '')} onClick={() => setPlanId(p.id)}>
                    {p.id === plans[plans.length - 1].id && <span className="plan-tag">Best value</span>}
                    <span className="rent-days">{days(p)}</span>
                    <span className="muted small">{days(p) === 1 ? 'day' : 'days'}</span>
                    <span className="rent-price">{money(each)}</span>
                    <span className="muted small">{money(each / days(p))} / day</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="card rent-step reveal">
            <h3><span className="step-no">2</span> Country</h3>
            <div className="chips tight">
              {countries.map((x) => (
                <button type="button" key={x.id} className={'chip' + (x.id === c.id ? ' on' : '')} onClick={() => { setCountryId(x.id); setArea('') }}>
                  <Flag country={x} /> {x.name}
                </button>
              ))}
            </div>
            {areaOK && (
              <div className="area-search" style={{ marginTop: 12 }}>
                <span className="area-search-icon">🔍</span>
                <input className={'input mono' + (area && !areaValid ? ' invalid' : '')} inputMode="numeric" maxLength={3} aria-label="Area code"
                  placeholder={`Random number — or type an area code (+${db.settings.areaCodeFeePct ?? 20}%)`} value={area}
                  onChange={(e) => setArea(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                {area && <button type="button" className="area-clear" aria-label="Clear area code" onClick={() => setArea('')}>✕</button>}
              </div>
            )}
          </section>

          <section className="card rent-step reveal">
            <h3><span className="step-no">3</span> Service</h3>
            <p className="muted small">Choose “{anyService.name}” to receive SMS from every app, or pick one service.</p>
            <select className="input" value={s.id} onChange={(e) => setServiceId(e.target.value)} aria-label="Service">
              {services.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}
            </select>
          </section>
        </div>

        <aside className="card rent-summary">
          <h3>Your rental</h3>
          <div className="rent-sum-head">
            <span className="service-icon">{s.icon}</span>
            <div><b>{s.name}</b><div className="muted small"><Flag country={c} /> {c.name}{area && areaValid ? ` · area ${area}` : ''}</div></div>
          </div>
          <div className="qty">
            <span className="muted small grow">Quantity</span>
            <button type="button" className="icon-btn" aria-label="Less" disabled={q.qty <= 1} onClick={() => setQty(Math.max(1, q.qty - 1))}>−</button>
            <input className="input mono" type="number" min="1" max={maxQty} value={qty} aria-label="Quantity" onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))} />
            <button type="button" className="icon-btn" aria-label="More" disabled={q.qty >= maxQty} onClick={() => setQty(Math.min(maxQty, q.qty + 1))}>＋</button>
          </div>
          <ul className="info-list">
            <li><span>Rental ({plan.label})</span><b>{money(q.unit + q.periodCost)}</b></li>
            {q.areaFee > 0 && <li><span>Area code {area}</span><b>+{money(q.areaFee)}</b></li>}
            {q.qty > 1 && <li><span>× Quantity</span><b>{money(q.each)} × {q.qty}</b></li>}
            <li className="total"><span>Total</span><b key={q.total} className="bump">{money(q.total)}</b></li>
            {user && <li><span>Your balance</span><b className={user.balance < q.total ? 'neg' : ''}>{money(user.balance)}</b></li>}
          </ul>
          <p className="muted small">Active until <b>{new Date(Date.now() + plan.minutes * 60000).toLocaleDateString()}</b></p>
          {!user ? (
            <Link to="/login" className="btn full">Log in to rent</Link>
          ) : user.balance < q.total ? (
            <a className="btn full" href="#/dashboard/recharge">Recharge {money(q.total - user.balance)} to rent</a>
          ) : (
            <button className="btn full shine" onClick={rent} disabled={busy || !areaValid}>
              {busy ? <><span className="spinner light" /> Renting…</> : <>📅 Rent {q.qty > 1 ? q.qty + ' numbers' : 'number'} for {money(q.total)}</>}
            </button>
          )}
          {live && <p className="note small">Long rentals only work if your number provider keeps numbers that long.</p>}
        </aside>
      </div>

      <section className="container section">
        <h2 className="section-title reveal">How rental works</h2>
        <div className="grid-3">
          {[
            ['📅', 'Pick a period', 'Rent for 1 day up to 90 days. Longer rentals cost less per day.'],
            ['📲', 'Use it anywhere', 'Sign up and log in with the same number as often as you need. Every SMS appears in your dashboard.'],
            ['⏱️', 'Extend before it ends', 'Add more days anytime from My Rentals so you never lose the number.'],
          ].map(([i, t, d], idx) => (
            <div className="card feature reveal tilt" style={{ '--i': idx }} key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>
    </>
  )
}
