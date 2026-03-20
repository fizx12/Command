import { useState, useCallback, useEffect, useRef } from 'react';

interface UseIPCResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
}

export function useIPC<T>(apiFn: (...args: any[]) => Promise<any>): UseIPCResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to apiFn so execute doesn't change identity on every render
  const apiFnRef = useRef(apiFn);
  useEffect(() => { apiFnRef.current = apiFn; }, [apiFn]);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);

    if (typeof apiFnRef.current !== 'function') {
      setError('IPC API not available (are you running in a browser instead of Electron?)');
      setLoading(false);
      return null;
    }

    try {
      const result = await apiFnRef.current(...args);

      if (result?.error) {
        setError(typeof result.message === 'string' ? result.message : 'Unknown IPC error');
        return null;
      }

      setData((result?.data ?? null) as T | null);
      return (result?.data ?? null) as T | null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unknown IPC error';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []); // stable — uses ref internally

  return { data, loading, error, execute };
}

export function useIPCQuery<T>(apiFn: (...args: any[]) => Promise<any>, ...args: any[]): UseIPCResult<T> {
  const result = useIPC<T>(apiFn);
  const { execute } = result;

  // Serialize primitive args to a stable string so the effect only fires when
  // actual argument values change — not when the execute function identity changes.
  const argsKey = JSON.stringify(args);

  useEffect(() => {
    void execute(...args);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, argsKey]);

  return result;
}
