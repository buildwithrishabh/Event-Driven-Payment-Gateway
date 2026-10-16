import { useCallback, useEffect, useState } from "react";
import { health } from "../lib/api.js";

/**
 * Polls GET /health so the console can show real API + Redis liveness.
 * @param {number} intervalMs
 */
export function useHealth(intervalMs = 30000) {
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
    checkedAt: null,
  });

  const check = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await health();
      setState({ loading: false, data, error: null, checkedAt: new Date() });
    } catch (err) {
      setState({
        loading: false,
        data: null,
        error: err.message || "Unreachable",
        checkedAt: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  const apiUp = Boolean(state.data && state.data.status === "OK");
  const redisUp = state.data?.service?.redis === "OK";

  return { ...state, apiUp, redisUp, refresh: check };
}
