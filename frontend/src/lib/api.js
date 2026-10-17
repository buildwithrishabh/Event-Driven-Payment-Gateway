/**
 * Thin, dependency-free client for the Event-Driven Payment Gateway API.
 *
 * IMPORTANT
 * ---------
 * Only endpoints that exist in the backend are implemented here. Every
 * function below maps to a real route; preview-only routes are listed in the
 * API reference and are never called by the merchant console.
 *
 * Implemented backend routes:
 *   GET  /health                        -> health()
 *   POST /v1/merchants                  -> registerMerchant()
 *   GET  /v1/merchants/me               -> getProfile()
 *   POST /v1/payments                   -> createPayment()
 *   GET  /v1/payments                   -> getPayments()
 *   GET  /v1/payments/:id               -> getPayment()
 *   GET  /v1/ledger/balance             -> getBalance()
 *   GET  /v1/ledger/entries             -> getLedgerEntries()
 *   POST /v1/webhooks/razorpay          -> (server-to-server only, not called by the UI)
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

/** Error type that preserves the HTTP status and the backend `{ error }` message. */
export class ApiError extends Error {
  constructor(message, { status = 0, payload = null, isNetworkError = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Core fetch wrapper.
 * @param {string} path - Path beginning with "/" (include the /v1 prefix where required).
 * @param {object} [options]
 * @param {string} [options.method] - HTTP method, defaults to GET.
 * @param {object} [options.body] - JSON-serializable request body.
 * @param {object} [options.headers] - Extra headers.
 * @param {string} [options.apiKey] - When provided, sent as the x-api-key header.
 * @param {string} [options.idempotencyKey] - When provided, sent as Idempotency-Key.
 */
export async function request(path, options = {}) {
  const { method = "GET", body, headers = {}, apiKey, idempotencyKey } = options;

  const finalHeaders = { Accept: "application/json", ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (apiKey) finalHeaders["x-api-key"] = apiKey;
  if (idempotencyKey) finalHeaders["Idempotency-Key"] = idempotencyKey;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(
      "Cannot reach the gateway API. Is the backend running and is VITE_API_BASE_URL correct?",
      { isNetworkError: true },
    );
  }

  // Some responses (rare) may be empty; parse defensively.
  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && payload.error) ||
      (typeof payload === "string" && payload) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, { status: response.status, payload });
  }

  return {
    data: payload,
    idempotentReplay:
      response.headers.get("x-idempotent-replay") === "true" || false,
  };
}

/* -------------------------------------------------------------------------- */
/* Real endpoints (all currently implemented in the backend)                   */
/* -------------------------------------------------------------------------- */

/** GET /health — liveness probe (unprefixed). */
export function health() {
  return request("/health");
}

/**
 * POST /v1/merchants — register a merchant. Returns the raw apiKey + webhookSecret ONCE.
 * @param {{ name: string, email: string, webhookUrl?: string }} payload
 */
export function registerMerchant(payload) {
  return request("/v1/merchants", { method: "POST", body: payload });
}

/** GET /v1/merchants/me — current merchant profile (requires x-api-key). */
export function getProfile(apiKey) {
  return request("/v1/merchants/me", { apiKey });
}

/**
 * POST /v1/payments — create a payment (requires x-api-key + Idempotency-Key).
 * @param {{ amount: number, currency?: string, customerEmail: string, customerPhone?: string }} payload
 */
export function createPayment(payload, apiKey, idempotencyKey) {
  return request("/v1/payments", {
    method: "POST",
    body: payload,
    apiKey,
    idempotencyKey,
  });
}

/** GET /v1/payments/:id — fetch a single payment by its Mongo ObjectId. */
export function getPayment(id, apiKey) {
  return request(`/v1/payments/${encodeURIComponent(id)}`, { apiKey });
}

/**
 * GET /v1/payments — list payments for the authenticated merchant.
 * @param {string} apiKey
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} [params]
 */
export function getPayments(apiKey, params = {}) {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.set("status", params.status);
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return request(`/v1/payments${query}`, { apiKey });
}

/** GET /v1/ledger/balance — aggregated merchant balance for the first currency group. */
export function getBalance(apiKey) {
  return request("/v1/ledger/balance", { apiKey });
}

/**
 * GET /v1/ledger/entries — list double-entry journal records.
 * @param {string} apiKey
 * @param {{ page?: number, limit?: number }} [params]
 */
export function getLedgerEntries(apiKey, params = {}) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return request(`/v1/ledger/entries${query}`, { apiKey });
}

/* -------------------------------------------------------------------------- */
/* Refund endpoints                                                           */
/* -------------------------------------------------------------------------- */

/**
 * POST /v1/refunds — initiate a refund (requires x-api-key + Idempotency-Key).
 * @param {{ paymentId: string, amount?: number, reason?: string }} payload
 * @param {string} apiKey
 * @param {string} idempotencyKey
 */
export function createRefund(payload, apiKey, idempotencyKey) {
  return request("/v1/refunds", {
    method: "POST",
    body: payload,
    apiKey,
    idempotencyKey,
  });
}

/**
 * GET /v1/refunds/:id — fetch a single refund by ID for the authenticated merchant.
 * @param {string} id
 * @param {string} apiKey
 */
export function getRefund(id, apiKey) {
  return request(`/v1/refunds/${encodeURIComponent(id)}`, { apiKey });
}

/**
 * GET /v1/refunds/payment/:paymentId — fetch all refunds for a specific payment.
 * @param {string} paymentId
 * @param {string} apiKey
 */
export function getPaymentRefunds(paymentId, apiKey) {
  return request(`/v1/refunds/payment/${encodeURIComponent(paymentId)}`, { apiKey });
}

/**
 * GET /v1/refunds — list all refunds for the authenticated merchant.
 * @param {string} apiKey
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} [params]
 */
export function getRefunds(apiKey, params = {}) {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.set("status", params.status);
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return request(`/v1/refunds${query}`, { apiKey });
}

/* -------------------------------------------------------------------------- */
/* Public Checkout Session Endpoints (Customer-Facing / No API Key required)  */
/* -------------------------------------------------------------------------- */

/**
 * GET /v1/checkout/:id — fetch public checkout session data
 * @param {string} id
 */
export async function getCheckoutSession(id) {
  try {
    return await request(`/v1/checkout/${encodeURIComponent(id)}`);
  } catch (err) {
    // Fallback if mounted at /checkout/:id
    if (err.status === 404) {
      try {
        return await request(`/checkout/${encodeURIComponent(id)}`);
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * POST /v1/checkout/verify — verify Razorpay checkout signature
 * @param {{ paymentId: string, razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string }} payload
 */
export async function verifyCheckoutPayment(payload) {
  try {
    return await request("/v1/checkout/verify", {
      method: "POST",
      body: payload,
    });
  } catch (err) {
    if (err.status === 404) {
      return await request("/checkout/verify", {
        method: "POST",
        body: payload,
      });
    }
    throw err;
  }
}

