# Put SMSNum online with cPanel

You need: cPanel hosting with **"Setup Node.js App"** (most hosts with CloudLinux have it) and a domain.
No database and no `npm install` are needed.

## 1. Upload the files

1. Log in to **cPanel → File Manager**.
2. Open your home folder (e.g. `/home/yourname`) — **not** `public_html`.
3. Click **Upload** and upload `smsnum-server.zip`.
4. Right-click the zip → **Extract**. You now have a folder `smsnum` containing `app.cjs`, `server`, `src`, `dist` …

## 2. Create the Node.js app

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Fill in:
   - **Node.js version:** 20 or 22 (anything 18.17 or newer works)
   - **Application mode:** Production
   - **Application root:** `smsnum`
   - **Application URL:** your domain (e.g. `smsnum.com`)
   - **Application startup file:** `app.cjs`
3. Click **Create**, then **Start App** (or **Restart**).

> You do **not** need to click "Run NPM Install". The server uses only Node's built-in tools.

## 3. First login

1. Open `https://yourdomain.com` — the site should load.
2. Go to `https://yourdomain.com/#/admin` and log in with **admin / admin**.
3. **Immediately** go to **Settings → Admin login** and set a strong password.
4. In **Settings**, add your Telegram support link, payment details and prices.
5. In **API Providers**, add your number provider and switch Number source to **Live API** when ready.
6. Delete or change the demo account (`demo@smsnum.com`) in **Users**.

## 4. Keep your data safe

- All data is in `smsnum/data/db.json`. A daily copy is saved in `smsnum/data/backups/` (last 7 days).
- Download `data/db.json` regularly (File Manager → right-click → Download).
- Make sure `data` is **not** inside `public_html`, so nobody can download it from the web.

## 5. Updating to a new version

1. Upload the new zip and extract it **over** the old folder (your `data` folder is not in the zip, so it stays).
2. cPanel → Setup Node.js App → **Restart**.
3. Press **Ctrl + Shift + R** in your browser.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Website files not found" | The `dist` folder is missing — re-extract the zip. |
| Site shows "Can't reach the server" | The app is stopped: Setup Node.js App → Start/Restart. Check the log file shown on that page. |
| Error about `import` / ES modules | Choose Node.js 18.17 or newer and make sure the startup file is `app.cjs`. |
| Forgot admin password | Stop the app, open `data/db.json`, delete the `"adminPassHash"` and `"adminPassSalt"` entries, save, then start the app: the login becomes `admin` / `admin` again. |

## Run on your own computer instead

Install Node.js from https://nodejs.org, open a terminal in the `smsnum` folder and run:

```
node app.cjs
```

Then open http://localhost:3000
