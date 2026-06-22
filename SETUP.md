# Kalalokam by Sri — backend setup guide

This turns the static demo site into a real app: products, carts, and
orders are stored in a database, and visitors sign in with their own
Google account (Google handles the password — your server never sees it).

Follow these steps in order.

---

## 1. Install Node.js (if you don't have it)

Download from https://nodejs.org (the LTS version). Check it worked:

```
node -v
npm -v
```

## 2. Install the project dependencies

Open a terminal in this folder (`kalalokam-backend`) and run:

```
npm install
```

This downloads Express, the SQLite library, and Google's official
token-verification library.

## 3. Get a Google Client ID (free, takes about 5 minutes)

This is the one piece only you can create, because it's tied to your own
Google account.

1. Go to https://console.cloud.google.com/
2. Create a new project (top-left project dropdown → "New project"). Name it
   something like "Kalalokam".
3. In the left sidebar go to **APIs & Services → OAuth consent screen**.
   - User type: **External**
   - App name: `Kalalokam by Sri`
   - User support email: your email
   - Developer contact email: your email
   - Save through the remaining steps (you can leave scopes/test users at
     defaults for now).
4. Go to **APIs & Services → Credentials**.
   - Click **+ Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Kalalokam web`
   - Under **Authorized JavaScript origins**, add the address you'll run the
     site on, for example:
     - `http://localhost:4000` (for testing on your own machine)
     - `https://yourdomain.com` (once you have a real domain)
   - Click **Create**
5. Copy the **Client ID** shown (it ends in `.apps.googleusercontent.com`).
   You do not need the "Client secret" for this setup.

## 4. Add your Client ID to the project

You need to put the same Client ID in **two places**:

**a) Backend — create your `.env` file:**

```
cp .env.example .env
```

Then open `.env` and paste your Client ID:

```
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
SESSION_SECRET=some-long-random-string
PORT=4000
```

Generate a random session secret with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**b) Frontend — edit `public/index.html`:**

Find this line near the top of the file (around line 11):

```html
<meta name="google-signin-client_id" content="GOOGLE_CLIENT_ID_PLACEHOLDER">
```

Replace `GOOGLE_CLIENT_ID_PLACEHOLDER` with your real Client ID, so it
matches what's in `.env`.

## 5. Run it

```
npm start
```

You should see:

```
Kalalokam backend running at http://localhost:4000
```

Open `http://localhost:4000` in your browser. The "Sign in" button now
shows Google's real account picker. Anyone who signs in only ever sees
their own Google accounts — that part is controlled entirely by Google,
not by this site.

---

## What's stored where

Everything lives in one file: `db/kalalokam.sqlite` (created automatically
on first run). It contains:

- `users` — name, email, profile photo, and Google's account ID (never a password)
- `products` — the 20 sample products
- `cart_items` — each signed-in user's saved cart
- `orders` / `order_items` — placed orders, kept as a permanent record

To inspect the database directly, you can use any SQLite viewer (e.g. the
free "DB Browser for SQLite" app) and open `db/kalalokam.sqlite`.

## Going live (putting this on the internet)

When you're ready to host this somewhere real (not just your own
computer):

1. Deploy the whole `kalalokam-backend` folder to a Node-friendly host
   (Render, Railway, Fly.io, a VPS, etc.).
2. Add `https://your-real-domain.com` as an additional **Authorized
   JavaScript origin** in the same Google Cloud credential from step 3.
3. Set the same `GOOGLE_CLIENT_ID` and a fresh `SESSION_SECRET` as
   environment variables on the host (don't upload your `.env` file
   directly to a public git repo).
4. Set `NODE_ENV=production` and make sure your host serves the site over
   `https://` — Google Sign-In requires a secure origin in production
   (localhost is allowed unencrypted for testing only).

## Troubleshooting

- **"Google sign-in isn't configured yet" message in the sign-in popup** —
  you haven't replaced `GOOGLE_CLIENT_ID_PLACEHOLDER` in `public/index.html`.
- **Google button doesn't appear at all** — check the browser console;
  usually means the Client ID has a typo, or the origin you're visiting
  from (e.g. `http://127.0.0.1` vs `http://localhost`) isn't in your
  Authorized JavaScript origins list. Add both if unsure.
- **"redirect_uri_mismatch" or similar Google error** — double check the
  exact origin (protocol + domain + port) is listed under Authorized
  JavaScript origins in Google Cloud Console.

## Phone number verification — what's real and what isn't yet

The profile page lets a visitor enter a phone number and verifies it with
a one-time 6-digit code, the same pattern most apps use. The code
generation, expiry (5 minutes), and verification logic in `server.js` are
fully real and working.

**What's missing:** actually sending that code by SMS. There's no SMS
provider connected — that requires your own account with a service like
Twilio, MSG91, or AWS SNS, plus an API key from them, which only you can
set up. Until you add one, the backend returns the code directly in its
response (clearly labeled `dev_only_code`) so you can test the whole flow
without real SMS. The frontend shows it in the verification box for the
same reason.

To wire in real SMS once you have a provider:

1. Sign up with an SMS provider and get an API key.
2. In `server.js`, find the comment `// TODO: replace this block with a
   real SMS provider call` inside the `/api/profile/phone/send-otp` route.
3. Replace the `console.log(...)` line with your provider's send call
   (each provider's docs show the exact code — usually 3–4 lines).
4. Remove `dev_only_code` from that route's response once SMS is live, so
   the code is never exposed to the browser.
