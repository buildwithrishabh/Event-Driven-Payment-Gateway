# 🖥️ Gateway Console — Frontend

A responsive, professional merchant dashboard for the **Event-Driven Payment Gateway & Ledger Engine**.

Built with **React 18 + Vite + JavaScript + Tailwind CSS**, it talks **only to endpoints that actually exist** in the backend. Every screen that needs an endpoint which has not been built yet shows an honest **"Endpoint not implemented"** state — there is **no mock data and no faked API**.

---

## ✨ Screens

| Route | Screen | Data source |
| :--- | :--- | :--- |
| `/connect` | Connect with API key / register a merchant | `POST /v1/merchants`, `GET /v1/merchants/me` ✅ real |
| `/` | Overview — balance, account + gateway health | `GET /v1/ledger/balance`, `GET /health`, profile ✅ real · charts ⛔ not implemented |
| `/payments` | Create payment (idempotent) + lookup | `POST /v1/payments` ✅ real · list ⛔ not implemented |
| `/payments/:id` | Payment detail | `GET /v1/payments/:id` ✅ real · refunds ⛔ not implemented |
| `/ledger` | Balance breakdown + ledger view | `GET /v1/ledger/balance` ✅ real · entries ⛔ not implemented |
| `/webhooks` | Inbound Razorpay + signed outbound webhooks | docs only · delivery log ⛔ not implemented |
| `/api` | API reference (implemented + planned) | static docs |
| `/settings` | Profile + API key | `GET /v1/merchants/me` ✅ real · edit/rotate ⛔ not implemented |

> ⛔ screens render the `NotImplemented` component and carry a matching **TODO comment** in the backend route file.

---

## 🔐 How authentication works

The backend has **no login / JWT / session endpoints** — it authenticates every request with the `x-api-key` header.

So the console:

1. Accepts your merchant API key on the **Connect** screen (or registers a new merchant and shows the key once).
2. Validates it by calling `GET /v1/merchants/me`.
3. Stores it in `localStorage` and sends it as `x-api-key` on every request.

Nothing else is stored. **Disconnect** simply removes the key from the browser.

---

## 🚀 Getting started

```bash
cd frontend
npm install
cp .env.example .env     # then edit if your backend isn't on localhost:3000
npm run dev
```

Open http://localhost:5173.

### Environment

| Variable | Default | Notes |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend origin, **no trailing slash**, do **not** include `/v1`. |

The backend enables `cors()` for all origins, so the dev server can call it directly.

> ⚠️ **Path contains `&`?** If `npm run dev` misbehaves because the project folder name contains an ampersand (`Payment Gateway & Ledger Engine`), run Vite directly instead:
> ```bash
> node "node_modules/vite/bin/vite.js" dev
> node "node_modules/vite/bin/vite.js" build
> ```

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
    ├── App.jsx                  # routes
    ├── index.css                # Tailwind + component classes
    ├── lib/
    │   ├── api.js               # fetch wrapper + real endpoint functions ONLY
    │   ├── format.js            # money (minor units), dates, secrets
    │   └── constants.js         # status styles, nav, IMPLEMENTED/PLANNED endpoints
    ├── context/
    │   ├── AuthContext.jsx      # x-api-key session (localStorage + /merchants/me)
    │   └── ToastContext.jsx     # notifications
    ├── hooks/
    │   ├── useFetch.js          # single-resource data loading
    │   └── useHealth.js         # polls GET /health
    ├── components/
    │   ├── layout/              # AppShell, Sidebar, Topbar, ProtectedRoute
    │   └── ui/                  # Button, Card, Input, Select, Badge, NotImplemented, …
    └── pages/                   # Connect, Dashboard, Payments, PaymentDetail,
                                 # Ledger, Webhooks, ApiReference, Settings, NotFound
```

---

## 💰 Money is stored in minor units

The backend stores every amount as an **integer in minor units** (e.g. `2500` = ₹25.00). The UI converts on the way in (`toMinorUnits`) and out (`formatMoney`), so users always type and see major units.

---

## 🧭 The `NotImplemented` pattern

Screens waiting on a missing endpoint render `components/ui/NotImplemented.jsx`, which shows:

- the proposed **method + path**,
- why the screen needs it,
- a **Backend TODO** note.

This is the single source of truth for "what to build next".

---

## 🛠️ Backend endpoints the console still needs

These are **not implemented** — each has a descriptive TODO comment in the backend route file. Build them, then replace the `NotImplemented` state with a real call in `src/lib/api.js`.

| Endpoint | Needed by | Backend TODO location |
| :--- | :--- | :--- |
| `GET /v1/payments` | Payments table, Overview | `backend/src/modules/payments/payment.routes.js` |
| `POST /v1/payments/:id/cancel` | Payment actions | `backend/src/modules/payments/payment.routes.js` |
| `POST /v1/payments/:id/refund` | Payment detail | `backend/src/modules/payments/payment.routes.js` |
| `GET /v1/ledger/entries` | Ledger view | `backend/src/modules/ledger/ledger.routes.js` |
| `GET /v1/ledger/balances` | Multi-currency balance | `backend/src/modules/ledger/ledger.routes.js` |
| `GET /v1/ledger/statement` | CSV/PDF export | `backend/src/modules/ledger/ledger.routes.js` |
| `GET /v1/webhooks/deliveries` | Delivery log | `backend/src/modules/webhooks/webhook.routes.js` |
| `POST /v1/webhooks/deliveries/:id/retry` | Manual retry | `backend/src/modules/webhooks/webhook.routes.js` |
| `PATCH /v1/merchants/me` | Settings edit | `backend/src/modules/merchants/merchant.routes.js` |
| `POST /v1/merchants/me/rotate-keys` | Settings rotate | `backend/src/modules/merchants/merchant.routes.js` |
| `GET /v1/analytics/overview` | Overview charts | `backend/src/app.js` |

### Wiring a newly-built endpoint

1. Add a function to `src/lib/api.js` (follow the existing style).
2. Call it from the page — usually via `useFetch` for reads.
3. Remove the `NotImplemented` block and its entry from `PLANNED_ENDPOINTS` in `src/lib/constants.js`.

---

## 🧾 Scripts

```bash
npm run dev       # start dev server (http://localhost:5173)
npm run build     # production build → dist/
npm run preview   # preview the production build
```
