# 📱 SMSNum — Virtual Numbers for SMS Verification

A complete SMS-verification number website: React frontend + a small Node.js server that stores all data,
handles logins, talks to your SMS number provider and verifies crypto payments.

**Runs on any cPanel hosting with "Setup Node.js App" (Node 18+). No database and no `npm install` needed.**
See **[CPANEL-SETUP.md](CPANEL-SETUP.md)** for step-by-step hosting instructions.

## Logins

| Role | Where | Username / Email | Password |
|------|-------|------------------|----------|
| Admin | `yoursite.com/#/admin` | `admin` | `admin` |
| Demo user | `yoursite.com/#/login` | `demo@smsnum.com` | `demo123` |

> ⚠️ Change the admin password in **Admin → Settings → Admin login** right after you go live.

## Features

**Website**
- Home page, Buy Numbers (country filter + search), **Rent Numbers** (1–90 day rentals), API docs, Terms, Privacy
- Sign up / log in, referral links (`#/register?ref=CODE`)
- **Multiple accounts**: sign in to up to 5 accounts and switch from the avatar menu; each browser tab can use a different account at the same time
- Dark mode, mobile bottom navigation

**Buying numbers**
- Pick a custom **area code** (US/Canada lists editable per country, +20% surcharge editable), **quantity** (up to 10, editable) and **number period** (20 minutes up to 90 days) with a live total

**Accounts & security**
- Captcha (letters + numbers) on sign-up and login; confirm password on sign-up
- One account per email (case, spaces, and Gmail dots/+tags count as the same email)
- Change password requires the current password
- Logged-in devices list (device, country, IP, last active) with "Log out" / "Log out all others"
- Suspended accounts are signed out everywhere and can't log in
- Sound + on-screen alerts when a code arrives, before a number expires (2 min one-time / 1 hour rental) and when it expires

**User dashboard**
- Overview: balance, orders, active numbers, referrals, low-balance warning
- Active numbers with live countdown, copy number / code, cancel with refund
- **Resend code**: get a new code on the same number for 50% of the buying price (percentage and per-service price editable by admin). If no new code arrives, only the resend price is refunded
- **Extend / rent numbers**: +15 min, 1, 7, 30 or 90 days (from active cards or the orders table). Plans and prices are set in Admin → Settings → Number extension plans
- Order management, SMS history, transactions
- Recharge requests (USDT BEP20, USDT TRC20, Binance Pay), balance transfer to other users
- Referral earnings, API key, support tickets, profile

**Admin panel** (`/#/admin`, login `admin` / `admin`)
- Users by country chart (IP detected at sign-up/login), user country/IP/devices, suspend/reactivate
- 24-hour notice bar for all users; Telegram support link shown on every user's overview
- Per-provider options: allow extending, free resend
- Overview stats + 7-day orders chart + top services
- Users: search, add/deduct balance, ban/unban, delete
- Orders: filter, cancel (with refund)
- Recharges: approve (adds balance + referral bonus) or reject
- Services & countries: add, edit prices/multipliers/stock, enable/disable, delete
- SMS center, support tickets (reply/close), all transactions
- Settings: site name, announcement bar, minimum recharge, referral %, number timers, payment method details, admin login, reset data

## Automatic crypto payments

USDT **BEP20** and **TRC20** recharges are verified on the blockchain automatically (Admin → Settings → Automatic crypto payments):

- The customer pastes the TxID (or explorer link). The site checks it's a successful USDT transfer **to your wallet**, waits for the required confirmations (BEP20), and adds the amount that actually arrived.
- Reused TxIDs are blocked; transfers to another wallet or of another token are rejected.
- Not confirmed yet? It is re-checked every few seconds and credited as soon as it confirms (gives up after 6 hours and waits for admin review).
- Uses free public services: BNB Chain public RPC (`eth_getTransactionReceipt`) and TronGrid. No API keys needed (optional TronGrid key / custom BSC RPC for higher limits).
- **Binance Pay** stays manual (admin approves).

## API providers (real numbers)

Admin → **API Providers** lets you connect a real SMS number provider:

1. **Add API** → pick the type and paste your provider's API link and API key.
   - **SMS-Activate compatible**: the `handler_api.php?api_key=…&action=getNumber` format used by many providers
   - **5SIM**: 5sim.net
   - **Custom JSON API**: any other provider, configured with URL templates and JSON paths
2. **Test & balance** checks the connection and shows your provider balance.
3. Set each service's and country's **API code** (Admin → Services / Countries) to match your provider's code list.
4. Switch **Number source** to **Live API**.

When a customer buys, the site requests a number from the provider, polls every 5 seconds for the code, and cancels/finishes the order at the provider when the customer cancels, finishes, or the number expires without an SMS.

If the test shows "network or CORS blocked", deploy `proxy/worker.js` on Cloudflare Workers (free) and paste its URL into the provider's **Proxy URL**.

The provider API key is stored only on the server and is never sent to browsers (the admin panel shows it masked).
Because the server makes the provider calls, no CORS proxy is needed (`proxy/worker.js` is only for special cases).

## How it works

- **server/index.js** — the Node.js server (no dependencies). It serves the website from `dist/` and the API under `/api/`.
- **data/db.json** — all data (users, orders, balances, settings). Written safely after every change; a daily copy is kept in `data/backups/` (last 7 days). **Back this folder up.**
- Passwords are stored hashed (scrypt). Logins use random tokens per device, so "Logged-in devices" and "Log out" work across phones and PCs.
- Captcha images are made and checked by the server. Login/sign-up attempts are rate-limited per IP.
- Background jobs on the server deliver demo SMS, expire numbers (with refunds), poll your provider for codes and confirm USDT deposits.
- `src/core.js` holds the business rules. The server uses it as the source of truth; the browser uses the same file to show results instantly.

## Run on your computer (localhost)

**Just run it** (needs only Node.js 18+ from https://nodejs.org):

```bash
node app.cjs          # then open http://localhost:3000
```

**Edit the website** (needs `npm install` once, for React + Vite):

```bash
npm install
npm start             # terminal 1: the server on http://localhost:3000
npm run dev           # terminal 2: live-reloading site on http://localhost:5173 (API calls go to the server)
npm run build         # when finished: rebuilds dist/, which the server serves
```

## Deploy

Follow **[CPANEL-SETUP.md](CPANEL-SETUP.md)**. In short: upload the folder, create a Node.js app with startup file `app.cjs`, press Start.

Optional environment variables: `PORT` (set automatically by cPanel), `DATA_DIR` (where db.json lives), `DIST_DIR`,
`ALLOWED_ORIGIN` (only if the website is hosted on a different domain than the server; then also set `window.SMSNUM_API` in index.html).

## Project structure

```
app.cjs              cPanel startup file (starts server/index.js)
server/
  index.js           API, logins, storage, background jobs, static website
  captcha.js         captcha images
src/
  core.js            business rules (shared by server and browser)
  providers.js       SMS provider APIs (SMS-Activate style, 5SIM, custom)
  chain.js           USDT BEP20 / TRC20 deposit checks
  store.js           browser side: talks to the server
  App.jsx  ui.jsx  motion.jsx  router.jsx  styles.css
  pages/             Home, Buy, Rent, Auth, Dashboard, Admin, Legal
dist/                built website (served by the server)
data/                created on first start: db.json + backups (keep private!)
```
