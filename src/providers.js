// SMS number provider adapters.
// Supported:
//  - "smsactivate": the common SMS-Activate style API (handler_api.php?api_key=..&action=..)
//    used by many providers (HeroSMS, GrizzlySMS, SMS-Man, SMSHub, Vak-SMS and others)
//  - "5sim": 5sim.net JSON API
//  - "custom": any HTTP/JSON API, configured with URL templates and JSON paths

export const PROVIDER_TYPES = {
  smsactivate: { label: 'SMS-Activate compatible (handler_api.php)', base: 'https://api.example.com/stubs/handler_api.php' },
  '5sim': { label: '5SIM', base: 'https://5sim.net/v1' },
  custom: { label: 'Custom JSON API', base: 'https://api.example.com' },
}

export const emptyProvider = () => ({
  name: '', type: 'smsactivate', baseUrl: PROVIDER_TYPES.smsactivate.base, apiKey: '', proxy: '', enabled: true,
  // custom API templates. Placeholders: {base} {key} {service} {country} {id}
  custom: {
    authHeader: '',
    getNumberUrl: '{base}/buy?key={key}&service={service}&country={country}',
    idPath: 'id', numberPath: 'phone',
    statusUrl: '{base}/status?key={key}&id={id}', codePath: 'code', smsTextPath: 'text',
    cancelUrl: '{base}/cancel?key={key}&id={id}',
    finishUrl: '{base}/finish?key={key}&id={id}',
    balanceUrl: '{base}/balance?key={key}', balancePath: 'balance',
  },
})

const get = (obj, path) => (path ? path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj) : undefined)
const fill = (tpl, p, vars) => tpl
  .replaceAll('{base}', p.baseUrl.replace(/\/$/, ''))
  .replaceAll('{key}', encodeURIComponent(p.apiKey))
  .replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? encodeURIComponent(vars[k]) : m))

async function request(p, url, headers = {}) {
  // Optional proxy (e.g. your Cloudflare Worker) to avoid browser CORS blocks
  const finalUrl = p.proxy ? p.proxy.replace(/\/$/, '') + '/?url=' + encodeURIComponent(url) : url
  let res
  try {
    res = await fetch(finalUrl, { headers })
  } catch {
    throw new Error('Could not reach the provider (network or CORS blocked). Add a proxy URL in the provider settings.')
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`Provider error ${res.status}: ${text.slice(0, 120)}`)
  return text
}
const json = (t) => { try { return JSON.parse(t) } catch { throw new Error('Provider sent an invalid response: ' + t.slice(0, 120)) } }

// ---------- SMS-Activate style ----------
const SA_ERRORS = {
  NO_NUMBERS: 'No numbers available for this service/country right now',
  NO_BALANCE: 'Provider account balance is too low',
  BAD_KEY: 'Wrong provider API key',
  BAD_SERVICE: 'Wrong service code for this provider',
  BAD_ACTION: 'Provider does not support this action',
  ERROR_SQL: 'Provider server error',
  BANNED: 'Provider account is banned',
}
async function sa(p, action, params = {}) {
  const q = new URLSearchParams({ api_key: p.apiKey, action, ...params })
  const t = (await request(p, p.baseUrl + (p.baseUrl.includes('?') ? '&' : '?') + q)).trim()
  const errKey = Object.keys(SA_ERRORS).find((k) => t.startsWith(k))
  if (errKey) throw new Error(SA_ERRORS[errKey])
  return t
}

// ---------- 5SIM ----------
async function fivesim(p, path) {
  const t = await request(p, p.baseUrl.replace(/\/$/, '') + path, { Authorization: 'Bearer ' + p.apiKey, Accept: 'application/json' })
  if (t.trim() === 'no free phones') throw new Error('No numbers available right now')
  if (t.trim() === 'not enough user balance') throw new Error('Provider account balance is too low')
  return json(t)
}

// ---------- public API ----------
export async function getBalance(p) {
  if (p.type === 'smsactivate') return Number((await sa(p, 'getBalance')).split(':')[1])
  if (p.type === '5sim') return Number((await fivesim(p, '/user/profile')).balance)
  const c = p.custom
  return Number(get(json(await request(p, fill(c.balanceUrl, p, {}), authH(c))), c.balancePath))
}

// returns { id, number }
export async function getNumber(p, service, country) {
  if (!service) throw new Error('This service has no provider code. Set it in Admin → Services.')
  if (p.type === 'smsactivate') {
    const params = { service }
    if (country !== '' && country != null) params.country = country
    const t = await sa(p, 'getNumber', params)
    if (!t.startsWith('ACCESS_NUMBER')) throw new Error('Unexpected provider response: ' + t)
    const [, id, number] = t.split(':')
    return { id, number: '+' + number.replace(/^\+/, '') }
  }
  if (p.type === '5sim') {
    const r = await fivesim(p, `/user/buy/activation/${country || 'any'}/any/${service}`)
    return { id: String(r.id), number: r.phone }
  }
  const c = p.custom
  const r = json(await request(p, fill(c.getNumberUrl, p, { service, country }), authH(c)))
  const id = get(r, c.idPath), number = get(r, c.numberPath)
  if (!id || !number) throw new Error('Could not read id/number from provider response. Check the JSON paths.')
  return { id: String(id), number: String(number) }
}

// returns { codes: [{code, text}], cancelled? }
export async function getStatus(p, id) {
  if (p.type === 'smsactivate') {
    const t = await sa(p, 'getStatus', { id })
    if (t.startsWith('STATUS_OK')) { const code = t.split(':').slice(1).join(':'); return { codes: [{ code, text: `Your verification code is ${code}` }] } }
    if (t.startsWith('STATUS_CANCEL')) return { codes: [], cancelled: true }
    return { codes: [] }
  }
  if (p.type === '5sim') {
    const r = await fivesim(p, `/user/check/${id}`)
    return { codes: (r.sms || []).map((s) => ({ code: s.code, text: s.text })), cancelled: ['CANCELED', 'BANNED', 'TIMEOUT'].includes(r.status) }
  }
  const c = p.custom
  const r = json(await request(p, fill(c.statusUrl, p, { id }), authH(c)))
  const code = get(r, c.codePath)
  return { codes: code ? [{ code: String(code), text: get(r, c.smsTextPath) || `Your verification code is ${code}` }] : [] }
}

export async function cancelNumber(p, id) {
  if (p.type === 'smsactivate') return sa(p, 'setStatus', { id, status: 8 })
  if (p.type === '5sim') return fivesim(p, `/user/cancel/${id}`)
  if (p.custom.cancelUrl) return request(p, fill(p.custom.cancelUrl, p, { id }), authH(p.custom))
}
export async function finishNumber(p, id) {
  if (p.type === 'smsactivate') return sa(p, 'setStatus', { id, status: 6 })
  if (p.type === '5sim') return fivesim(p, `/user/finish/${id}`)
  if (p.custom.finishUrl) return request(p, fill(p.custom.finishUrl, p, { id }), authH(p.custom))
}
export async function requestAnotherSms(p, id) {
  if (p.type === 'smsactivate') return sa(p, 'setStatus', { id, status: 3 })
}

function authH(c) { return c.authHeader ? { Authorization: c.authHeader } : {} }
