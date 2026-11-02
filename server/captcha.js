// Simple image captcha (letters + numbers) drawn as SVG blocks from a tiny pixel font.
// No fonts or packages needed. Answers live in memory for 10 minutes and work once.
import crypto from 'node:crypto'

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O, 1/I/L
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'], K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'], W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'], Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'], 2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], 4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'], 6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], 8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}
const store = new Map() // id -> { answer, exp }
const rnd = (a, b) => a + Math.random() * (b - a)

export function newCaptcha() {
  const answer = Array.from({ length: 4 }, () => CHARS[crypto.randomInt(CHARS.length)]).join('')
  const id = crypto.randomBytes(12).toString('hex')
  store.set(id, { answer, exp: Date.now() + 10 * 60000 })
  if (store.size > 5000) for (const [k, v] of store) if (v.exp < Date.now()) store.delete(k)
  const W = 150, H = 48, px = 4
  let shapes = ''
  ;[...answer].forEach((ch, i) => {
    const x0 = 14 + i * 33 + rnd(-2, 2), y0 = 10 + rnd(-3, 3), rot = rnd(-12, 12)
    const hue = Math.round(rnd(150, 230))
    let cells = ''
    FONT[ch].forEach((row, r) => [...row].forEach((bit, c) => { if (bit === '1') cells += `<rect x="${c * px}" y="${r * px}" width="${px}" height="${px}" rx="1"/>` }))
    shapes += `<g transform="translate(${x0.toFixed(1)} ${y0.toFixed(1)}) rotate(${rot.toFixed(1)} 10 14)" fill="hsl(${hue} 55% 30%)">${cells}</g>`
  })
  let noise = ''
  for (let i = 0; i < 3; i++) noise += `<path d="M${rnd(0, 30).toFixed(0)} ${rnd(5, 43).toFixed(0)} Q ${rnd(40, 110).toFixed(0)} ${rnd(0, 48).toFixed(0)} ${rnd(120, 150).toFixed(0)} ${rnd(5, 43).toFixed(0)}" stroke="hsl(${Math.round(rnd(0, 360))} 45% 50% / .5)" stroke-width="1.5" fill="none"/>`
  for (let i = 0; i < 18; i++) noise += `<circle cx="${rnd(0, W).toFixed(0)}" cy="${rnd(0, H).toFixed(0)}" r="1" fill="#0004"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#eef2f0"/>${shapes}${noise}</svg>`
  return { id, svg }
}

// true if the answer is right; each captcha can be used once
export function checkCaptcha(id, answer) {
  if (process.env.SMSNUM_TEST_CAPTCHA === '1' && answer === 'TEST') return true // automated tests only
  const c = store.get(String(id || ''))
  store.delete(String(id || ''))
  return !!c && c.exp > Date.now() && String(answer || '').trim().toUpperCase() === c.answer
}
