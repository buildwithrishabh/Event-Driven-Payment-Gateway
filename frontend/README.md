# 🖥️ Gateway Console — Frontend

A responsive, professional merchant dashboard and customer checkout experience for the **Event-Driven Payment Gateway & Ledger Engine**.

Built with **React 18 + Vite + JavaScript + Tailwind CSS**, it communicates with real backend endpoints for payment ingestion, status tracking, double-entry ledger audits, and customer checkout.

---

## ✨ Screens

| Route | Screen | Data source | Status |
| :--- | :--- | :--- | :--- |
| `/connect` | Connect with API key / register a merchant | `POST /v1/merchants`, `GET /v1/merchants/me` | ✅ Real API |
| `/` | Overview — balance, account + gateway health | `GET /v1/ledger/balance`, `GET /health`, profile | ✅ Real API |
| `/payments` | Create payment (idempotent) + list history + lookup | `POST /v1/payments`, `GET /v1/payments` | ✅ Real API |
| `/payments/:id` | Payment detail & status inspect | `GET /v1/payments/:id` | ✅ Real API |
| `/checkout/:id` | Customer checkout portal (UPI, Card, Simulation) | `GET /v1/checkout/:id`, `POST /v1/checkout/*` | ✅ Real API |
| `/ledger` | Balance breakdown + immutable entries audit journal | `GET /v1/ledger/balance`, `GET /v1/ledger/entries` | ✅ Real API |
| `/webhooks` | Inbound Razorpay + signed outbound webhooks | Documentation guide | ✅ Static Guide |
| `/api` | API reference (implemented + planned endpoints) | Reference specs | ✅ Static Guide |
| `/settings` | Profile & API credentials | `GET /v1/merchants/me` | ✅ Real API |

---

## 🔐 How authentication works

The backend authenticates merchant requests using the **`x-api-key`** header (SHA-256 hashed and cached in Redis).

The console:
1. Accepts your merchant API key on the **Connect** screen (or registers a new merchant and displays the generated key once).
2. Validates it by calling `GET /v1/merchants/me`.
3. Stores it securely in `localStorage` and injects it as `x-api-key` on protected calls.
4. Customer checkout routes (`/checkout/:id`) are **public** and do not require merchant credentials.

---

## 🚀 Getting started

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_BASE_URL defaults to http://localhost:3000
npm run dev
```

Open `http://localhost:5173`.

### Environment

| Variable | Default | Notes |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend origin, **no trailing slash**, do **not** include `/v1`. |

---

## 🧱 Project structure

```text
frontend/
├── index.html
├── tailwind.config.js
├── vite.config.js
├── .env.example
└── src/
    ├── main.jsx                 # providers: Router, Toast, Auth
    ├── App.jsx                  # routing & layout bindings
    ├── index.css                # Tailwind CSS tokens & base styles
    ├── lib/
    │   ├── api.js               # fetch wrapper + real endpoint functions
    │   ├── format.js            # minor unit converters, dates, currency
    │   └── constants.js         # status styles, nav items, endpoint lists
    ├── context/
    │   ├── AuthContext.jsx      # x-api-key session (localStorage + /merchants/me)
    │   └── ToastContext.jsx     # system notifications
    ├── hooks/
    │   ├── useFetch.js          # reactive resource data loading
    │   └── useHealth.js         # polls GET /health
    ├── components/
    │   ├── layout/              # AppShell, Sidebar, Topbar, ProtectedRoute
    │   └── ui/                  # Button, Card, Input, Select, Badge, NotImplemented...
    └── pages/                   # Dashboard, Payments, PaymentDetail, Checkout,
                                 # Ledger, Webhooks, ApiReference, Settings
```

---

## 💰 Money is stored in minor units

The backend stores every amount as an **integer in minor units** (e.g. `2500` = ₹25.00). The UI converts automatically on input (`toMinorUnits`) and output (`formatMoney`), so merchants and customers interact in standard decimal units.

---

## 🧾 Scripts

```bash
npm run dev       # start dev server (http://localhost:5173)
npm run build     # production build → dist/
npm run preview   # preview production build
```
