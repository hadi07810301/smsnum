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
            <span className="eyebrow rise" style={{ '--d': 0 }}>Trusted virtual numbers for verification</span>
            <h1 className="rise" style={{ '--d': 1 }}>Verify your accounts on <Rotator words={['WhatsApp', 'Telegram', 'Google', 'TikTok', 'Facebook', 'Instagram']} /> <span className="grad">without your personal number</span></h1>
            <p className="lead rise" style={{ '--d': 2 }}>
              Receive one-time verification codes or rent a dedicated number for {db.services.length}+ apps in {db.countries.length} countries.
              Prices from <b>{money(isFinite(minPrice) ? minPrice : 0)}</b>, no subscription, and a full refund if a code doesn't arrive.
            </p>
            <div className="hero-cta rise" style={{ '--d': 3 }}>
              <Link to="/buy" className="btn lg shine">Get a number <span className="arrow">→</span></Link>
              <Link to="/rent" className="btn ghost lg">📅 Rent a number</Link>
            </div>
            <div className="hero-stats rise" style={{ '--d': 4 }}>
              <div><b><CountUp value={99} suffix="%" /></b><span>Successful delivery</span></div>
              <div><b>&lt;<CountUp value={3} suffix="s" /></b><span>Average code delivery</span></div>
              <div><b><CountUp value={24} />/7</b><span>Customer support</span></div>
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

      <div className="container marquee-wrap"><div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {/* 4 copies so the strip is always wider than the screen (even 4K); it scrolls by half */}
          {[...db.services, ...db.services, ...db.services, ...db.services].map((s, i) => (
            <span className="marquee-item" key={i}>{s.icon} {s.name}</span>
          ))}
        </div>
      </div></div>

      <section className="container section">
        <h2 className="section-title reveal">How it works</h2>
        <div className="grid-3">
          {[
            ['💳', '1. Add funds', 'Top up with USDT (BEP20 or TRC20) or Binance Pay. Crypto deposits are confirmed on the blockchain and credited automatically.'],
            ['📲', '2. Choose a number', 'Select the app and country you need. Your number is issued instantly, with an optional area code.'],
            ['✅', '3. Receive your code', 'The verification code appears in your dashboard in real time. If no code arrives, you are refunded in full.'],
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
            ['🌍', 'Global coverage', <span className="flag-row">{db.countries.map((c) => <Flag key={c.id} country={c} />)}</span>],
            ['♻️', 'Guaranteed refunds', 'You only pay for codes you receive. Numbers that get no SMS are refunded to your balance automatically.'],
            ['📅', 'Long-term rentals', 'Keep the same number for up to 90 days for accounts you log in to regularly.'],
            ['🤝', 'Referral programme', `Earn ${db.settings.referralPercent}% commission on every deposit made by people you invite.`],
            ['⚡', 'Instant & automated', 'Numbers are issued in seconds, codes arrive live, and crypto top-ups are credited without waiting for approval.'],
            ['🔒', 'Privacy first', 'Keep your personal phone number private. Your numbers and messages are visible only in your account.'],
          ].map(([i, t, d], idx) => (
            <div className="card feature reveal tilt" style={{ '--i': idx }} key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band reveal">
          <div>
            <h2>Start verifying in under a minute</h2>
            <p>Create a free account, add funds and get your first number instantly.</p>
          </div>
          <Link to="/register" className="btn lg light">Create account</Link>
        </div>
      </section>
    </>
  )
}
