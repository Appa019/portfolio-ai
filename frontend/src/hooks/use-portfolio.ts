"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPortfolio, type PortfolioSummary } from "@/lib/api";

export function usePortfolio(refreshInterval = 60_000) {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchPortfolio();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setError(null);
        const result = await fetchPortfolio(controller.signal);
        setData(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, refreshInterval);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refreshInterval]);

  return { data, loading, error, refresh };
}
