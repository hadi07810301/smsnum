import { useState } from 'react'
import { Link } from '../router.jsx'
import { useDB, priceFor, money } from '../store.js'

export default function Pricing() {
  const db = useDB()
  const countries = db.countries.filter((c) => c.enabled)
  const [q, setQ] = useState('')
  const services = db.services.filter((s) => s.enabled && s.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="container section">
      <h1>Pricing</h1>
      <p className="muted">Pay per number. No subscriptions, no hidden fees. Extending a number costs 50% of its price.</p>
      <input className="input search" placeholder="🔍 Search services" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Service</th>{countries.map((c) => <th key={c.id}>{c.flag} {c.name}</th>)}</tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td><b>{s.icon} {s.name}</b></td>
                {countries.map((c) => <td key={c.id}>{money(priceFor(s, c))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="center" style={{ marginTop: 24 }}><Link to="/buy" className="btn lg">Buy a number</Link></div>
    </div>
  )
}
