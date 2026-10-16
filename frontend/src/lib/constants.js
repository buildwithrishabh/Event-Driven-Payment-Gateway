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
  CREATED: { label: "Created", className: "border-ink-200/80 bg-ink-100 text-ink-600" },
  PROCESSING: { label: "Processing", className: "border-amber-200/70 bg-amber-50 text-amber-700" },
  SUCCEEDED: { label: "Succeeded", className: "border-emerald-200/70 bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Failed", className: "border-rose-200/70 bg-rose-50 text-rose-700" },
  CANCELLED: { label: "Cancelled", className: "border-ink-200 bg-ink-100 text-ink-500" },
};

export const MERCHANT_STATUS_STYLES = {
  ACTIVE: { label: "Active", className: "border-emerald-200/70 bg-emerald-50 text-emerald-700" },
  SUSPENDED: { label: "Suspended", className: "border-rose-200/70 bg-rose-50 text-rose-700" },
};

export const LEDGER_TYPE_STYLES = {
  CREDIT: { label: "Credit", className: "border-emerald-200/70 bg-emerald-50 text-emerald-700" },
  DEBIT: { label: "Debit", className: "border-rose-200/70 bg-rose-50 text-rose-700" },
};

export const WEBHOOK_STATUS_STYLES = {
  PENDING: { label: "Pending", className: "border-amber-200/70 bg-amber-50 text-amber-700" },
  SUCCESS: { label: "Success", className: "border-emerald-200/70 bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Failed", className: "border-rose-200/70 bg-rose-50 text-rose-700" },
};

export function statusStyle(map, status) {
  return map[status] || { label: status || "Unknown", className: "border-ink-200 bg-ink-100 text-ink-600" };
}

/* -------------------------------------------------------------------------- */
/* Currencies offered in the create-payment form                               */
/* -------------------------------------------------------------------------- */
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

/* -------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* -------------------------------------------------------------------------- */
export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: "LayoutDashboard", end: true },
  { to: "/payments", label: "Payments", icon: "CreditCard" },
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
  paymentsList: {
    method: "GET",
    path: "/v1/payments",
    purpose: "Paginated, filterable payment list for the Payments table + Overview.",
  },
  paymentCancel: {
    method: "POST",
    path: "/v1/payments/:id/cancel",
    purpose: "Cancel a payment still in CREATED.",
  },
  paymentRefund: {
    method: "POST",
    path: "/v1/payments/:id/refund",
    purpose: "Initiate a refund and append a DEBIT ledger entry.",
  },
  ledgerEntries: {
    method: "GET",
    path: "/v1/ledger/entries",
    purpose: "Paginated immutable ledger entries (credits/debits) for the Ledger view.",
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
