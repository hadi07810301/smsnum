// Automatic crypto deposit verification straight from the blockchain (no API keys needed).
//  - USDT BEP20 (BNB Smart Chain): reads the transaction receipt from a public BSC node
//  - USDT TRC20 (Tron): reads your address's incoming USDT transfers from TronGrid

export const USDT_BEP20 = '0x55d398326f99059ff775485246999027b3197955' // 18 decimals
export const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' // 6 decimals
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export const DEFAULT_BSC_RPCS = ['https://bsc-dataseed.bnbchain.org', 'https://bsc-dataseed.binance.org', 'https://bsc-rpc.publicnode.com']
export const explorerTx = (chain, tx) => (chain === 'bep20' ? `https://bscscan.com/tx/${tx}` : chain === 'trc20' ? `https://tronscan.org/#/transaction/${tx}` : null)

// Result: { status: 'ok', amount } | { status: 'pending', reason } | { status: 'invalid', reason }
export function normalizeTx(chain, tx) {
  tx = (tx || '').trim()
  // accept full explorer links too
  const m = tx.match(/(0x)?[0-9a-fA-F]{64}/)
  if (!m) return null
  const hex = m[0].replace(/^0x/, '').toLowerCase()
  return chain === 'bep20' ? '0x' + hex : hex
}

async function rpc(urls, method, params) {
  let lastErr
  for (const url of urls) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      const j = await r.json()
      if (j.error) throw new Error(j.error.message)
      return j.result
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('BSC node unreachable')
}

export async function verifyBep20({ tx, to, minConf = 3, rpcs = DEFAULT_BSC_RPCS }) {
  const receipt = await rpc(rpcs, 'eth_getTransactionReceipt', [tx])
  if (!receipt) return { status: 'pending', reason: 'Transaction not found yet. It may still be processing.' }
  if (receipt.status !== '0x1') return { status: 'invalid', reason: 'This transaction failed on the blockchain.' }
  const want = '0x' + to.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  let raw = 0n
  for (const log of receipt.logs || []) {
    if (log.address?.toLowerCase() === USDT_BEP20 && log.topics?.[0] === TRANSFER_TOPIC && log.topics?.[2]?.toLowerCase() === want) raw += BigInt(log.data)
  }
  if (raw === 0n) return { status: 'invalid', reason: 'No USDT (BEP20) was sent to our wallet in this transaction.' }
  const head = BigInt(await rpc(rpcs, 'eth_blockNumber', []))
  const conf = Number(head - BigInt(receipt.blockNumber)) + 1
  const amount = Number(raw / 10n ** 12n) / 1e6 // 18 → 6 decimals precision
  if (conf < minConf) return { status: 'pending', reason: `Waiting for confirmations (${conf}/${minConf}).`, amount }
  return { status: 'ok', amount }
}

export async function verifyTrc20({ tx, to, apiKey = '' }) {
  const headers = apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {}
  const url = `https://api.trongrid.io/v1/accounts/${to}/transactions/trc20?only_to=true&only_confirmed=true&limit=200&contract_address=${USDT_TRC20}`
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error('TronGrid error ' + r.status)
  const j = await r.json()
  const hits = (j.data || []).filter((t) => t.transaction_id?.toLowerCase() === tx && t.to === to && t.token_info?.address === USDT_TRC20)
  if (!hits.length) return { status: 'pending', reason: 'Transfer not confirmed yet, or it was not sent to our TRC20 wallet.' }
  const amount = hits.reduce((a, t) => a + Number(t.value) / 10 ** (t.token_info.decimals ?? 6), 0)
  return { status: 'ok', amount: Math.floor(amount * 1e6) / 1e6 }
}

export async function verifyDeposit({ chain, tx, to, settings }) {
  if (chain === 'bep20') {
    const rpcs = (settings.bscRpc || '').split(/[\s,]+/).filter(Boolean)
    return verifyBep20({ tx, to, minConf: settings.minConfirmations || 3, rpcs: rpcs.length ? rpcs : DEFAULT_BSC_RPCS })
  }
  if (chain === 'trc20') return verifyTrc20({ tx, to, apiKey: settings.tronApiKey || '' })
  return { status: 'manual' }
}
