import { Link } from '../router.jsx'
import { useDB, money, priceFor } from '../store.js'
import { CountUp, Rotator } from '../motion.jsx'
import { Flag } from '../ui.jsx'

export default function Home() {
  const db = useDB()
  const minPrice = Math.min(...db.services.filter((s) => s.enabled).flatMap((s) => db.countries.filter((c) => c.enabled).map((c) => priceFor(s, c))))
  const popular = db.services.filter((s) => s.enabled).slice(0, 12)

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow rise" style={{ '--d': 0 }}>⚡ Instant virtual numbers</span>
            <h1 className="rise" style={{ '--d': 1 }}>Receive SMS verification codes for <Rotator words={['WhatsApp', 'Telegram', 'Google', 'TikTok', 'Facebook', 'Instagram']} /> <span className="grad">in seconds</span></h1>
            <p className="lead rise" style={{ '--d': 2 }}>
              Get a temporary phone number for {db.services.length}+ services across {db.countries.length} countries.
              Numbers start from just <b>{money(isFinite(minPrice) ? minPrice : 0)}</b>. No subscription — pay only for what you use,
              and get an automatic refund if no SMS arrives.
            </p>
            <div className="hero-cta rise" style={{ '--d': 3 }}>
              <Link to="/buy" className="btn lg shine magnetic">Get a number <span className="arrow">→</span></Link>
              <Link to="/pricing" className="btn ghost lg magnetic">View pricing</Link>
            </div>
            <div className="hero-stats rise" style={{ '--d': 4 }}>
              <div><b><CountUp value={99} suffix="%" /></b><span>Delivery rate</span></div>
              <div><b>&lt;<CountUp value={3} suffix="s" /></b><span>Avg. SMS speed</span></div>
              <div><b><CountUp value={24} />/7</b><span>Support</span></div>
            </div>
          </div>
          <div className="phone-wrap rise" style={{ '--d': 2 }} aria-hidden="true">
          <div className="orb orb-a" /><div className="orb orb-b" />
          <div className="phone-card float">
            <div className="phone-top"><span>🇺🇸 +1 415 555 0182</span><span className="badge ok live-dot">Active</span></div>
            <div className="typing"><span /><span /><span /></div>
            <div className="sms-bubble arrive a1"><small>WhatsApp · just now</small>Your WhatsApp code is <b>482-913</b>. Don't share this code.</div>
            <div className="sms-bubble arrive a2"><small>Telegram · 2m ago</small>Telegram code: <b>70415</b></div>
            <div className="phone-code arrive a3">{'482913'.split('').map((d, i) => <i key={i} style={{ '--k': i }}>{d}</i>)} <span>📋</span></div>
          </div>
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...db.services, ...db.services].map((s, i) => (
            <span className="marquee-item" key={i}>{s.icon} {s.name}</span>
          ))}
        </div>
      </div>

      <section className="container section">
        <h2 className="section-title reveal">How it works</h2>
        <div className="grid-3">
          {[
            ['💳', '1. Top up your wallet', 'Recharge with USDT, Binance Pay, bKash or Nagad. Your balance never expires.'],
            ['📲', '2. Pick a service & country', 'Choose WhatsApp, Telegram, Google and more. Get your number instantly.'],
            ['✅', '3. Receive the code', 'The SMS appears in your dashboard within seconds. No SMS? Full refund.'],
          ].map(([i, t, d], idx) => (
            <div className="card feature reveal tilt" style={{ '--i': idx }} key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="row-between">
          <h2 className="section-title reveal">Popular services</h2>
          <Link to="/buy" className="link">See all →</Link>
        </div>
        <div className="service-grid">
          {popular.map((s, idx) => (
            <Link to="/buy" key={s.id} className="service-tile reveal tilt" style={{ '--i': idx % 6 }}>
              <span className="service-icon">{s.icon}</span>
              <span className="service-name">{s.name}</span>
              <span className="muted small">from {money(Math.min(...db.countries.map((c) => priceFor(s, c))))}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title reveal">Why choose {db.settings.siteName}</h2>
        <div className="grid-3">
          {[
            ['🌍', 'Many countries', <span className="flag-row">{db.countries.map((c) => <Flag key={c.id} country={c} />)}</span>],
            ['♻️', 'Auto refunds', 'Waiting numbers that never get an SMS are refunded to your wallet automatically.'],
            ['⏱️', 'Extend sessions', 'Need more time? Extend any active number for 50% of its price.'],
            ['🤝', 'Referral rewards', `Earn ${db.settings.referralPercent}% of every recharge your friends make.`],
            ['🔌', 'Developer API', 'Automate number purchases and SMS checks with a simple REST API.'],
            ['🔒', 'Private & secure', 'Your numbers and messages are only visible in your own dashboard.'],
          ].map(([i, t, d], idx) => (
            <div className="card feature reveal tilt" style={{ '--i': idx }} key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band reveal">
          <div>
            <h2>Ready to get your first number?</h2>
            <p>Create a free account in 30 seconds.</p>
          </div>
          <Link to="/register" className="btn lg light magnetic">Create account</Link>
        </div>
      </section>
    </>
  )
}
