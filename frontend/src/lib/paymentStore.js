import { useState, useEffect } from "react";

const LEGACY_STORAGE_KEY = "gateway.console.sessionPayments";
const PREFIX = "gateway.console.sessionPayments:";
const EVENT_NAME = "gateway:session-payments-updated";

// Automatically remove legacy cross-merchant shared storage key
try {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
} catch {
  /* ignore */
}

function getKey(merchantId) {
  return merchantId ? `${PREFIX}${merchantId}` : null;
}

/** Get stored payments created specifically for this merchant. */
export function getSessionPayments(merchantId) {
  if (!merchantId) return [];
  try {
    const raw = localStorage.getItem(getKey(merchantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p) => String(p.merchantId || "") === String(merchantId))
      : [];
  } catch {
    return [];
  }
}

/** Save a newly created or updated payment scoped strictly to this merchant. */
export function saveSessionPayment(payment, explicitMerchantId) {
  if (!payment) return;
  const pId = payment.paymentId || payment._id;
  const mId = explicitMerchantId || payment.merchantId;
  if (!pId || !mId) return;

  try {
    const key = getKey(mId);
    if (!key) return;
    const current = getSessionPayments(mId);
    const filtered = current.filter((p) => (p.paymentId || p._id) !== pId);
    const updated = [
      { ...payment, paymentId: pId, merchantId: mId },
      ...filtered,
    ].slice(0, 50);

    localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { merchantId: mId, payments: updated } }));
  } catch {
    /* storage unavailable */
  }
}

/** Clear session payments for a specific merchant or all merchants. */
export function clearSessionPayments(merchantId) {
  try {
    if (merchantId) {
      localStorage.removeItem(getKey(merchantId));
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      // Clean up all merchant-scoped keys
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { merchantId, payments: [] } }));
  } catch {
    /* storage unavailable */
  }
}

/** React hook that subscribes to session payments for the active merchant. */
export function useSessionPayments(merchantId) {
  const [payments, setPayments] = useState(() => getSessionPayments(merchantId));

  useEffect(() => {
    setPayments(getSessionPayments(merchantId));

    function handleUpdate(event) {
      if (!event.detail || event.detail.merchantId === merchantId) {
        setPayments(event.detail?.payments || getSessionPayments(merchantId));
      }
    }
    function handleStorageUpdate() {
      setPayments(getSessionPayments(merchantId));
    }
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [merchantId]);

  return payments;
}
