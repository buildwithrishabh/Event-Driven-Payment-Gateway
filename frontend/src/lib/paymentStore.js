import { useState, useEffect } from "react";

const STORAGE_KEY = "gateway.console.sessionPayments";
const EVENT_NAME = "gateway:session-payments-updated";

/** Get stored payments created in this browser session/merchant. */
export function getSessionPayments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save a newly created or updated payment to local history. */
export function saveSessionPayment(payment) {
  if (!payment || !payment.paymentId) return;
  try {
    const current = getSessionPayments();
    // Replace if exists, or prepend if new
    const filtered = current.filter((p) => p.paymentId !== payment.paymentId);
    const updated = [payment, ...filtered].slice(0, 50); // Keep latest 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch {
    /* storage unavailable */
  }
}

/** Clear session payments */
export function clearSessionPayments() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: [] }));
  } catch {
    /* storage unavailable */
  }
}

/** React hook that subscribes to session payments so UI updates in real-time. */
export function useSessionPayments() {
  const [payments, setPayments] = useState(() => getSessionPayments());

  useEffect(() => {
    function handleUpdate(event) {
      setPayments(event.detail || getSessionPayments());
    }
    function handleStorageUpdate() {
      setPayments(getSessionPayments());
    }
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  return payments;
}
