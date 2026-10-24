/**
 * Shared UI constants + a single source of truth for status colouring and
 * the "not implemented yet" endpoints referenced across the app.
 */

/* -------------------------------------------------------------------------- */
/* Payment statuses (mirrors backend enum)                                     */
/* -------------------------------------------------------------------------- */
export const PAYMENT_STATUS = {
  CREATED: "CREATED",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

export const PAYMENT_STATUS_STYLES = {
  CREATED: { label: "Created", className: "border-[#26282E] bg-[#16171A] text-zinc-300" },
  PROCESSING: { label: "Processing", className: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
  SUCCEEDED: { label: "Succeeded", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  FAILED: { label: "Failed", className: "border-rose-500/20 bg-rose-500/10 text-rose-400" },
  CANCELLED: { label: "Cancelled", className: "border-[#26282E] bg-[#16171A] text-zinc-400" },
};

/* -------------------------------------------------------------------------- */
/* Refund statuses (mirrors backend Refund model enum)                        */
/* -------------------------------------------------------------------------- */
export const REFUND_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
};

export const REFUND_STATUS_STYLES = {
  PENDING: { label: "Pending", className: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
  PROCESSING: { label: "Processing", className: "border-sky-500/20 bg-sky-500/10 text-sky-400" },
  SUCCEEDED: { label: "Succeeded", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  FAILED: { label: "Failed", className: "border-rose-500/20 bg-rose-500/10 text-rose-400" },
};

export const PAYMENT_REFUND_STATUS_STYLES = {
  NONE: { label: "Not Refunded", className: "border-[#26282E] bg-[#16171A] text-zinc-300" },
  PARTIAL: { label: "Partially Refunded", className: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
  FULL: { label: "Fully Refunded", className: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400" },
};

export const MERCHANT_STATUS_STYLES = {
  ACTIVE: { label: "Active", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  SUSPENDED: { label: "Suspended", className: "border-rose-500/20 bg-rose-500/10 text-rose-400" },
};

export const LEDGER_TYPE_STYLES = {
  CREDIT: { label: "Credit", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  DEBIT: { label: "Debit", className: "border-rose-500/20 bg-rose-500/10 text-rose-400" },
};

export const WEBHOOK_STATUS_STYLES = {
  PENDING: { label: "Pending", className: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
  SUCCESS: { label: "Success", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  FAILED: { label: "Failed", className: "border-rose-500/20 bg-rose-500/10 text-rose-400" },
};

export function statusStyle(map, status) {
  return map[status] || { label: status || "Unknown", className: "border-[#26282E] bg-[#16171A] text-zinc-300" };
}

/* -------------------------------------------------------------------------- */
/* Currencies offered in the create-payment form (Domestic INR only)           */
/* -------------------------------------------------------------------------- */
export const CURRENCIES = ["INR"];

/* -------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* -------------------------------------------------------------------------- */
export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: "LayoutDashboard", end: true },
  { to: "/payments", label: "Payments", icon: "CreditCard" },
  { to: "/refunds", label: "Refunds", icon: "RotateCcw" },
  { to: "/ledger", label: "Ledger", icon: "BookText" },
  { to: "/webhooks", label: "Webhooks", icon: "Webhook" },
  { to: "/api", label: "API Reference", icon: "Code2" },
  { to: "/settings", label: "Settings", icon: "Settings" },
];

/* -------------------------------------------------------------------------- */
/* Every endpoint actually shipped by the backend, for the API reference page. */
/* -------------------------------------------------------------------------- */
export const IMPLEMENTED_ENDPOINTS = [
  {
    method: "GET",
    path: "/health",
    auth: "Public",
    summary: "Check API and payment-processing service status.",
    sample: "curl http://localhost:3000/health",
  },
  {
    method: "POST",
    path: "/v1/merchants",
    auth: "Public",
    summary: "Create a merchant account. The API key and webhook secret are returned once.",
    sample: `curl -X POST http://localhost:3000/v1/merchants \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Nova Store","email":"dev@novastore.io","webhookUrl":"https://webhook.site/test"}'`,
  },
  {
    method: "GET",
    path: "/v1/merchants/me",
    auth: "x-api-key",
    summary: "Get the authenticated merchant profile.",
    sample: `curl http://localhost:3000/v1/merchants/me \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "POST",
    path: "/v1/payments",
    auth: "x-api-key + Idempotency-Key",
    summary: "Create a payment. Include an idempotency key to safely retry the same request.",
    sample: `curl -X POST http://localhost:3000/v1/payments \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "Idempotency-Key: order_checkout_101" \\
  -d '{"amount":2500,"currency":"INR","customerEmail":"buyer@example.com"}'`,
  },
  {
    method: "GET",
    path: "/v1/payments",
    auth: "x-api-key",
    summary: "List transactions for the authenticated merchant with optional filters and pagination.",
    sample: `curl "http://localhost:3000/v1/payments?limit=20&page=1" \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "GET",
    path: "/v1/payments/:id",
    auth: "x-api-key",
    summary: "Get a payment by ID for the authenticated merchant.",
    sample: `curl http://localhost:3000/v1/payments/<PAYMENT_ID> \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "GET",
    path: "/v1/ledger/balance",
    auth: "x-api-key",
    summary: "Get the available balance, credits, and debits.",
    sample: `curl http://localhost:3000/v1/ledger/balance \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "GET",
    path: "/v1/ledger/entries",
    auth: "x-api-key",
    summary: "List immutable double-entry journal records (credits and debits).",
    sample: `curl "http://localhost:3000/v1/ledger/entries?limit=20&page=1" \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "POST",
    path: "/v1/refunds",
    auth: "x-api-key + Idempotency-Key",
    summary: "Initiate a partial or full refund for a succeeded payment. Asynchronously processed via BullMQ.",
    sample: `curl -X POST http://localhost:3000/v1/refunds \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "Idempotency-Key: refund_req_101" \\
  -d '{"paymentId":"<PAYMENT_ID>","amount":1000,"reason":"requested_by_customer"}'`,
  },
  {
    method: "GET",
    path: "/v1/refunds/:id",
    auth: "x-api-key",
    summary: "Get single refund status and details by refund ID.",
    sample: `curl http://localhost:3000/v1/refunds/<REFUND_ID> \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "GET",
    path: "/v1/refunds/payment/:paymentId",
    auth: "x-api-key",
    summary: "Get all refund attempts and statuses for a specific payment ID.",
    sample: `curl http://localhost:3000/v1/refunds/payment/<PAYMENT_ID> \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "GET",
    path: "/v1/refunds",
    auth: "x-api-key",
    summary: "List all merchant refunds with pagination, status filtering, and search.",
    sample: `curl "http://localhost:3000/v1/refunds?limit=20&page=1" \\
  -H "x-api-key: <YOUR_API_KEY>"`,
  },
  {
    method: "POST",
    path: "/v1/webhooks/razorpay",
    auth: "Razorpay HMAC signature",
    summary: "Receive Razorpay payment events. This endpoint is called by Razorpay, not the browser.",
    sample: `# Configured in the Razorpay dashboard; not called from the browser.`,
  },
];

/* -------------------------------------------------------------------------- */
/* Endpoints the UI would LIKE to call but which do NOT exist yet.             */
/* Keep these in sync with the TODO comments added to the backend routes.       */
/* -------------------------------------------------------------------------- */
export const PLANNED_ENDPOINTS = {
  paymentCancel: {
    method: "POST",
    path: "/v1/payments/:id/cancel",
    purpose: "Cancel a payment still in CREATED.",
  },
  ledgerBalances: {
    method: "GET",
    path: "/v1/ledger/balances",
    purpose: "All currency balances instead of only the first currency group.",
  },
  dashboardStats: {
    method: "GET",
    path: "/v1/analytics/overview",
    purpose: "Volume, success/failure rates, counts and time-series for Overview charts.",
  },
  webhookDeliveries: {
    method: "GET",
    path: "/v1/webhooks/deliveries",
    purpose: "Webhook delivery attempts + response codes for the Webhooks log.",
  },
  webhookRetry: {
    method: "POST",
    path: "/v1/webhooks/deliveries/:id/retry",
    purpose: "Manually re-send a failed merchant webhook.",
  },
  merchantUpdate: {
    method: "PATCH",
    path: "/v1/merchants/me",
    purpose: "Update name / email / webhookUrl from the Settings screen.",
  },
  merchantRotateKeys: {
    method: "POST",
    path: "/v1/merchants/me/rotate-keys",
    purpose: "Regenerate the API key and/or webhook secret.",
  },
};
