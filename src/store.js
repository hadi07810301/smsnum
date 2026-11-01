// Simple localStorage "database" so the whole site works without a backend.
// Replace these functions with real API calls when you connect a server.
import { useSyncExternalStore } from 'react'
import * as P from './providers.js'

const KEY = 'smsnum_db_v1'

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
const now = () => Date.now()
const MIN = 60 * 1000

// Default provider codes (SMS-Activate style). Edit them in Admin → Services / Countries
// to match your provider's own code list.
const SVC_CODES = { WhatsApp: 'wa', Telegram: 'tg', 'Google / Gmail': 'go', Facebook: 'fb', Instagram: 'ig', TikTok: 'lf', 'X (Twitter)': 'tw', Discord: 'ds', Microsoft: 'mm', Amazon: 'am', Uber: 'ub', Snapchat: 'fu', LinkedIn: 'tn', Viber: 'vi', WeChat: 'wb', Signal: 'bw', Netflix: 'nf', Shopee: 'ka', Line: 'me', Yahoo: 'mb', 'Other / Any service': 'ot' }
const CTRY_ISO = { 'us-nv': 'us', 'us-v': 'us', uk: 'gb', ca: 'ca', hk: 'hk', id: 'id', au: 'au' }
export const DEFAULT_PLANS = [
  { id: 'd1', label: '1 day', minutes: 1440, mult: 3, enabled: true },
  { id: 'd7', label: '7 days', minutes: 10080, mult: 8, enabled: true },
  { id: 'd30', label: '30 days', minutes: 43200, mult: 20, enabled: true },
  { id: 'd90', label: '90 days', minutes: 129600, mult: 45, enabled: true },
]
const CTRY_CODES = { 'us-nv': '187', 'us-v': '12', uk: '16', ca: '36', hk: '14', id: '6', au: '175' }

const COUNTRIES = [
  { id: 'us-nv', name: 'USA (Non-VOIP)', flag: '🇺🇸', code: '+1', mult: 1.6, enabled: true },
  { id: 'us-v', name: 'USA (VOIP)', flag: '🇺🇸', code: '+1', mult: 1, enabled: true },
  { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', code: '+44', mult: 1.3, enabled: true },
  { id: 'ca', name: 'Canada', flag: '🇨🇦', code: '+1', mult: 1.2, enabled: true },
  { id: 'hk', name: 'Hong Kong', flag: '🇭🇰', code: '+852', mult: 1.1, enabled: true },
  { id: 'id', name: 'Indonesia', flag: '🇮🇩', code: '+62', mult: 0.6, enabled: true },
  { id: 'au', name: 'Australia', flag: '🇦🇺', code: '+61', mult: 1.4, enabled: true },
]

const SERVICES = [
  ['WhatsApp', '💬', 0.15], ['Telegram', '✈️', 0.12], ['Google / Gmail', '🔍', 0.10],
  ['Facebook', '📘', 0.08], ['Instagram', '📸', 0.08], ['TikTok', '🎵', 0.07],
  ['X (Twitter)', '✖️', 0.09], ['Discord', '🎮', 0.06], ['Microsoft', '🪟', 0.07],
  ['Amazon', '📦', 0.10], ['Uber', '🚗', 0.09], ['Snapchat', '👻', 0.06],
  ['LinkedIn', '💼', 0.11], ['Viber', '📞', 0.05], ['WeChat', '🟢', 0.20],
  ['Signal', '🔵', 0.08], ['Netflix', '🎬', 0.07], ['Shopee', '🛍️', 0.05],
  ['Line', '💚', 0.06], ['Yahoo', '🟣', 0.05], ['Other / Any service', '🌐', 0.05],
].map(([name, icon, price], i) => ({ id: 's' + (i + 1), name, icon, price, enabled: true, stock: 50 + ((i * 37) % 400) }))

function migrate(d) {
  d.providers ||= []
  d.settings.numberSource ||= 'demo'
  d.settings.activeProvider ||= null
  d.services.forEach((x) => { if (x.pcode == null) x.pcode = SVC_CODES[x.name] || '' })
  d.countries.forEach((x) => { if (x.pcode == null) x.pcode = CTRY_CODES[x.id] || ''; if (x.iso == null) x.iso = CTRY_ISO[x.id] || '' })
  d.settings.rentPlans ||= DEFAULT_PLANS
  return d
}

function seed() {
  const demoId = 'u_demo'
  return {
    settings: {
      siteName: 'SMSNum',
      announcement: '🎉 Welcome bonus: get 5% extra on your first recharge!',
      minRecharge: 1,
      referralPercent: 5,
      orderMinutes: 20,
      extendMinutes: 15,
      adminUser: 'admin',
      adminPass: 'admin',
      paymentMethods: [
        { id: 'usdt', name: 'USDT (TRC20)', details: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', enabled: true },
        { id: 'binance', name: 'Binance Pay', details: 'Pay ID: 000000000', enabled: true },
        { id: 'bkash', name: 'bKash', details: '01XXXXXXXXX (Send Money)', enabled: true },
        { id: 'nagad', name: 'Nagad', details: '01XXXXXXXXX (Send Money)', enabled: true },
      ],
    },
    countries: COUNTRIES,
    services: SERVICES,
    users: [
      {
        id: demoId, name: 'Demo User', email: 'demo@smsnum.com', password: 'demo123',
        balance: 5, createdAt: now() - 3 * 86400000, banned: false,
        refCode: 'DEMO50', referredBy: null, apiKey: 'sk_live_' + uid(), refEarnings: 0,
      },
    ],
    orders: [],
    transactions: [
      { id: uid('t_'), userId: demoId, type: 'credit', amount: 5, note: 'Signup demo credit', at: now() - 3 * 86400000 },
    ],
    recharges: [],
    tickets: [],
    session: { userId: null, admin: false },
    theme: 'light',
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch { /* ignore */ }
  return migrate(seed())
}

let db = load()
const listeners = new Set()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ }
}

export function update(fn) {
  const next = structuredClone(db)
  const result = fn(next)
  db = next
  save()
  listeners.forEach((l) => l())
  return result
}

export const getDB = () => db
export function useDB() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => db)
}
export function resetDB() {
  db = migrate(seed()); save(); listeners.forEach((l) => l())
}

// ---------- helpers ----------
export const money = (n) => '$' + Number(n || 0).toFixed(2)
export const fmtDate = (t) => new Date(t).toLocaleString()
export const priceFor = (service, country) => Math.round(service.price * country.mult * 100) / 100
export const currentUser = (d = db) => d.users.find((u) => u.id === d.session.userId) || null

function randNumber(country) {
  const digits = country.code === '+852' ? 8 : country.code === '+62' ? 11 : 10
  let s = ''
  for (let i = 0; i < digits; i++) s += i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)
  return country.code + ' ' + s
}

function addTx(d, userId, type, amount, note) {
  d.transactions.unshift({ id: uid('t_'), userId, type, amount, note, at: now() })
}

// ---------- auth ----------
export function register({ name, email, password, ref }) {
  return update((d) => {
    email = email.trim().toLowerCase()
    if (d.users.some((u) => u.email === email)) throw new Error('An account with this email already exists')
    const referrer = ref ? d.users.find((u) => u.refCode === ref.trim().toUpperCase()) : null
    const user = {
      id: uid('u_'), name: name.trim(), email, password, balance: 0, createdAt: now(), banned: false,
      refCode: uid().slice(0, 6).toUpperCase(), referredBy: referrer ? referrer.id : null,
      apiKey: 'sk_live_' + uid() + uid(), refEarnings: 0,
    }
    d.users.push(user)
    d.session.userId = user.id
    return user
  })
}

export function login(email, password) {
  return update((d) => {
    const u = d.users.find((x) => x.email === email.trim().toLowerCase() && x.password === password)
    if (!u) throw new Error('Wrong email or password')
    if (u.banned) throw new Error('This account has been suspended. Contact support.')
    d.session.userId = u.id
    return u
  })
}
export const logout = () => update((d) => { d.session.userId = null })

export function adminLogin(user, pass) {
  return update((d) => {
    if (user !== d.settings.adminUser || pass !== d.settings.adminPass) throw new Error('Invalid admin credentials')
    d.session.admin = true
  })
}
export const adminLogout = () => update((d) => { d.session.admin = false })

// ---------- orders ----------
export function buyNumber(serviceId, countryId) {
  return update((d) => {
    const u = currentUser(d)
    if (!u) throw new Error('Please log in first')
    const s = d.services.find((x) => x.id === serviceId)
    const c = d.countries.find((x) => x.id === countryId)
    if (!s || !c || !s.enabled || !c.enabled) throw new Error('This service is not available right now')
    if (s.stock <= 0) throw new Error('Out of stock, try another country')
    const price = priceFor(s, c)
    if (u.balance < price) throw new Error(`Insufficient balance. You need ${money(price)}.`)
    u.balance = Math.round((u.balance - price) * 100) / 100
    s.stock -= 1
    const order = {
      id: uid('o_'), userId: u.id, serviceId, countryId, service: s.name, icon: s.icon, country: c.name, flag: c.flag,
      number: randNumber(c), price, status: 'waiting', sms: [], createdAt: now(),
      expiresAt: now() + d.settings.orderMinutes * MIN,
      // demo: simulated SMS arrives 8-25s after purchase
      smsAt: now() + (8 + Math.random() * 17) * 1000,
    }
    d.orders.unshift(order)
    addTx(d, u.id, 'debit', price, `Number for ${s.name} (${c.name})`)
    return order
  })
}

export const activeProvider = (d = db) =>
  d.settings.numberSource === 'api' ? d.providers.find((p) => p.id === d.settings.activeProvider && p.enabled) || null : null
const providerOf = (o) => db.providers.find((p) => p.id === o.providerId)
const quiet = (promise) => promise && promise.catch && promise.catch(() => {})

// Buy a number: uses the live API provider when "Live API" mode is on, otherwise demo numbers
export async function purchase(serviceId, countryId) {
  if (db.settings.numberSource !== 'api') return buyNumber(serviceId, countryId)
  const p = activeProvider()
  if (!p) throw new Error('Live API mode is on but no active provider is set (Admin → API Providers)')
  const u = currentUser(), s = db.services.find((x) => x.id === serviceId), c = db.countries.find((x) => x.id === countryId)
  if (!u) throw new Error('Please log in first')
  if (!s || !c || !s.enabled || !c.enabled) throw new Error('This service is not available right now')
  const price = priceFor(s, c)
  if (u.balance < price) throw new Error(`Insufficient balance. You need ${money(price)}.`)
  const got = await P.getNumber(p, s.pcode, c.pcode) // throws on provider errors, balance untouched
  return update((d) => {
    const user = currentUser(d)
    user.balance = Math.round((user.balance - price) * 100) / 100
    const order = {
      id: uid('o_'), userId: user.id, serviceId, countryId, service: s.name, icon: s.icon, country: c.name, flag: c.flag,
      number: got.number, price, status: 'waiting', sms: [], createdAt: now(),
      expiresAt: now() + d.settings.orderMinutes * MIN, smsAt: null,
      live: true, providerId: p.id, providerName: p.name, providerOrderId: got.id,
    }
    d.orders.unshift(order)
    addTx(d, user.id, 'debit', price, `Number for ${s.name} (${c.name})`)
    return order
  })
}

export function cancelOrder(id) {
  const live = db.orders.find((x) => x.id === id)
  if (live?.live && live.status === 'waiting' && providerOf(live)) quiet(P.cancelNumber(providerOf(live), live.providerOrderId))
  update((d) => {
    const o = d.orders.find((x) => x.id === id)
    if (!o || o.status !== 'waiting') throw new Error('Only numbers still waiting for SMS can be cancelled')
    o.status = 'cancelled'
    const u = d.users.find((x) => x.id === o.userId)
    if (u) { u.balance = Math.round((u.balance + o.price) * 100) / 100; addTx(d, u.id, 'refund', o.price, `Refund: ${o.service}`) }
  })
}

// Extension options: a short top-up plus the long-term rental plans set by the admin
export function extendOptions(o, d = db) {
  return [
    { id: 'short', label: `${d.settings.extendMinutes} minutes`, minutes: d.settings.extendMinutes, mult: 0.5 },
    ...(d.settings.rentPlans || []).filter((p) => p.enabled),
  ].map((p) => ({ ...p, cost: Math.round(o.price * p.mult * 100) / 100 }))
}
export const canExtend = (o) => ['waiting', 'received', 'completed'].includes(o.status)

export function extendOrder(id, planId = 'short') {
  return update((d) => {
    const o = d.orders.find((x) => x.id === id)
    const u = currentUser(d)
    if (!o || !u || !canExtend(o)) throw new Error('This number can no longer be extended')
    const plan = extendOptions(o, d).find((p) => p.id === planId)
    if (!plan) throw new Error('This extension plan is not available')
    const cost = plan.cost
    if (u.balance < cost) throw new Error(`Insufficient balance. You need ${money(cost)} to extend.`)
    u.balance = Math.round((u.balance - cost) * 100) / 100
    o.expiresAt = Math.max(o.expiresAt, now()) + plan.minutes * MIN
    if (plan.minutes >= 1440) o.rented = true
    if (o.status === 'completed') o.status = 'received'
    o.extensions = [...(o.extensions || []), { plan: plan.label, cost, at: now() }]
    if (o.status === 'received' && !o.live) o.smsAt = now() + (10 + Math.random() * 20) * 1000
    if (o.live) { const p = d.providers.find((x) => x.id === o.providerId); if (p) quiet(P.requestAnotherSms(p, o.providerOrderId)) }
    addTx(d, u.id, 'debit', cost, `Extend ${o.number} +${plan.label}`)
    return plan
  })
}

export function finishOrder(id) {
  const o = db.orders.find((x) => x.id === id)
  if (o?.live && providerOf(o)) quiet(P.finishNumber(providerOf(o), o.providerOrderId))
  update((d) => { const o = d.orders.find((x) => x.id === id); if (o && o.status === 'received') o.status = 'completed' })
}

// Poll the provider for codes on live numbers
const polling = new Set()
async function pollLive() {
  const list = db.orders.filter((o) => o.live && ['waiting', 'received'].includes(o.status) && !polling.has(o.id))
  for (const o of list) {
    const p = providerOf(o)
    if (!p) continue
    polling.add(o.id)
    try {
      const r = await P.getStatus(p, o.providerOrderId)
      update((d) => {
        const x = d.orders.find((y) => y.id === o.id)
        if (!x || !['waiting', 'received'].includes(x.status)) return
        for (const m of r.codes) {
          if (!x.sms.some((s) => s.code === m.code)) { x.sms.push({ code: m.code, text: m.text, at: now() }); x.status = 'received' }
        }
        if (r.cancelled && x.status === 'waiting') {
          x.status = 'cancelled'
          const u = d.users.find((y) => y.id === x.userId)
          if (u) { u.balance = Math.round((u.balance + x.price) * 100) / 100; addTx(d, u.id, 'refund', x.price, `Refund (cancelled by provider): ${x.service}`) }
        }
      })
    } catch { /* try again next round */ }
    polling.delete(o.id)
  }
}

// Ticker: deliver simulated SMS and expire numbers
function tick() {
  const t = now()
  const due = db.orders.some((o) => (['waiting', 'received'].includes(o.status) && (o.expiresAt < t || (o.smsAt && o.smsAt < t))))
  if (!due) return
  update((d) => {
    for (const o of d.orders) {
      if (!['waiting', 'received'].includes(o.status)) continue
      if (o.expiresAt < t) {
        if (o.status === 'waiting') {
          o.status = 'expired'
          if (o.live) { const p = d.providers.find((x) => x.id === o.providerId); if (p) quiet(P.cancelNumber(p, o.providerOrderId)) }
          const u = d.users.find((x) => x.id === o.userId)
          if (u) { u.balance = Math.round((u.balance + o.price) * 100) / 100; addTx(d, u.id, 'refund', o.price, `Auto refund (no SMS): ${o.service}`) }
        } else o.status = 'completed'
        continue
      }
      if (o.smsAt && o.smsAt < t) {
        const code = String(Math.floor(100000 + Math.random() * 900000))
        o.sms.push({ code, text: `Your ${o.service} verification code is ${code}. Do not share this code.`, at: t })
        o.status = 'received'
        o.smsAt = null
      }
    }
  })
}
if (typeof window !== 'undefined') {
  setInterval(tick, 2000)
  setInterval(pollLive, 5000)
  window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); listeners.forEach((l) => l()) } })
}

// ---------- wallet ----------
export function requestRecharge({ amount, method, txid }) {
  update((d) => {
    const u = currentUser(d)
    amount = Number(amount)
    if (!u) throw new Error('Please log in')
    if (!(amount >= d.settings.minRecharge)) throw new Error(`Minimum recharge is ${money(d.settings.minRecharge)}`)
    if (!txid.trim()) throw new Error('Enter the transaction ID')
    d.recharges.unshift({ id: uid('r_'), userId: u.id, amount, method, txid: txid.trim(), status: 'pending', at: now() })
  })
}

export function transferBalance(email, amount) {
  update((d) => {
    const u = currentUser(d)
    amount = Math.round(Number(amount) * 100) / 100
    const to = d.users.find((x) => x.email === email.trim().toLowerCase())
    if (!to) throw new Error('No user with that email')
    if (to.id === u.id) throw new Error('You cannot transfer to yourself')
    if (!(amount > 0)) throw new Error('Enter a valid amount')
    if (u.balance < amount) throw new Error('Insufficient balance')
    u.balance = Math.round((u.balance - amount) * 100) / 100
    to.balance = Math.round((to.balance + amount) * 100) / 100
    addTx(d, u.id, 'debit', amount, `Transfer to ${to.email}`)
    addTx(d, to.id, 'credit', amount, `Transfer from ${u.email}`)
  })
}

export const regenerateApiKey = () => update((d) => { currentUser(d).apiKey = 'sk_live_' + uid() + uid() })
export function updateProfile({ name, password }) {
  update((d) => { const u = currentUser(d); if (name) u.name = name; if (password) u.password = password })
}

// ---------- tickets ----------
export function createTicket(subject, message) {
  update((d) => {
    const u = currentUser(d)
    if (!subject.trim() || !message.trim()) throw new Error('Subject and message are required')
    d.tickets.unshift({ id: uid('k_'), userId: u.id, subject, status: 'open', at: now(), messages: [{ from: 'user', text: message, at: now() }] })
  })
}
export function replyTicket(id, text, from) {
  update((d) => {
    const k = d.tickets.find((x) => x.id === id)
    if (!text.trim()) throw new Error('Message is empty')
    k.messages.push({ from, text, at: now() })
    k.status = from === 'admin' ? 'answered' : 'open'
  })
}
export const closeTicket = (id) => update((d) => { d.tickets.find((x) => x.id === id).status = 'closed' })

// ---------- admin ----------
export function approveRecharge(id) {
  update((d) => {
    const r = d.recharges.find((x) => x.id === id)
    if (r.status !== 'pending') return
    r.status = 'approved'
    const u = d.users.find((x) => x.id === r.userId)
    if (!u) return
    u.balance = Math.round((u.balance + r.amount) * 100) / 100
    addTx(d, u.id, 'credit', r.amount, `Recharge via ${r.method}`)
    if (u.referredBy) {
      const ref = d.users.find((x) => x.id === u.referredBy)
      const bonus = Math.round(r.amount * d.settings.referralPercent) / 100
      if (ref && bonus > 0) {
        ref.balance = Math.round((ref.balance + bonus) * 100) / 100
        ref.refEarnings = Math.round(((ref.refEarnings || 0) + bonus) * 100) / 100
        addTx(d, ref.id, 'credit', bonus, `Referral bonus from ${u.email}`)
      }
    }
  })
}
export const rejectRecharge = (id) => update((d) => { const r = d.recharges.find((x) => x.id === id); if (r.status === 'pending') r.status = 'rejected' })

export function adjustBalance(userId, amount, note) {
  update((d) => {
    const u = d.users.find((x) => x.id === userId)
    amount = Math.round(Number(amount) * 100) / 100
    if (!amount) throw new Error('Enter an amount (negative to deduct)')
    u.balance = Math.round((u.balance + amount) * 100) / 100
    addTx(d, u.id, amount > 0 ? 'credit' : 'debit', Math.abs(amount), note || 'Adjusted by admin')
  })
}
export const toggleBan = (userId) => update((d) => { const u = d.users.find((x) => x.id === userId); u.banned = !u.banned })
export const deleteUser = (userId) => update((d) => { d.users = d.users.filter((x) => x.id !== userId); if (d.session.userId === userId) d.session.userId = null })

export function saveService(s) {
  update((d) => {
    const clean = { ...s, price: Number(s.price), stock: Number(s.stock) }
    const i = d.services.findIndex((x) => x.id === s.id)
    if (i >= 0) d.services[i] = clean
    else d.services.push({ ...clean, id: uid('s_') })
  })
}
export const deleteService = (id) => update((d) => { d.services = d.services.filter((x) => x.id !== id) })
export function saveCountry(c) {
  update((d) => {
    const clean = { ...c, mult: Number(c.mult) }
    const i = d.countries.findIndex((x) => x.id === c.id)
    if (i >= 0) d.countries[i] = clean
    else d.countries.push({ ...clean, id: uid('c_') })
  })
}
export const deleteCountry = (id) => update((d) => { d.countries = d.countries.filter((x) => x.id !== id) })
export const saveSettings = (patch) => update((d) => { d.settings = { ...d.settings, ...patch } })
export function adminCancelOrder(id) {
  update((d) => {
    const o = d.orders.find((x) => x.id === id)
    if (!o || !['waiting', 'received'].includes(o.status)) return
    const refund = o.status === 'waiting'
    o.status = 'cancelled'
    const u = d.users.find((x) => x.id === o.userId)
    if (refund && u) { u.balance = Math.round((u.balance + o.price) * 100) / 100; addTx(d, u.id, 'refund', o.price, `Refund by admin: ${o.service}`) }
  })
}
export const toggleTheme = () => update((d) => { d.theme = d.theme === 'dark' ? 'light' : 'dark' })

// ---------- API providers (admin) ----------
export function saveProvider(p) {
  return update((d) => {
    if (!p.name.trim()) throw new Error('Provider name is required')
    if (!p.baseUrl.trim()) throw new Error('API URL is required')
    const i = d.providers.findIndex((x) => x.id === p.id)
    if (i >= 0) { d.providers[i] = { ...d.providers[i], ...p }; return d.providers[i] }
    const np = { ...p, id: uid('p_'), createdAt: now() }
    d.providers.push(np)
    if (!d.settings.activeProvider) d.settings.activeProvider = np.id
    return np
  })
}
export const deleteProvider = (id) => update((d) => {
  d.providers = d.providers.filter((x) => x.id !== id)
  if (d.settings.activeProvider === id) d.settings.activeProvider = d.providers[0]?.id || null
})
export const setActiveProvider = (id) => update((d) => { d.settings.activeProvider = id })
export const setNumberSource = (mode) => update((d) => { d.settings.numberSource = mode })
export async function testProvider(id) {
  const p = db.providers.find((x) => x.id === id)
  try {
    const balance = await P.getBalance(p)
    if (Number.isNaN(balance)) throw new Error('Could not read balance from the response')
    update((d) => { const x = d.providers.find((y) => y.id === id); x.lastBalance = balance; x.lastCheck = now(); x.lastError = '' })
    return balance
  } catch (e) {
    update((d) => { const x = d.providers.find((y) => y.id === id); x.lastCheck = now(); x.lastError = e.message })
    throw e
  }
}
