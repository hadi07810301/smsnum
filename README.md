# 📱 SMSNum — Virtual Numbers for SMS Verification

A React website for selling temporary phone numbers that receive SMS verification codes, with a user dashboard and a full admin panel.

**Live demo:** https://hadi07810301.github.io/smsnum/

## Logins

| Role | Where | Username / Email | Password |
|------|-------|------------------|----------|
| Admin | `/#/admin` | `admin` | `admin` |
| Demo user | `/#/login` | `demo@smsnum.com` | `demo123` |

> Change the admin password in **Admin → Settings → Admin login** before sharing the site.

## Features

**Website**
- Home page, Buy Numbers (country filter + search), Pricing table, API docs, Terms, Privacy
- Sign up / log in, referral links (`#/register?ref=CODE`)
- Dark mode, mobile bottom navigation

**User dashboard**
- Overview: balance, orders, active numbers, referrals, low-balance warning
- Active numbers with live countdown, copy number / code, extend (+15 min at 50% price), cancel with refund
- Order management, SMS history, transactions
- Recharge requests (USDT, Binance Pay, bKash, Nagad), balance transfer to other users
- Referral earnings, API key, support tickets, profile

**Admin panel** (`/#/admin`, login `admin` / `admin`)
- Overview stats + 7-day orders chart + top services
- Users: search, add/deduct balance, ban/unban, delete
- Orders: filter, cancel (with refund)
- Recharges: approve (adds balance + referral bonus) or reject
- Services & countries: add, edit prices/multipliers/stock, enable/disable, delete
- SMS center, support tickets (reply/close), all transactions
- Settings: site name, announcement bar, minimum recharge, referral %, number timers, payment method details, admin login, reset data

## Important: this is a frontend demo

All data is stored in the browser (`localStorage`), and incoming SMS codes are **simulated** (a fake code arrives 8–25 seconds after buying). This makes the site fully clickable on GitHub Pages without a server.

To run it as a real business you need to:
1. Build a backend (e.g. Node.js/Express or Laravel + a database) with real user accounts and secure admin login.
2. Connect a real SMS number provider's API for buying numbers and receiving messages.
3. Connect real payment verification.

All data logic lives in `src/store.js`, so you only need to replace those functions with API calls.

## Run locally

```bash
npm install
npm run dev      # development server
npm run build    # production build in /dist
```

## Project structure

```
src/
  App.jsx          layout, header, footer, routes
  router.jsx       small hash router (works on GitHub Pages)
  store.js         data + all business logic (replace with API calls)
  ui.jsx           toasts, modal, badges, helpers
  styles.css       all styles (light + dark theme)
  pages/
    Home.jsx  Buy.jsx  Pricing.jsx  Auth.jsx  Legal.jsx
    Dashboard.jsx  Admin.jsx
```
