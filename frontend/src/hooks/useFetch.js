import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Small data-fetching hook for a single API resource.
 *
 * @param {() => Promise<any>} fetcher - Async function returning `{ data }` or raw data.
 * @param {Array} deps - Re-run when these change (must be stable).
 * @param {object} [options]
 * @param {boolean} [options.enabled] - Skip fetching until true.
 * @param {any} [options.initialData]
 */
export function useFetch(fetcher, deps = [], { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      const payload = result && typeof result === "object" && "data" in result
        ? result.data
        : result;
      if (mounted.current) setData(payload);
    } catch (err) {
      if (mounted.current) setError(err);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refresh: run, setData };
}

export default useFetch;
