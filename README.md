# Kalalokam by Sri

A handmade art and crafts storefront with a real backend: Google sign-in,
a database-backed cart, and order placement.

## Start here

Read **SETUP.md** — it walks through installing dependencies, creating
your free Google Client ID, and running the site locally, step by step.

## Project structure

```
kalalokam-backend/
├── server.js          backend: Google auth, products, cart, orders (Express)
├── db/
│   ├── init.js        creates tables and seeds the 20 sample products
│   └── kalalokam.sqlite   the database file (created automatically on first run)
├── public/
│   └── index.html     the website itself (served by the backend)
├── .env.example        template for your environment variables
├── package.json
└── SETUP.md            full setup instructions — start here
```

## Quick start (after reading SETUP.md once)

```
npm install
cp .env.example .env       # then fill in your Google Client ID
npm start
```

Then open http://localhost:4000
