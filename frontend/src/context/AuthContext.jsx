import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, getProfile } from "../lib/api.js";

const STORAGE_KEY = "gateway.console.apiKey";

const AuthContext = createContext(null);

/**
 * Auth model
 * ----------
 * The backend has NO login/JWT/session endpoints — it authenticates with the
 * `x-api-key` header on every request. So the console keeps the merchant's API
 * key locally (localStorage) and validates it by calling GET /v1/merchants/me.
 *
 * The raw key is only ever sent to the gateway API as a header; it is never
 * logged or displayed in full (see Settings -> masked reveal).
 */
export function AuthProvider({ children }) {
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [merchant, setMerchant] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | checking | connected | error
  const [error, setError] = useState(null);

  const persistKey = useCallback((key) => {
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable (private mode) — non fatal */
    }
  }, []);

  const loadProfile = useCallback(async (key) => {
    const { data } = await getProfile(key);
    setMerchant(data);
    return data;
  }, []);

  /** Validate + adopt a key. Throws on failure so the caller can surface it. */
  const connect = useCallback(
    async (key) => {
      const trimmed = String(key || "").trim();
      if (!trimmed) {
        const err = new ApiError("Please enter your API key.");
        setError(err.message);
        throw err;
      }
      setStatus("checking");
      setError(null);
      try {
        const profile = await loadProfile(trimmed);
        setApiKey(trimmed);
        persistKey(trimmed);
        setStatus("connected");
        return profile;
      } catch (err) {
        setStatus("error");
        setError(err.message);
        throw err;
      }
    },
    [loadProfile, persistKey],
  );

  const disconnect = useCallback(() => {
    setApiKey("");
    setMerchant(null);
    setStatus("idle");
    setError(null);
    persistKey("");
  }, [persistKey]);

  /** Refresh the cached profile (e.g. after key rotation or status change). */
  const refresh = useCallback(async () => {
    if (!apiKey) return null;
    try {
      return await loadProfile(apiKey);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        disconnect();
      }
      throw err;
    }
  }, [apiKey, loadProfile, disconnect]);

  // Validate a persisted key once on boot.
  useEffect(() => {
    if (!apiKey) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    loadProfile(apiKey)
      .then(() => {
        if (!cancelled) setStatus("connected");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.message);
        // A rejected key is dead weight — drop it so the user can re-enter one.
        if (err instanceof ApiError && (err.status === 401 || err.status === 0)) {
          persistKey("");
          setApiKey("");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      apiKey,
      merchant,
      status,
      error,
      isConnected: status === "connected" && Boolean(merchant),
      connect,
      disconnect,
      refresh,
    }),
    [apiKey, merchant, status, error, connect, disconnect, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
