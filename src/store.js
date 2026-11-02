// Browser side of SMSNum. All data lives on the server (server/index.js).
// The page keeps a copy of what this user may see, refreshes it every few seconds,
// and runs simple actions locally first (using the same rules as the server) so the screen updates instantly.
import { useSyncExternalStore } from 'react'
import * as core from './core.js'
import { toast } from './ui.jsx'

export { money, fmtDate, priceFor, canonEmail, DEFAULT_PLANS, uid, areaCodesOf, planCost } from './core.js'

// API address: same server by default. To host the website elsewhere, set window.SMSNUM_API = 'https://your-server'
const API = (typeof window !== 'undefined' && window.SMSNUM_API ? String(window.SMSNUM_API) : '').replace(/\/$/, '')
const TOKENS_KEY = 'smsnum_tokens'
const ADMIN_KEY = 'smsnum_admin_token'
const ACTIVE_KEY = 'smsnum_active_token'
const THEME_KEY = 'smsnum_theme'
const MAX_ACCOUNTS = 5

const ls = {
  get: (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v) } catch { return f } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } },
}
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v) } catch { /* ignore */ } },
}

// ---------- local state ----------
let tokens = ls.get(TOKENS_KEY, []) // signed-in accounts on this browser: [{ token, id, name, email }]
let activeToken = ss.get(ACTIVE_KEY) || tokens[0]?.token || null // each tab can use a different account
let adminToken = ls.get(ADMIN_KEY, null)
let theme = ls.get(THEME_KEY, 'light')
const empty = (() => { const s = core.seed(); return { ...s, users: [], orders: [], transactions: [], recharges: [], tickets: [], rev: 0 } })()
let server = { view: empty, me: null, suspended: null, admin: false, accounts: [], rev: 0, loaded: false, offline: false }
let db = compose()
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

function compose() {
  return { ...server.view, session: { userId: server.me, admin: server.admin }, theme, loaded: server.loaded, offline: server.offline }
}
function saveTokens() { ls.set(TOKENS_KEY, tokens) }
function setActive(token) { activeToken = token || null; ss.set(ACTIVE_KEY, activeToken) }

export const getDB = () => db
export function useDB() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => db)
}

// ---------- talking to the server ----------
async function request(path, body, token = activeToken) {
  let res
  try {
    res = await fetch(API + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection and try again.')
  }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `Server error (${res.status})`)
  return j
}

let refreshing = null
export function refresh(force = false) {
  if (refreshing && !force) return refreshing
  const p = (async () => {
    try {
      const r = await request('/api/state', { tokens: tokens.map((t) => t.token), rev: force ? 0 : server.rev })
      // forget accounts that were logged out from another device or deleted
      const invalid = new Set((r.accounts || []).filter((a) => a.invalid).map((a) => a.token))
      if (invalid.size) {
        tokens = tokens.filter((t) => !invalid.has(t.token)); saveTokens()
        if (invalid.has(activeToken)) { setActive(tokens[0]?.token); refreshing = null; return refresh(true) }
      }
      ;(r.accounts || []).forEach((a) => { const t = tokens.find((x) => x.token === a.token); if (t && !a.invalid) Object.assign(t, { id: a.id, name: a.name, email: a.email }) })
      saveTokens()
      server = { ...server, accounts: r.accounts || [], offline: false, loaded: true }
      if (!r.same) server = { ...server, view: r.view, me: r.me, suspended: r.suspended, admin: r.admin, rev: r.rev }
      if (adminToken && !r.same && !r.admin) { adminToken = null; ls.set(ADMIN_KEY, null) } // admin login expired
      db = compose(); emit()
    } catch {
      if (!server.offline) { server = { ...server, offline: true, loaded: true }; db = compose(); emit() }
    } finally { refreshing = null }
  })()
  refreshing = p
  return p
}
if (typeof window !== 'undefined') {
  refresh(true)
  setInterval(() => { if (!document.hidden) refresh() }, 3000)
  window.addEventListener('focus', () => refresh())
  window.addEventListener('storage', (e) => { if (e.key === TOKENS_KEY || e.key === ADMIN_KEY) { tokens = ls.get(TOKENS_KEY, []); adminToken = ls.get(ADMIN_KEY, null); if (!tokens.some((t) => t.token === activeToken)) setActive(tokens[0]?.token); refresh(true) } })
}

const USER_ACTIONS = new Set(['cancelOrder', 'extendOrder', 'finishOrder', 'transferBalance', 'regenerateApiKey', 'updateProfile', 'setSoundAlerts', 'createTicket', 'replyTicket', 'closeTicket', 'logoutDevice', 'logoutOtherDevices'])
// Run an action: first locally (instant result; throws if not allowed), then on the server (the real one).
function act(name, args = {}, { predict = true } = {}) {
  let result
  if (predict) {
    const next = structuredClone(db)
    const ctx = { user: next.users.find((u) => u.id === next.session.userId) || null, admin: next.session.admin && (!USER_ACTIONS.has(name) || args.from === 'admin'), sid: currentSid() }
    result = core.ACTIONS[name](next, ctx, args)
    db = next; emit()
  }
  const p = request('/api/action', { name, args })
    .then((r) => { refresh(true); return r.result ?? true })
    .catch((e) => { refresh(true); if (predict) toast(e.message, 'error'); throw e })
  if (predict) { p.catch(() => {}); return result ?? true }
  return p
}
const currentSid = () => currentUser()?.sessions?.find((s) => s.current)?.sid

// ---------- accounts ----------
export const currentUser = (d = db) => d.users.find((u) => u.id === d.session.userId) || null
export const signedInAccounts = (d = db) => {
  const me = currentUser(d)
  return server.accounts.filter((a) => !a.invalid && !a.suspended).map((a) => (me && a.id === me.id ? { ...a, ...me } : a))
}
export const suspendedAccount = () => server.suspended
export const deviceId = null

function addToken(token, user) {
  tokens = [{ token, id: user.id, name: user.name, email: user.email }, ...tokens.filter((t) => t.id !== user.id)].slice(0, MAX_ACCOUNTS)
  saveTokens(); setActive(token)
}
export async function fetchCaptcha() { return request('/api/captcha') }
export async function register({ name, email, password, ref, captchaId, captcha }) {
  const r = await request('/api/register', { name, email, password, ref, captchaId, captcha }, null)
  addToken(r.token, r.user); await refresh(true)
  return r.user
}
export async function login(email, password, captchaId, captcha) {
  const r = await request('/api/login', { email, password, captchaId, captcha }, null)
  addToken(r.token, r.user); await refresh(true)
  return r.user
}
export function switchAccount(id) {
  const t = tokens.find((x) => x.id === id)
  if (!t) throw new Error('That account is not signed in')
  setActive(t.token); refresh(true)
  return t
}
// sign out of the active account only; switches to the next signed-in account if there is one
export function logout() {
  const tok = activeToken
  if (tok) request('/api/logout', {}, tok).catch(() => {})
  tokens = tokens.filter((t) => t.token !== tok); saveTokens()
  setActive(tokens[0]?.token)
  server = { ...server, me: null, suspended: null }
  db = compose(); emit(); refresh(true)
  return tokens[0] || null
}
export function logoutAll() {
  tokens.forEach((t) => request('/api/logout', {}, t.token).catch(() => {}))
  tokens = []; saveTokens(); setActive(null)
  server = { ...server, me: null, suspended: null, accounts: [] }
  db = compose(); emit(); refresh(true)
}
export const logoutDevice = (sid) => act('logoutDevice', { sid })
export const logoutOtherDevices = () => act('logoutOtherDevices')
export const changePassword = ({ current, next, confirm }) => request('/api/password', { current, next, confirm }).then(() => { refresh(true); return true })

// ---------- admin login ----------
export async function adminLogin(user, pass) {
  const r = await request('/api/admin/login', { user, pass })
  adminToken = r.adminToken; ls.set(ADMIN_KEY, adminToken)
  await refresh(true)
  if (r.defaultPassword) toast('You are using the default admin password. Change it in Settings → Admin login.', 'error', 9000)
  return true
}
export function adminLogout() {
  request('/api/admin/logout', {}).catch(() => {})
  adminToken = null; ls.set(ADMIN_KEY, null)
  server = { ...server, admin: false }; db = compose(); emit(); refresh(true)
}
export const changeAdminLogin = (adminUser, adminPass) => request('/api/admin/credentials', { adminUser, adminPass }).then(() => { adminToken = null; ls.set(ADMIN_KEY, null); refresh(true); return true })
export const resetDB = () => request('/api/admin/reset', {}).then(() => refresh(true))

// ---------- numbers ----------
export const supportsAreaCode = (c, d = db) => core.supportsAreaCode(c, d)
export const periodOptions = (d = db) => core.periodOptions(d)
export const quote = (serviceId, countryId, opts, d = db) => core.quote(serviceId, countryId, opts, d)
export const shortPlan = (d = db) => core.shortPlan(d)
export const extendOptions = (o, d = db) => core.extendOptions(o, d)
export const canExtend = (o, d = db) => core.canExtend(o, d)
export const canResend = (o) => core.canResend(o)
export const resendCost = (o, d = db) => core.resendCost(o, d)
export const activeProvider = (d = db) => core.activeProvider(d)
export const activeNotice = (d = db) => core.activeNotice(d)

export async function purchase(serviceId, countryId, opts = {}) {
  const r = await request('/api/purchase', { serviceId, countryId, opts })
  await refresh(true)
  return r
}
export const cancelOrder = (id) => act('cancelOrder', { id })
export const extendOrder = (id, planId = 'short') => act('extendOrder', { id, planId })
export const finishOrder = (id) => act('finishOrder', { id })
export async function resendCode(id) { const r = await request('/api/resend', { id }); await refresh(true); return r.cost }

// ---------- wallet ----------
export async function requestRecharge({ amount, method, txid }) { const r = await request('/api/recharge', { amount, method, txid }); await refresh(true); return r }
export async function checkRecharge(id) { const r = await request('/api/recharge/check', { id }); await refresh(true); return r }
export const transferBalance = (email, amount) => act('transferBalance', { email, amount }, { predict: false })
export const regenerateApiKey = () => act('regenerateApiKey')
export const updateProfile = ({ name }) => act('updateProfile', { name })
export const setSoundAlerts = (on) => act('setSoundAlerts', { on })

// ---------- support tickets ----------
export const createTicket = (subject, message) => act('createTicket', { subject, message })
export const replyTicket = (id, text, from) => act('replyTicket', { id, text, from })
export const closeTicket = (id, from) => act('closeTicket', { id, from })

// ---------- admin actions ----------
export const approveRecharge = (id, amount) => act('approveRecharge', { id, amount })
export const rejectRecharge = (id) => act('rejectRecharge', { id })
export const adjustBalance = (userId, amount, note) => act('adjustBalance', { userId, amount, note })
export const toggleBan = (userId) => act('toggleBan', { userId })
export const deleteUser = (userId) => act('deleteUser', { userId })
export const adminLogoutAllDevices = (userId) => act('adminLogoutAllDevices', { userId })
export const saveService = (service) => act('saveService', { service })
export const deleteService = (id) => act('deleteService', { id })
export const saveCountry = (country) => act('saveCountry', { country })
export const deleteCountry = (id) => act('deleteCountry', { id })
export const saveSettings = (patch) => act('saveSettings', { patch })
export const adminCancelOrder = (id) => act('adminCancelOrder', { id })
export const saveProvider = (provider) => act('saveProvider', { provider })
export const deleteProvider = (id) => act('deleteProvider', { id })
export const setActiveProvider = (id) => act('setActiveProvider', { id })
export const setNumberSource = (mode) => act('setNumberSource', { mode })
export const postNotice = (text, tone = 'info', hours = 24) => act('postNotice', { text, tone, hours })
export const clearNotice = () => act('clearNotice')
export async function testProvider(id) { const r = await request('/api/admin/provider/test', { id }); await refresh(true); return r.balance }

// ---------- look ----------
export function toggleTheme() { theme = theme === 'dark' ? 'light' : 'dark'; ls.set(THEME_KEY, theme); db = compose(); emit() }
