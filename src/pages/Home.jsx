import { Link } from '../router.jsx'
import { useDB, money, priceFor } from '../store.js'

export default function Home() {
  const db = useDB()
  const minPrice = Math.min(...db.services.filter((s) => s.enabled).flatMap((s) => db.countries.filter((c) => c.enabled).map((c) => priceFor(s, c))))
  const popular = db.services.filter((s) => s.enabled).slice(0, 12)

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">⚡ Instant virtual numbers</span>
            <h1>Receive SMS verification codes <span className="grad">online, in seconds</span></h1>
            <p className="lead">
              Get a temporary phone number for {db.services.length}+ services across {db.countries.length} countries.
              Numbers start from just <b>{money(isFinite(minPrice) ? minPrice : 0)}</b>. No subscription — pay only for what you use,
              and get an automatic refund if no SMS arrives.
            </p>
            <div className="hero-cta">
              <Link to="/buy" className="btn lg">Get a number →</Link>
              <Link to="/pricing" className="btn ghost lg">View pricing</Link>
            </div>
            <div className="hero-stats">
              <div><b>99%</b><span>Delivery rate</span></div>
              <div><b>&lt;3s</b><span>Avg. SMS speed</span></div>
              <div><b>24/7</b><span>Support</span></div>
            </div>
          </div>
          <div className="phone-card" aria-hidden="true">
            <div className="phone-top"><span>🇺🇸 +1 415 555 0182</span><span className="badge ok">Active</span></div>
            <div className="sms-bubble"><small>WhatsApp · just now</small>Your WhatsApp code is <b>482-913</b>. Don't share this code.</div>
            <div className="sms-bubble"><small>Telegram · 2m ago</small>Telegram code: <b>70415</b></div>
            <div className="phone-code">482913 <span>📋</span></div>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">How it works</h2>
        <div className="grid-3">
          {[
            ['💳', '1. Top up your wallet', 'Recharge with USDT, Binance Pay, bKash or Nagad. Your balance never expires.'],
            ['📲', '2. Pick a service & country', 'Choose WhatsApp, Telegram, Google and more. Get your number instantly.'],
            ['✅', '3. Receive the code', 'The SMS appears in your dashboard within seconds. No SMS? Full refund.'],
          ].map(([i, t, d]) => (
            <div className="card feature" key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="row-between">
          <h2 className="section-title">Popular services</h2>
          <Link to="/buy" className="link">See all →</Link>
        </div>
        <div className="service-grid">
          {popular.map((s) => (
            <Link to="/buy" key={s.id} className="service-tile">
              <span className="service-icon">{s.icon}</span>
              <span className="service-name">{s.name}</span>
              <span className="muted small">from {money(Math.min(...db.countries.map((c) => priceFor(s, c))))}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Why choose {db.settings.siteName}</h2>
        <div className="grid-3">
          {[
            ['🌍', 'Many countries', db.countries.map((c) => c.flag).join(' ')],
            ['♻️', 'Auto refunds', 'Waiting numbers that never get an SMS are refunded to your wallet automatically.'],
            ['⏱️', 'Extend sessions', 'Need more time? Extend any active number for 50% of its price.'],
            ['🤝', 'Referral rewards', `Earn ${db.settings.referralPercent}% of every recharge your friends make.`],
            ['🔌', 'Developer API', 'Automate number purchases and SMS checks with a simple REST API.'],
            ['🔒', 'Private & secure', 'Your numbers and messages are only visible in your own dashboard.'],
          ].map(([i, t, d]) => (
            <div className="card feature" key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <div>
            <h2>Ready to get your first number?</h2>
            <p>Create a free account in 30 seconds.</p>
          </div>
          <Link to="/register" className="btn lg light">Create account</Link>
        </div>
      </section>
    </>
  )
}
