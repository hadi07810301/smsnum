// SMSNum business logic, shared by the server (the real source of truth) and the browser
// (to show results instantly). Pure JavaScript: no React, no browser APIs, no network.
// Every action has the shape (d, ctx, args) => result, where d is the database object and
// ctx = { user, admin, sid, now } (user = the logged-in user object inside d, or null).

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
const MIN = 60 * 1000
const r2 = (n) => Math.round(n * 100) / 100

// ---------- defaults ----------
const SVC_CODES = { WhatsApp: 'wa', Telegram: 'tg', 'Google / Gmail': 'go', Facebook: 'fb', Instagram: 'ig', TikTok: 'lf', 'X (Twitter)': 'tw', Discord: 'ds', Microsoft: 'mm', Amazon: 'am', Uber: 'ub', Snapchat: 'fu', LinkedIn: 'tn', Viber: 'vi', WeChat: 'wb', Signal: 'bw', Netflix: 'nf', Shopee: 'ka', Line: 'me', Yahoo: 'mb', 'Other / Any service': 'ot' }
const CTRY_ISO = { 'us-nv': 'us', 'us-v': 'us', uk: 'gb', ca: 'ca', hk: 'hk', id: 'id', au: 'au' }
const CTRY_CODES = { 'us-nv': '187', 'us-v': '12', uk: '16', ca: '36', hk: '14', id: '6', au: '175' }
const US_AREAS = '212, 213, 305, 310, 312, 347, 415, 469, 512, 617, 646, 702, 713, 718, 786, 818, 917, 929'
const AREA_CODES = { 'us-nv': US_AREAS, 'us-v': US_AREAS, ca: '403, 416, 437, 514, 587, 604, 613, 647, 778, 905' }
const BEP20_METHOD = { id: 'bep20', name: 'USDT (BEP20)', network: 'BNB Smart Chain (BEP20)', details: '0xc6a794577ffcd2307c04107642ce17f465356b85', qr: true, chain: 'bep20', enabled: true }
const TRC20_METHOD = { id: 'usdt', name: 'USDT (TRC20)', network: 'Tron (TRC20)', details: 'TWnEb8Fdy4xqjfk8nqHXYSUo8XrqRvmheh', qr: true, chain: 'trc20', enabled: true }
const BINANCE_PAY_METHOD = { id: 'binance', name: 'Binance Pay', network: 'Binance Pay ID', details: '414012888', qr: false, chain: '', enabled: true }
export const DEFAULT_PLANS = [
  { id: 'd1', label: '1 day', minutes: 1440, mult: 3, priceType: 'mult', price: 1, enabled: true },
  { id: 'd7', label: '7 days', minutes: 10080, mult: 8, priceType: 'mult', price: 1, enabled: true },
  { id: 'd30', label: '30 days', minutes: 43200, mult: 20, priceType: 'mult', price: 1, enabled: true },
  { id: 'd90', label: '90 days', minutes: 129600, mult: 45, priceType: 'mult', price: 1, enabled: true },
]
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

// A fresh database. Passwords are NOT stored here: the server sets hashed passwords.
export function seed(now = Date.now()) {
  return migrate({
    rev: 1,
    settings: {
      siteName: 'SMSNum', announcement: '', minRecharge: 1, referralPercent: 5, orderMinutes: 20, extendMinutes: 15,
      adminUser: 'admin', paymentMethods: [{ ...BEP20_METHOD }, { ...TRC20_METHOD }, { ...BINANCE_PAY_METHOD }],
    },
    countries: COUNTRIES.map((c) => ({ ...c })),
    services: SERVICES.map((s) => ({ ...s })),
    users: [{ id: 'u_demo', name: 'Demo User', email: 'demo@smsnum.com', balance: 5, createdAt: now - 3 * 86400000, banned: false, refCode: 'DEMO50', referredBy: null, apiKey: 'sk_live_' + uid() + uid(), refEarnings: 0, sessions: [] }],
    orders: [],
    transactions: [{ id: uid('t_'), userId: 'u_demo', type: 'credit', amount: 5, note: 'Welcome credit', at: now - 3 * 86400000 }],
    recharges: [], tickets: [], providers: [],
  })
}

// Fills in any setting that an older database is missing
export function migrate(d) {
  d.rev ||= 1
  d.providers ||= []; d.orders ||= []; d.transactions ||= []; d.recharges ||= []; d.tickets ||= []
  const s = d.settings
  s.numberSource ||= 'demo'
  s.activeProvider ||= null
  s.rentPlans ||= DEFAULT_PLANS.map((p) => ({ ...p }))
  s.rentPlans.forEach((p) => { p.priceType ||= 'mult'; if (p.price == null) p.price = 1 })
  if (s.extendMult == null) s.extendMult = 0.5
  if (s.resendMult == null) s.resendMult = 0.5
  if (s.areaCodeFeePct == null) s.areaCodeFeePct = 20
  if (s.maxQty == null) s.maxQty = 10
  s.telegramSupport ??= ''
  s.notice ||= { text: '', tone: 'info', until: 0 }
  if (s.autoVerify == null) s.autoVerify = true
  if (s.minConfirmations == null) s.minConfirmations = 3
  s.bscRpc ??= ''; s.tronApiKey ??= ''
  s.paymentMethods ||= []
  s.paymentMethods.forEach((m) => { if (m.chain == null) m.chain = /bep20/i.test(m.name) ? 'bep20' : /trc20/i.test(m.name) ? 'trc20' : ''; m.network ??= ''; if (m.qr == null) m.qr = !!m.chain })
  d.services.forEach((x) => { if (x.pcode == null) x.pcode = SVC_CODES[x.name] || ''; x.rentPrices ||= {} })
  d.countries.forEach((x) => { if (x.pcode == null) x.pcode = CTRY_CODES[x.id] || ''; if (x.iso == null) x.iso = CTRY_ISO[x.id] || ''; if (x.areaCodes == null) x.areaCodes = AREA_CODES[x.id] || '' })
  d.providers.forEach((p) => { if (p.allowExtend == null) p.allowExtend = true; if (p.freeResend == null) p.freeResend = false })
  d.users.forEach((u) => { u.sessions ||= [] })
  return d
}

// ---------- small helpers (safe to use anywhere) ----------
export const money = (n) => '$' + Number(n || 0).toFixed(2)
export const fmtDate = (t) => new Date(t).toLocaleString()
export const priceFor = (service, country) => r2(service.price * country.mult)
export function canonEmail(e) { // same mailbox = same account (case, spaces, Gmail dots and +tags)
  e = String(e || '').trim().toLowerCase()
  const [local, domain] = e.split('@')
  if (!domain) return e
  if (domain === 'gmail.com' || domain === 'googlemail.com') return local.split('+')[0].replace(/\./g, '') + '@gmail.com'
  return local.split('+')[0] + '@' + domain
}
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())
export function deviceName(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Unknown'
  return `${browser} on ${os}`
}
export const areaCodesOf = (c) => (c?.areaCodes || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
export const supportsAreaCode = (c, d) => d.settings.numberSource !== 'api' && areaCodesOf(c).length > 0
export const periodOptions = (d) => [{ id: 'std', label: `${d.settings.orderMinutes} minutes`, minutes: d.settings.orderMinutes, standard: true }, ...(d.settings.rentPlans || []).filter((p) => p.enabled)]
export function planCost(plan, numberPrice, service) {
  const custom = service?.rentPrices?.[plan.id]
  if (custom !== undefined && custom !== '' && custom !== null && !Number.isNaN(Number(custom))) return r2(Number(custom))
  if (plan.priceType === 'fixed') return r2(Number(plan.price))
  return r2(numberPrice * Number(plan.mult))
}
export const shortPlan = (d) => ({ id: 'short', label: `${d.settings.extendMinutes} minutes`, minutes: d.settings.extendMinutes, mult: d.settings.extendMult ?? 0.5, priceType: 'mult' })
export function quote(serviceId, countryId, { areaCode = '', periodId = 'std', qty = 1 } = {}, d) {
  const s = d.services.find((x) => x.id === serviceId), c = d.countries.find((x) => x.id === countryId)
  if (!s || !c) return null
  const unit = priceFor(s, c)
  const areaFee = areaCode ? Math.round(unit * (d.settings.areaCodeFeePct ?? 20)) / 100 : 0
  const period = periodOptions(d).find((p) => p.id === periodId) || periodOptions(d)[0]
  const periodCost = period.standard ? 0 : planCost(period, unit, s)
  const each = r2(unit + areaFee + periodCost)
  qty = Math.max(1, Math.min(d.settings.maxQty || 10, Math.floor(Number(qty) || 1)))
  return { unit, areaFee, period, periodCost, each, qty, total: r2(each * qty) }
}
export function extendOptions(o, d) {
  const service = d.services.find((x) => x.id === o.serviceId)
  return [shortPlan(d), ...(d.settings.rentPlans || []).filter((p) => p.enabled)].map((p) => ({ ...p, cost: planCost(p, o.price, service) }))
}
export const canExtend = (o, d) => {
  if (!['waiting', 'received', 'completed'].includes(o.status)) return false
  const prov = o.live && (d.providers || []).find((x) => x.id === o.providerId)
  return !(prov && prov.allowExtend === false)
}
export const canResend = (o) => ['received', 'completed'].includes(o.status) && o.sms.length > 0 && !(o.rented && o.status === 'received')
export function resendCost(o, d) {
  const prov = o.live && (d.providers || []).find((x) => x.id === o.providerId)
  if (prov && prov.freeResend) return 0
  const custom = d.services.find((x) => x.id === o.serviceId)?.resendPrice
  if (custom !== undefined && custom !== '' && custom !== null && !Number.isNaN(Number(custom))) return r2(Number(custom))
  return r2(o.price * (d.settings.resendMult ?? 0.5))
}
export const activeNotice = (d, now = Date.now()) => (d.settings.notice?.text && d.settings.notice.until > now ? d.settings.notice : null)
export const activeProvider = (d) => (d.settings.numberSource === 'api' ? d.providers.find((p) => p.id === d.settings.activeProvider && p.enabled) || null : null)

// ---------- internal ----------
export function addTx(d, userId, type, amount, note, now = Date.now()) {
  d.transactions.unshift({ id: uid('t_'), userId, type, amount, note, at: now })
}
// A waiting number got no SMS: refund what was paid for this wait.
// After a resend only the resend price is refunded and the number goes back to "completed".
export function refundWaiting(d, o, status, note) {
  const resent = o.pendingCharge != null
  const amount = resent ? o.pendingCharge : o.paid ?? o.price
  o.status = resent ? 'completed' : status
  o.pendingCharge = null
  const u = d.users.find((x) => x.id === o.userId)
  if (u && amount > 0) { u.balance = r2(u.balance + amount); addTx(d, u.id, 'refund', amount, `${note}${resent ? ' (resend)' : ''}: ${o.service}`) }
}
export function creditRecharge(d, r, how) {
  r.status = 'approved'
  r.approvedBy = how
  const u = d.users.find((x) => x.id === r.userId)
  if (!u) return
  u.balance = r2(u.balance + r.amount)
  addTx(d, u.id, 'credit', r.amount, `Recharge via ${r.method}${how === 'Auto-confirmed' ? ' (auto)' : ''}`)
  if (u.referredBy) {
    const ref = d.users.find((x) => x.id === u.referredBy)
    const bonus = Math.round(r.amount * d.settings.referralPercent) / 100
    if (ref && bonus > 0) { ref.balance = r2(ref.balance + bonus); ref.refEarnings = r2((ref.refEarnings || 0) + bonus); addTx(d, ref.id, 'credit', bonus, `Referral bonus from ${u.email}`) }
  }
}
function randNumber(country, areaCode) {
  const digits = country.code === '+852' ? 8 : country.code === '+62' ? 11 : 10
  let s = areaCode ? String(areaCode) : ''
  for (let i = s.length; i < digits; i++) s += i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)
  return country.code + ' ' + s
}
export function validateArea(c, areaCode, d) {
  if (!areaCode) return ''
  if (d.settings.numberSource === 'api') throw new Error('Custom area codes are not available for this number source')
  if (!/^[2-9]\d{2}$/.test(String(areaCode))) throw new Error('Area code must be 3 digits (e.g. 212)')
  if (!areaCodesOf(c).length) throw new Error('Custom area codes are not available for this country')
  return String(areaCode)
}
export function makeOrder(d, u, s, c, q, extra, now = Date.now()) {
  const order = {
    id: uid('o_'), userId: u.id, serviceId: s.id, countryId: c.id, service: s.name, icon: s.icon, country: c.name, flag: c.flag,
    price: q.unit, paid: q.each, status: 'waiting', sms: [], createdAt: now, expiresAt: now + q.period.minutes * MIN,
    rented: !q.period.standard && q.period.minutes >= 1440, periodLabel: q.period.label, ...extra,
  }
  d.orders.unshift(order)
  const bits = [q.areaFee ? `area ${extra.areaCode}` : '', q.period.standard ? '' : q.period.label].filter(Boolean).join(', ')
  addTx(d, u.id, 'debit', q.each, `Number for ${s.name} (${c.name})${bits ? ' · ' + bits : ''}`)
  return order
}
const needUser = (ctx) => { if (!ctx.user) throw new Error('Please log in first'); if (ctx.user.banned) throw new Error('This account has been suspended'); return ctx.user }
const needAdmin = (ctx) => { if (!ctx.admin) throw new Error('Admin login required') }
const ownOrder = (d, ctx, id) => { const o = d.orders.find((x) => x.id === id); if (!o || o.userId !== ctx.user?.id) throw new Error('Order not found'); return o }
const ownTicket = (d, ctx, id) => { const k = d.tickets.find((x) => x.id === id); if (!k || (!ctx.admin && k.userId !== ctx.user?.id)) throw new Error('Ticket not found'); return k }

// ---------- actions ----------
// Admin-only actions are marked with needAdmin(ctx). Network work (provider API, blockchain, passwords)
// is done by the server around these.
export const ACTIONS = {
  // ===== user =====
  buyDemo(d, ctx, { serviceId, countryId, opts = {} }) {
    const u = needUser(ctx)
    if (d.settings.numberSource === 'api') throw new Error('Numbers come from the live provider right now')
    const s = d.services.find((x) => x.id === serviceId), c = d.countries.find((x) => x.id === countryId)
    if (!s || !c || !s.enabled || !c.enabled) throw new Error('This service is not available right now')
    const areaCode = validateArea(c, opts.areaCode, d)
    const q = quote(serviceId, countryId, { ...opts, areaCode }, d)
    if (s.stock < q.qty) throw new Error(s.stock <= 0 ? 'Out of stock, try another country' : `Only ${s.stock} numbers left`)
    if (u.balance < q.total) throw new Error(`Insufficient balance. You need ${money(q.total)}.`)
    u.balance = r2(u.balance - q.total)
    s.stock -= q.qty
    const orders = []
    for (let i = 0; i < q.qty; i++) orders.push(makeOrder(d, u, s, c, q, { number: randNumber(c, areaCode), areaCode, smsAt: Date.now() + (8 + Math.random() * 17 + i * 3) * 1000 }))
    return orders
  },
  cancelOrder(d, ctx, { id }) {
    needUser(ctx)
    const o = ownOrder(d, ctx, id)
    if (o.status !== 'waiting') throw new Error('Only numbers still waiting for SMS can be cancelled')
    refundWaiting(d, o, 'cancelled', 'Refund')
    return o
  },
  extendOrder(d, ctx, { id, planId = 'short' }) {
    const u = needUser(ctx)
    const o = ownOrder(d, ctx, id)
    if (!canExtend(o, d)) throw new Error('This number can no longer be extended')
    const plan = extendOptions(o, d).find((p) => p.id === planId)
    if (!plan) throw new Error('This extension plan is not available')
    if (u.balance < plan.cost) throw new Error(`Insufficient balance. You need ${money(plan.cost)} to extend.`)
    u.balance = r2(u.balance - plan.cost)
    o.expiresAt = Math.max(o.expiresAt, Date.now()) + plan.minutes * MIN
    if (plan.minutes >= 1440) o.rented = true
    if (o.status === 'completed') o.status = 'received'
    o.extensions = [...(o.extensions || []), { plan: plan.label, cost: plan.cost, at: Date.now() }]
    if (o.status === 'received' && !o.live) o.smsAt = Date.now() + (10 + Math.random() * 20) * 1000
    addTx(d, u.id, 'debit', plan.cost, `Extend ${o.number} +${plan.label}`)
    return plan
  },
  finishOrder(d, ctx, { id }) {
    needUser(ctx)
    const o = ownOrder(d, ctx, id)
    if (o.status === 'received') o.status = 'completed'
    return o
  },
  transferBalance(d, ctx, { email, amount }) {
    const u = needUser(ctx)
    amount = r2(Number(amount))
    const to = d.users.find((x) => canonEmail(x.email) === canonEmail(email))
    if (!to) throw new Error('No user with that email')
    if (to.id === u.id) throw new Error('You cannot transfer to yourself')
    if (!(amount > 0)) throw new Error('Enter a valid amount')
    if (u.balance < amount) throw new Error('Insufficient balance')
    u.balance = r2(u.balance - amount); to.balance = r2(to.balance + amount)
    addTx(d, u.id, 'debit', amount, `Transfer to ${to.email}`); addTx(d, to.id, 'credit', amount, `Transfer from ${u.email}`)
  },
  regenerateApiKey(d, ctx) { needUser(ctx).apiKey = 'sk_live_' + uid() + uid() },
  updateProfile(d, ctx, { name }) { const u = needUser(ctx); if (!String(name || '').trim()) throw new Error('Name cannot be empty'); u.name = String(name).trim().slice(0, 60) },
  setSoundAlerts(d, ctx, { on }) { needUser(ctx).sound = !!on },
  createTicket(d, ctx, { subject, message }) {
    const u = needUser(ctx)
    if (!String(subject || '').trim() || !String(message || '').trim()) throw new Error('Subject and message are required')
    d.tickets.unshift({ id: uid('k_'), userId: u.id, subject: String(subject).slice(0, 120), status: 'open', at: Date.now(), messages: [{ from: 'user', text: String(message).slice(0, 4000), at: Date.now() }] })
  },
  replyTicket(d, ctx, { id, text, from: as }) {
    const k = ownTicket(d, ctx, id)
    if (!String(text || '').trim()) throw new Error('Message is empty')
    const from = ctx.admin && as === 'admin' ? 'admin' : 'user'
    k.messages.push({ from, text: String(text).slice(0, 4000), at: Date.now() })
    k.status = from === 'admin' ? 'answered' : 'open'
  },
  closeTicket(d, ctx, { id }) { ownTicket(d, ctx, id).status = 'closed' },
  logoutDevice(d, ctx, { sid }) { const u = needUser(ctx); u.sessions = u.sessions.filter((x) => x.sid !== sid) },
  logoutOtherDevices(d, ctx) { const u = needUser(ctx); u.sessions = u.sessions.filter((x) => x.sid === ctx.sid) },

  // ===== admin =====
  approveRecharge(d, ctx, { id, amount }) {
    needAdmin(ctx)
    const r = d.recharges.find((x) => x.id === id)
    if (!r || r.status !== 'pending') return
    if (amount != null && Number(amount) > 0) { r.requested = r.amount; r.amount = r2(Number(amount)) }
    creditRecharge(d, r, 'Admin')
  },
  rejectRecharge(d, ctx, { id }) { needAdmin(ctx); const r = d.recharges.find((x) => x.id === id); if (r && r.status === 'pending') r.status = 'rejected' },
  adjustBalance(d, ctx, { userId, amount, note }) {
    needAdmin(ctx)
    const u = d.users.find((x) => x.id === userId)
    amount = r2(Number(amount))
    if (!u) throw new Error('User not found')
    if (!amount) throw new Error('Enter an amount (negative to deduct)')
    u.balance = r2(u.balance + amount)
    addTx(d, u.id, amount > 0 ? 'credit' : 'debit', Math.abs(amount), note || 'Adjusted by admin')
  },
  toggleBan(d, ctx, { userId }) {
    needAdmin(ctx)
    const u = d.users.find((x) => x.id === userId)
    if (!u) throw new Error('User not found')
    u.banned = !u.banned
    if (u.banned) u.suspendedAt = Date.now() // devices stay linked so they can show "Account suspended"; every action is blocked
    return u.banned
  },
  deleteUser(d, ctx, { userId }) { needAdmin(ctx); d.users = d.users.filter((x) => x.id !== userId) },
  adminLogoutAllDevices(d, ctx, { userId }) { needAdmin(ctx); const u = d.users.find((x) => x.id === userId); if (u) u.sessions = [] },
  saveService(d, ctx, { service: s }) {
    needAdmin(ctx)
    if (!String(s.name || '').trim()) throw new Error('Name is required')
    const rentPrices = {}
    Object.entries(s.rentPrices || {}).forEach(([k, v]) => { if (v !== '' && v != null && !Number.isNaN(Number(v))) rentPrices[k] = Number(v) })
    const resendPrice = s.resendPrice === '' || s.resendPrice == null || Number.isNaN(Number(s.resendPrice)) ? null : Number(s.resendPrice)
    const clean = { ...s, price: Number(s.price) || 0, stock: Number(s.stock) || 0, rentPrices, resendPrice }
    const i = d.services.findIndex((x) => x.id === s.id)
    if (i >= 0) d.services[i] = clean
    else d.services.push({ ...clean, id: uid('s_') })
  },
  deleteService(d, ctx, { id }) { needAdmin(ctx); d.services = d.services.filter((x) => x.id !== id) },
  saveCountry(d, ctx, { country: c }) {
    needAdmin(ctx)
    if (!String(c.name || '').trim()) throw new Error('Name is required')
    const clean = { ...c, mult: Number(c.mult) || 1 }
    const i = d.countries.findIndex((x) => x.id === c.id)
    if (i >= 0) d.countries[i] = clean
    else d.countries.push({ ...clean, id: uid('c_') })
  },
  deleteCountry(d, ctx, { id }) { needAdmin(ctx); d.countries = d.countries.filter((x) => x.id !== id) },
  saveSettings(d, ctx, { patch }) {
    needAdmin(ctx)
    const { adminUser, adminPassHash, adminPassSalt, adminPass, ...safe } = patch || {} // admin login is changed via its own action
    d.settings = { ...d.settings, ...safe }
  },
  adminCancelOrder(d, ctx, { id }) {
    needAdmin(ctx)
    const o = d.orders.find((x) => x.id === id)
    if (!o || !['waiting', 'received'].includes(o.status)) return
    if (o.status === 'waiting') refundWaiting(d, o, 'cancelled', 'Refund by admin')
    else o.status = 'cancelled'
    return o
  },
  saveProvider(d, ctx, { provider: p }) {
    needAdmin(ctx)
    if (!String(p.name || '').trim()) throw new Error('Provider name is required')
    if (!String(p.baseUrl || '').trim()) throw new Error('API URL is required')
    const i = d.providers.findIndex((x) => x.id === p.id)
    if (i >= 0) {
      const keep = d.providers[i]
      d.providers[i] = { ...keep, ...p, apiKey: p.apiKey && !String(p.apiKey).includes('••') ? p.apiKey : keep.apiKey }
      return d.providers[i]
    }
    const np = { allowExtend: true, freeResend: false, ...p, id: uid('p_'), createdAt: Date.now() }
    d.providers.push(np)
    if (!d.settings.activeProvider) d.settings.activeProvider = np.id
    return np
  },
  deleteProvider(d, ctx, { id }) {
    needAdmin(ctx)
    d.providers = d.providers.filter((x) => x.id !== id)
    if (d.settings.activeProvider === id) d.settings.activeProvider = d.providers[0]?.id || null
  },
  setActiveProvider(d, ctx, { id }) { needAdmin(ctx); d.settings.activeProvider = id },
  setNumberSource(d, ctx, { mode }) { needAdmin(ctx); if (mode === 'api' && !d.providers.length) throw new Error('Add an API provider first'); d.settings.numberSource = mode === 'api' ? 'api' : 'demo' },
  postNotice(d, ctx, { text, tone = 'info', hours = 24 }) {
    needAdmin(ctx)
    if (!String(text || '').trim()) throw new Error('Write a message first')
    d.settings.notice = { id: uid('n_'), text: String(text).trim().slice(0, 200), tone, at: Date.now(), until: Date.now() + hours * 3600000 }
  },
  clearNotice(d, ctx) { needAdmin(ctx); d.settings.notice = { text: '', tone: 'info', until: 0 } },
}

// Delivers simulated SMS for demo numbers and expires numbers. Returns provider calls to make
// (cancel numbers that expired without an SMS).
export function tick(d, t = Date.now()) {
  const sideEffects = []
  let changed = false
  for (const o of d.orders) {
    if (!['waiting', 'received'].includes(o.status)) continue
    if (o.expiresAt < t) {
      if (o.status === 'waiting') {
        if (o.live) sideEffects.push({ type: 'cancel', providerId: o.providerId, providerOrderId: o.providerOrderId })
        refundWaiting(d, o, 'expired', 'Auto refund (no SMS)')
      } else o.status = 'completed'
      changed = true
      continue
    }
    if (o.smsAt && o.smsAt < t && !o.live) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      o.sms.push({ code, text: `Your ${o.service} verification code is ${code}. Do not share this code.`, at: t })
      o.status = 'received'; o.smsAt = null; o.pendingCharge = null
      changed = true
    }
  }
  return { changed, sideEffects }
}
