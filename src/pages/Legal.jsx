import { useDB, currentUser } from '../store.js'

export function Terms() {
  const { settings } = useDB()
  return (
    <div className="container section prose">
      <h1>Terms of Service</h1>
      <p>By using {settings.siteName} you agree to these terms.</p>
      <h3>1. Service</h3>
      <p>We provide temporary virtual phone numbers for receiving SMS messages. Numbers are for short-term use and may be reassigned after they expire.</p>
      <h3>2. Acceptable use</h3>
      <p>You must follow the laws of your country and the terms of any third-party platform you use our numbers with. Fraud, spam, harassment and any illegal activity are strictly forbidden and will result in account suspension without refund.</p>
      <h3>3. Payments & refunds</h3>
      <p>Balance is prepaid and non-transferable outside the platform. If a number does not receive an SMS before it expires, its price is refunded to your wallet automatically.</p>
      <h3>4. Liability</h3>
      <p>The service is provided "as is". We are not responsible for third-party platforms blocking virtual numbers.</p>
    </div>
  )
}

export function Privacy() {
  const { settings } = useDB()
  return (
    <div className="container section prose">
      <h1>Privacy Policy</h1>
      <p>{settings.siteName} collects only the information needed to run your account: your name, email, balance and order history.</p>
      <p>SMS messages received on your numbers are shown in your dashboard and stored for your order history. Administrators can view them only to resolve support requests and prevent abuse.</p>
      <p>We never sell your data. You can ask support to delete your account at any time.</p>
    </div>
  )
}

export function ApiDocs() {
  const db = useDB()
  const u = currentUser(db)
  const key = u ? u.apiKey : 'YOUR_API_KEY'
  return (
    <div className="container section prose">
      <h1>API Documentation</h1>
      <p>Use the REST API to buy numbers and read SMS codes from your own software. Authenticate with your API key from the dashboard.</p>
      <p className="note">ℹ️ The public developer API is coming soon. The formats below show how it will work.</p>
      <h3>Get balance</h3>
      <pre>{`GET /api/v1/balance
Authorization: Bearer ${key}

{ "balance": 4.85, "currency": "USD" }`}</pre>
      <h3>Buy a number</h3>
      <pre>{`POST /api/v1/orders
Authorization: Bearer ${key}
{ "service": "whatsapp", "country": "us-v" }

{ "id": "o_ab12cd", "number": "+1 4155550182", "price": 0.15, "status": "waiting", "expires_at": "2026-11-02T10:20:00Z" }`}</pre>
      <h3>Check SMS</h3>
      <pre>{`GET /api/v1/orders/o_ab12cd
Authorization: Bearer ${key}

{ "status": "received", "sms": [{ "code": "482913", "text": "Your WhatsApp code is 482913" }] }`}</pre>
      <h3>Cancel / Extend</h3>
      <pre>{`POST /api/v1/orders/o_ab12cd/cancel
POST /api/v1/orders/o_ab12cd/extend`}</pre>
    </div>
  )
}
