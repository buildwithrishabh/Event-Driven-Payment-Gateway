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
 *   GET  /v1/payments/:id               -> getPayment()
 *   GET  /v1/ledger/balance             -> getBalance()
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

/** GET /v1/ledger/balance — aggregated merchant balance for the first currency group. */
export function getBalance(apiKey) {
  return request("/v1/ledger/balance", { apiKey });
}
