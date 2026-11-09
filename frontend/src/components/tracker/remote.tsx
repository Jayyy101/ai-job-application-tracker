"use client";

import { useEffect, useState } from "react";
import { trackerApi } from "@/lib/tracker-api";

export function useRemote<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: string; path?: string; attempt?: number }>({});
  useEffect(() => {
    let ignore = false;
    trackerApi<T>(path).then(
      (data) => { if (!ignore) setState({ data, path, attempt }); },
      (error: Error) => { if (!ignore) setState({ error: error.message, path, attempt }); },
    );
    return () => { ignore = true; };
  }, [path, attempt]);
  const loading = state.path !== path || state.attempt !== attempt;
  return { data: loading ? undefined : state.data, error: loading ? undefined : state.error, loading, reload: () => setAttempt((n) => n + 1) };
}

export function RemoteState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (loading) return <div className="panel loading-state" role="status"><span className="loading-dot" />Loading your workspace…</div>;
  if (error) return <div className="panel error-state" role="alert"><h2>We couldn’t load this view</h2><p>{error}</p><button className="button secondary" onClick={retry}>Try again</button></div>;
  return null;
}
