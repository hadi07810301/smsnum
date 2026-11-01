// Cloudflare Worker: CORS proxy for your SMS number provider API.
// Some providers block requests made directly from a browser (CORS).
// This worker forwards the request and adds the CORS headers the site needs.
//
// Setup (free):
// 1. Go to https://dash.cloudflare.com → Workers & Pages → Create → "Hello World" worker
// 2. Replace its code with this file and click Deploy
// 3. In the worker's Settings → Variables, add ALLOWED_HOSTS = your provider's domain
//    (comma separated, e.g. "hero-sms.com,api.grizzlysms.com") so nobody else can misuse it
// 4. Copy the worker URL (https://xxxx.workers.dev) into Admin → API Providers → Proxy URL

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    const target = new URL(request.url).searchParams.get('url')
    if (!target) return new Response('Missing ?url=', { status: 400, headers: cors })

    let host
    try { host = new URL(target).hostname } catch { return new Response('Bad url', { status: 400, headers: cors }) }
    const allowed = (env.ALLOWED_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean)
    if (!allowed.some((h) => host === h || host.endsWith('.' + h))) {
      return new Response('Host not allowed: ' + host, { status: 403, headers: cors })
    }

    const headers = {}
    const auth = request.headers.get('Authorization')
    if (auth) headers.Authorization = auth
    headers.Accept = request.headers.get('Accept') || '*/*'

    const res = await fetch(target, { method: 'GET', headers })
    return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') || 'text/plain' } })
  },
}
