// SMSNum server: serves the website and the API, keeps all data in data/db.json.
// Zero dependencies (Node.js 18+). Start with:  node server/index.js   (or app.cjs on cPanel)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as core from '../src/core.js'
import * as P from '../src/providers.js'
import { verifyDeposit, normalizeTx } from '../src/chain.js'
import { newCaptcha, checkCaptcha } from './captcha.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data')
const DIST_DIR = process.env.DIST_DIR || path.join(ROOT, 'dist')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const PORT = Number(process.env.PORT) || 3000
const MAX_ACCOUNTS_PER_BROWSER = 5
const log = (...a) => console.log(new Date().toISOString(), ...a)

// ---------- storage ----------
fs.mkdirSync(DATA_DIR, { recursive: true })
let db
let saveTimer = null
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) return core.migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')))
  } catch (e) {
    log('Could not read db.json, keeping a copy and starting fresh:', e.message)
    try { fs.copyFileSync(DB_FILE, DB_FILE + '.broken-' + Date.now()) } catch { /* ignore */ }
  }
  const d = core.seed()
  setPassword(d.users[0], 'demo123')
  setAdminPassword(d, 'admin')
  return d
}
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, DB_FILE) // atomic replace: never a half-written file
}
function scheduleSave() { if (!saveTimer) saveTimer = setTimeout(saveNow, 300) }
// daily backup, keep the last 7
function backup() {
  try {
    const dir = path.join(DATA_DIR, 'backups'); fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `db-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(db))
    fs.readdirSync(dir).filter((f) => f.startsWith('db-')).sort().slice(0, -7).forEach((f) => fs.unlinkSync(path.join(dir, f)))
  } catch (e) { log('backup failed', e.message) }
}
// every change goes through here so the revision number (used for live refresh) moves on
function mutate(fn) {
  const result = fn(db)
  db.rev = (db.rev || 0) + 1
  scheduleSave()
  return result
}

// ---------- passwords & sessions ----------
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex')
function setPassword(u, pw) { u.passSalt = crypto.randomBytes(16).toString('hex'); u.passHash = hashPw(pw, u.passSalt); delete u.password }
function checkPassword(u, pw) {
  if (!u?.passHash) return false
  const a = Buffer.from(hashPw(pw, u.passSalt), 'hex'), b = Buffer.from(u.passHash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
function setAdminPassword(d, pw) { d.settings.adminPassSalt = crypto.randomBytes(16).toString('hex'); d.settings.adminPassHash = hashPw(pw, d.settings.adminPassSalt) }
const sidOf = (token) => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 32)
const newToken = () => crypto.randomBytes(32).toString('hex')

function userFromToken(token) {
  if (!token) return null
  const sid = sidOf(token)
  for (const u of db.users) { const s = u.sessions?.find((x) => x.sid === sid); if (s) return { user: u, session: s, sid } }
  return null
}
function adminFromToken(token) {
  if (!token) return false
  const sid = sidOf(token)
  return (db.adminSessions || []).find((x) => x.sid === sid && x.exp > Date.now()) || false
}

// ---------- IP & country ----------
function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return (xf || req.socket.remoteAddress || '').replace(/^::ffff:/, '')
}
const privateIp = (ip) => !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|localhost)/.test(ip)
const geoCache = new Map()
async function geoOf(ip) {
  if (privateIp(ip)) return null
  if (geoCache.has(ip)) return geoCache.get(ip)
  let g = null
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(4000) })
    const j = await r.json(); if (j.success !== false && j.country_code) g = { country: j.country, countryCode: j.country_code }
  } catch { /* try the next one */ }
  if (!g) {
    try {
      const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`, { signal: AbortSignal.timeout(4000) })
      const j = await r.json(); if (j.status === 'success') g = { country: j.country, countryCode: j.countryCode }
    } catch { /* unknown */ }
  }
  geoCache.set(ip, g)
  if (geoCache.size > 20000) geoCache.clear()
  return g
}
function startSession(u, req) {
  const token = newToken()
  const ip = clientIp(req), ua = String(req.headers['user-agent'] || '')
  const s = { sid: sidOf(token), device: core.deviceName(ua), mobile: /Mobi|Android|iPhone/.test(ua), ip, at: Date.now(), lastSeen: Date.now() }
  u.sessions = [s, ...(u.sessions || [])].slice(0, 20)
  u.lastIp = ip
  geoOf(ip).then((g) => {
    if (!g) return
    mutate(() => {
      s.country = g.country; s.countryCode = g.countryCode
      if (!u.country) { u.country = g.country; u.countryCode = g.countryCode }
      u.lastCountry = g.country
    })
  })
  return token
}

// ---------- rate limiting (login / register) ----------
const hits = new Map()
function limited(key, max = 10, windowMs = 10 * 60000) {
  const t = Date.now(), list = (hits.get(key) || []).filter((x) => t - x < windowMs)
  list.push(t); hits.set(key, list)
  if (hits.size > 50000) hits.clear()
  return list.length > max
}

// ---------- what each person is allowed to see ----------
const SECRET_SETTINGS = ['adminPassHash', 'adminPassSalt']
const PRIVATE_SETTINGS = ['adminUser', 'tronApiKey', 'bscRpc', ...SECRET_SETTINGS]
const cleanUser = (u, sid) => {
  const { passHash, passSalt, password, ...rest } = u
  return { ...rest, sessions: (u.sessions || []).map((s) => ({ ...s, current: s.sid === sid })) }
}
const maskKey = (k) => (k ? String(k).slice(0, 4) + '••••••' + String(k).slice(-3) : '')
function viewFor(ctx) {
  const settings = { ...db.settings }
  if (ctx.admin) {
    SECRET_SETTINGS.forEach((k) => delete settings[k])
    return {
      rev: db.rev, settings, services: db.services, countries: db.countries,
      users: db.users.map((u) => cleanUser(u, ctx.sid)),
      orders: db.orders, transactions: db.transactions, recharges: db.recharges, tickets: db.tickets,
      providers: db.providers.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) })),
    }
  }
  PRIVATE_SETTINGS.forEach((k) => delete settings[k])
  const me = ctx.user
  const mine = (x) => me && x.userId === me.id
  return {
    rev: db.rev, settings, services: db.services, countries: db.countries,
    users: me ? [cleanUser(me, ctx.sid), ...db.users.filter((u) => u.referredBy === me.id).map((u) => ({ id: u.id, name: u.name, createdAt: u.createdAt, referredBy: u.referredBy }))] : [],
    orders: db.orders.filter(mine).map(({ providerOrderId, ...o }) => o),
    transactions: db.transactions.filter(mine),
    recharges: db.recharges.filter(mine),
    tickets: db.tickets.filter(mine),
    providers: db.providers.map((p) => ({ id: p.id, allowExtend: p.allowExtend, freeResend: p.freeResend })),
  }
}

// ---------- provider side effects ----------
const providerById = (id) => db.providers.find((p) => p.id === id)
const quiet = (p) => p && p.catch && p.catch((e) => log('provider call failed:', e.message))
function afterAction(name, result, before) {
  const o = before
  if (!o?.live) return
  const p = providerById(o.providerId)
  if (!p) return
  if ((name === 'cancelOrder' || name === 'adminCancelOrder') && o.wasWaiting) quiet(P.cancelNumber(p, o.providerOrderId))
  if (name === 'finishOrder') quiet(P.finishNumber(p, o.providerOrderId))
  if (name === 'extendOrder') quiet(P.requestAnotherSms(p, o.providerOrderId))
}

// ---------- background jobs ----------
setInterval(() => {
  const due = db.orders.some((o) => ['waiting', 'received'].includes(o.status) && (o.expiresAt < Date.now() || (o.smsAt && o.smsAt < Date.now())))
  if (!due) return
  const { sideEffects } = mutate((d) => core.tick(d))
  sideEffects.forEach((e) => { const p = providerById(e.providerId); if (p) quiet(P.cancelNumber(p, e.providerOrderId)) })
}, 2000)

const polling = new Set()
setInterval(async () => {
  for (const o of db.orders.filter((x) => x.live && ['waiting', 'received'].includes(x.status) && !polling.has(x.id))) {
    const p = providerById(o.providerId)
    if (!p) continue
    polling.add(o.id)
    try {
      const r = await P.getStatus(p, o.providerOrderId)
      const fresh = r.codes.filter((m) => !o.sms.some((s) => s.code === m.code))
      if (fresh.length || (r.cancelled && o.status === 'waiting')) {
        mutate((d) => {
          if (!['waiting', 'received'].includes(o.status)) return
          fresh.forEach((m) => { o.sms.push({ code: m.code, text: m.text, at: Date.now() }); o.status = 'received'; o.pendingCharge = null })
          if (r.cancelled && o.status === 'waiting') core.refundWaiting(d, o, 'cancelled', 'Refund (cancelled by provider)')
        })
      }
    } catch { /* retry next round */ }
    polling.delete(o.id)
  }
}, 5000)

const checking = new Set()
async function checkRecharge(id) {
  const r = db.recharges.find((x) => x.id === id)
  if (!r || r.status !== 'pending' || !r.chain || checking.has(id)) return { status: r?.status || 'invalid' }
  checking.add(id)
  let res
  try { res = await verifyDeposit({ chain: r.chain, tx: r.txid, to: r.to, settings: db.settings }) } catch { res = { status: 'pending', reason: 'Could not reach the blockchain right now. It will be checked again automatically.' } }
  checking.delete(id)
  mutate((d) => {
    if (r.status !== 'pending') return
    r.checks = (r.checks || 0) + 1; r.lastCheck = Date.now(); r.note = res.reason || ''
    if (res.amount != null) r.received = res.amount
    if (res.status === 'ok') { r.requested = r.amount; r.amount = Math.floor(res.amount * 100) / 100; core.creditRecharge(d, r, 'Auto-confirmed') }
    else if (res.status === 'invalid') { r.status = 'rejected'; r.autoRejected = true }
    else if (Date.now() - r.at > 6 * 3600000) { r.note = 'Not confirmed after 6 hours — waiting for admin review.'; r.gaveUp = true }
  })
  return res
}
setInterval(() => {
  db.recharges.filter((r) => r.status === 'pending' && r.chain && !r.gaveUp && (!r.lastCheck || Date.now() - r.lastCheck > 14000)).forEach((r) => checkRecharge(r.id))
}, 8000)
setInterval(() => { // tidy expired admin sessions
  const n = (db.adminSessions || []).length
  db.adminSessions = (db.adminSessions || []).filter((s) => s.exp > Date.now())
  if (db.adminSessions.length !== n) mutate(() => {})
}, 3600000)
setInterval(backup, 24 * 3600000)

// ---------- HTTP helpers ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status } }
const fail = (status, msg) => { throw new HttpError(status, msg) }
function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  })
  res.end(data)
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []
    req.on('data', (c) => { size += c.length; if (size > 200 * 1024) { reject(new HttpError(413, 'Request too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch { reject(new HttpError(400, 'Invalid JSON')) } })
    req.on('error', reject)
  })
}
const bearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
function context(req) {
  const found = userFromToken(bearer(req))
  const admin = adminFromToken(String(req.headers['x-admin-token'] || ''))
  if (found) { const t = Date.now(); if (t - (found.session.lastSeen || 0) > 60000) { found.session.lastSeen = t; found.session.ip = clientIp(req); scheduleSave() } }
  return { user: found && !found.user.banned ? found.user : null, suspended: found?.user.banned ? found.user : null, sid: found?.sid, admin: !!admin }
}

// ---------- API ----------
const USER_ACTIONS = new Set(['cancelOrder', 'extendOrder', 'finishOrder', 'transferBalance', 'regenerateApiKey', 'updateProfile', 'setSoundAlerts', 'createTicket', 'replyTicket', 'closeTicket', 'logoutDevice', 'logoutOtherDevices'])
const ADMIN_ACTIONS = new Set(['approveRecharge', 'rejectRecharge', 'adjustBalance', 'toggleBan', 'deleteUser', 'adminLogoutAllDevices', 'saveService', 'deleteService', 'saveCountry', 'deleteCountry', 'saveSettings', 'adminCancelOrder', 'saveProvider', 'deleteProvider', 'setActiveProvider', 'setNumberSource', 'postNotice', 'clearNotice', 'replyTicket', 'closeTicket'])

const routes = {
  'GET /api/health': () => ({ ok: true, rev: db.rev }),
  'GET /api/captcha': () => newCaptcha(),

  // state for this browser: the active account's data plus a summary of every signed-in account
  'POST /api/state': (req, body) => {
    const ctx = context(req)
    const accounts = (Array.isArray(body.tokens) ? body.tokens.slice(0, MAX_ACCOUNTS_PER_BROWSER) : []).map((t) => {
      const f = userFromToken(t)
      return f ? { token: t, id: f.user.id, name: f.user.name, email: f.user.email, balance: f.user.balance, suspended: !!f.user.banned } : { token: t, invalid: true }
    })
    if (body.rev && body.rev === db.rev && !body.force) return { same: true, rev: db.rev, accounts }
    return { rev: db.rev, view: viewFor(ctx), me: ctx.user ? ctx.user.id : null, suspended: ctx.suspended ? { email: ctx.suspended.email } : null, admin: ctx.admin, accounts }
  },

  'POST /api/register': (req, b) => {
    if (limited('reg:' + clientIp(req), 8)) fail(429, 'Too many attempts. Please wait a few minutes.')
    if (!checkCaptcha(b.captchaId, b.captcha)) fail(400, 'The security code is wrong. Please try again.')
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim()
    if (!core.validEmail(email)) fail(400, 'Enter a valid email address')
    if (!name) fail(400, 'Enter your name')
    if (String(b.password || '').length < 6) fail(400, 'Password must be at least 6 characters')
    if (db.users.some((u) => core.canonEmail(u.email) === core.canonEmail(email))) fail(409, 'An account with this email already exists. Please log in instead.')
    return mutate((d) => {
      const ref = b.ref ? d.users.find((u) => u.refCode === String(b.ref).trim().toUpperCase()) : null
      const u = { id: core.uid('u_'), name: name.slice(0, 60), email, balance: 0, createdAt: Date.now(), banned: false, refCode: core.uid().slice(0, 6).toUpperCase(), referredBy: ref ? ref.id : null, apiKey: 'sk_live_' + core.uid() + core.uid(), refEarnings: 0, sessions: [], signupIp: clientIp(req) }
      setPassword(u, b.password)
      d.users.push(u)
      return { token: startSession(u, req), user: { id: u.id, name: u.name, email: u.email } }
    })
  },
  'POST /api/login': (req, b) => {
    if (limited('login:' + clientIp(req), 12)) fail(429, 'Too many attempts. Please wait a few minutes.')
    if (!checkCaptcha(b.captchaId, b.captcha)) fail(400, 'The security code is wrong. Please try again.')
    const u = db.users.find((x) => core.canonEmail(x.email) === core.canonEmail(b.email))
    if (!u || !checkPassword(u, b.password)) fail(401, 'Wrong email or password')
    if (u.banned) fail(403, 'This account has been suspended. Please contact support.')
    return mutate(() => ({ token: startSession(u, req), user: { id: u.id, name: u.name, email: u.email } }))
  },
  'POST /api/logout': (req) => {
    const f = userFromToken(bearer(req))
    if (f) mutate(() => { f.user.sessions = f.user.sessions.filter((s) => s.sid !== f.sid) })
    return { ok: true }
  },
  'POST /api/password': (req, b) => {
    const ctx = context(req)
    if (!ctx.user) fail(401, 'Please log in')
    if (limited('pw:' + ctx.user.id, 10)) fail(429, 'Too many attempts. Please wait a few minutes.')
    if (!checkPassword(ctx.user, b.current)) fail(400, 'Current password is incorrect')
    if (String(b.next || '').length < 6) fail(400, 'New password must be at least 6 characters')
    if (b.next !== b.confirm) fail(400, 'New passwords do not match')
    if (b.next === b.current) fail(400, 'New password must be different from the current one')
    mutate(() => { setPassword(ctx.user, b.next); ctx.user.passwordChangedAt = Date.now() })
    return { ok: true }
  },

  'POST /api/action': (req, b) => {
    const ctx = context(req)
    const name = String(b.name || '')
    const args = b.args || {}
    // admin calls need an admin token; everything else runs as the logged-in user only
    const asAdmin = ctx.admin && ADMIN_ACTIONS.has(name) && (!USER_ACTIONS.has(name) || args.from === 'admin')
    if (!asAdmin) {
      if (!USER_ACTIONS.has(name)) fail(ADMIN_ACTIONS.has(name) ? 401 : 404, ADMIN_ACTIONS.has(name) ? 'Admin login required' : 'Unknown action')
      if (!ctx.user) fail(401, ctx.suspended ? 'This account has been suspended' : 'Please log in first')
    }
    const actx = { ...ctx, admin: asAdmin }
    const o = args.id ? db.orders.find((x) => x.id === args.id) : null
    const before = o ? { ...o, wasWaiting: o.status === 'waiting' } : null
    const result = mutate((d) => core.ACTIONS[name](d, actx, args))
    afterAction(name, result, before)
    return { ok: true, result: name === 'saveProvider' && result ? { ...result, apiKey: maskKey(result.apiKey) } : result }
  },

  'POST /api/purchase': async (req, b) => {
    const ctx = context(req)
    if (!ctx.user) fail(401, 'Please log in first')
    if (db.settings.numberSource !== 'api') return { orders: mutate((d) => core.ACTIONS.buyDemo(d, ctx, b)), failed: 0 }
    const p = core.activeProvider(db)
    if (!p) fail(503, 'Numbers are temporarily unavailable. Please try again later.')
    const s = db.services.find((x) => x.id === b.serviceId), c = db.countries.find((x) => x.id === b.countryId)
    if (!s || !c || !s.enabled || !c.enabled) fail(400, 'This service is not available right now')
    core.validateArea(c, b.opts?.areaCode, db)
    const q = core.quote(s.id, c.id, b.opts || {}, db)
    if (ctx.user.balance < q.total) fail(400, `Insufficient balance. You need ${core.money(q.total)}.`)
    const orders = []; let error = null
    for (let i = 0; i < q.qty; i++) {
      if (ctx.user.balance < q.each) { error = new Error('Insufficient balance'); break }
      let got
      try { got = await P.getNumber(p, s.pcode, c.pcode) } catch (e) { error = e; break } // only charged for numbers we actually got
      orders.push(mutate((d) => {
        ctx.user.balance = Math.round((ctx.user.balance - q.each) * 100) / 100
        return core.makeOrder(d, ctx.user, s, c, q, { number: got.number, smsAt: null, live: true, providerId: p.id, providerName: p.name, providerOrderId: got.id, providerService: s.pcode })
      }))
    }
    if (!orders.length) fail(502, error?.message || 'Could not get a number')
    return { orders: orders.map(({ providerOrderId, ...o }) => o), failed: q.qty - orders.length, error: error?.message }
  },

  'POST /api/resend': async (req, b) => {
    const ctx = context(req)
    if (!ctx.user) fail(401, 'Please log in first')
    const o = db.orders.find((x) => x.id === b.id && x.userId === ctx.user.id)
    if (!o || !core.canResend(o)) fail(400, 'A new code can only be requested after the first SMS has arrived')
    const cost = core.resendCost(o, db)
    if (ctx.user.balance < cost) fail(400, `Insufficient balance. Resend costs ${core.money(cost)}.`)
    let newProviderId = null
    if (o.live) {
      const p = providerById(o.providerId)
      if (!p) fail(400, 'The provider for this number was removed')
      if (p.type === 'smsactivate') await P.requestAnotherSms(p, o.providerOrderId)
      else if (p.type === '5sim') newProviderId = await P.reuseNumber(p, o)
      else fail(400, 'This number does not support resending')
    }
    return mutate((d) => {
      ctx.user.balance = Math.round((ctx.user.balance - cost) * 100) / 100
      o.status = 'waiting'; o.pendingCharge = cost; o.resends = (o.resends || 0) + 1
      o.expiresAt = Math.max(o.expiresAt, Date.now()) + d.settings.orderMinutes * 60000
      if (newProviderId) o.providerOrderId = newProviderId
      if (!o.live) o.smsAt = Date.now() + (8 + Math.random() * 17) * 1000
      core.addTx(d, ctx.user.id, 'debit', cost, `Resend code to ${o.number} (${o.service})`)
      return { cost }
    })
  },

  'POST /api/recharge': async (req, b) => {
    const ctx = context(req)
    if (!ctx.user) fail(401, 'Please log in')
    const amount = Number(b.amount)
    if (!(amount >= db.settings.minRecharge)) fail(400, `Minimum recharge is ${core.money(db.settings.minRecharge)}`)
    const m = db.settings.paymentMethods.find((x) => x.name === b.method && x.enabled)
    if (!m) fail(400, 'No payment method is available right now')
    if (!String(b.txid || '').trim()) fail(400, 'Enter the transaction ID (TxID / hash)')
    const chain = db.settings.autoVerify ? m.chain || '' : ''
    let tx = String(b.txid).trim().slice(0, 200)
    if (chain) { tx = normalizeTx(chain, tx); if (!tx) fail(400, chain === 'bep20' ? 'Enter a valid BEP20 transaction hash (starts with 0x, 66 characters)' : 'Enter a valid TRC20 transaction ID (64 characters)') }
    if (db.recharges.some((r) => r.txid.toLowerCase() === tx.toLowerCase() && r.status !== 'rejected')) fail(409, 'This transaction ID has already been used')
    const id = core.uid('r_')
    mutate((d) => { d.recharges.unshift({ id, userId: ctx.user.id, amount, method: m.name, txid: tx, chain, to: m.details, auto: !!chain, checks: 0, status: 'pending', at: Date.now() }) })
    if (!chain) return { status: 'manual' }
    return checkRecharge(id)
  },
  'POST /api/recharge/check': async (req, b) => {
    const ctx = context(req)
    const r = db.recharges.find((x) => x.id === b.id)
    if (!r || (!ctx.admin && r.userId !== ctx.user?.id)) fail(404, 'Not found')
    return checkRecharge(r.id)
  },

  // ----- admin -----
  'POST /api/admin/login': (req, b) => {
    if (limited('admin:' + clientIp(req), 8)) fail(429, 'Too many attempts. Please wait a few minutes.')
    const s = db.settings
    const a = Buffer.from(hashPw(b.pass || '', s.adminPassSalt), 'hex'), h = Buffer.from(s.adminPassHash || '', 'hex')
    if (String(b.user || '') !== s.adminUser || a.length !== h.length || !crypto.timingSafeEqual(a, h)) fail(401, 'Invalid admin credentials')
    const token = newToken()
    mutate((d) => { d.adminSessions = [...(d.adminSessions || []), { sid: sidOf(token), ip: clientIp(req), at: Date.now(), exp: Date.now() + 7 * 86400000 }] })
    return { adminToken: token, defaultPassword: b.pass === 'admin' }
  },
  'POST /api/admin/logout': (req) => {
    const sid = sidOf(String(req.headers['x-admin-token'] || ''))
    mutate((d) => { d.adminSessions = (d.adminSessions || []).filter((s) => s.sid !== sid) })
    return { ok: true }
  },
  'POST /api/admin/credentials': (req, b) => {
    if (!context(req).admin) fail(401, 'Admin login required')
    if (!String(b.adminUser || '').trim() || String(b.adminPass || '').length < 6) fail(400, 'Username required and password at least 6 characters')
    mutate((d) => { d.settings.adminUser = String(b.adminUser).trim(); setAdminPassword(d, b.adminPass); d.adminSessions = [] })
    return { ok: true }
  },
  'POST /api/admin/provider/test': async (req, b) => {
    if (!context(req).admin) fail(401, 'Admin login required')
    const p = providerById(b.id)
    if (!p) fail(404, 'Provider not found')
    try {
      const balance = await P.getBalance(p)
      if (Number.isNaN(balance)) throw new Error('Could not read balance from the response')
      mutate(() => { p.lastBalance = balance; p.lastCheck = Date.now(); p.lastError = '' })
      return { balance }
    } catch (e) {
      mutate(() => { p.lastCheck = Date.now(); p.lastError = e.message })
      fail(502, e.message)
    }
  },
  'POST /api/admin/reset': (req) => {
    if (!context(req).admin) fail(401, 'Admin login required')
    const keep = { adminUser: db.settings.adminUser, adminPassHash: db.settings.adminPassHash, adminPassSalt: db.settings.adminPassSalt }
    const sessions = db.adminSessions
    backup()
    db = core.seed(); setPassword(db.users[0], 'demo123'); Object.assign(db.settings, keep); db.adminSessions = sessions
    mutate(() => {})
    return { ok: true }
  },
}

// ---------- static website ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' }
function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = path.normalize(path.join(DIST_DIR, urlPath))
  if (!file.startsWith(DIST_DIR)) return send(res, 403, 'Forbidden')
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST_DIR, 'index.html')
  if (!fs.existsSync(file)) return send(res, 404, 'Website files not found. Put the built site in the dist/ folder.')
  const st = fs.statSync(file)
  const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`
  const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' }
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end() }
  res.writeHead(200, headers)
  fs.createReadStream(file).pipe(res)
}

// ---------- server ----------
db = loadDb()
// no admin password saved (fresh install or deliberately removed to recover access) -> default "admin"
if (!db.settings.adminPassHash || !db.settings.adminPassSalt) { setAdminPassword(db, 'admin'); db.settings.adminUser ||= 'admin'; log('Admin password set to the default "admin". Change it in Admin -> Settings.') }
saveNow()
backup()
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  // allow a separately hosted frontend (e.g. GitHub Pages) when ALLOWED_ORIGIN is set
  const origin = req.headers.origin
  const cors = process.env.ALLOWED_ORIGIN && origin && process.env.ALLOWED_ORIGIN.split(',').includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' } : {}
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res)
  const handler = routes[`${req.method} ${url.pathname}`]
  try {
    if (!handler) fail(404, 'Not found')
    const body = req.method === 'POST' ? await readBody(req) : {}
    const out = await handler(req, body)
    send(res, 200, out, cors)
  } catch (e) {
    const status = e.status || (e instanceof Error && !e.status ? 400 : 500)
    if (!e.status) log('error', req.method, url.pathname, e.message)
    send(res, status, { error: e.message || 'Server error' }, cors)
  }
})
server.listen(PORT, () => log(`SMSNum running on http://localhost:${PORT}  (data: ${DB_FILE})`))
const shutdown = () => { try { saveNow() } catch { /* ignore */ } process.exit(0) }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown)
