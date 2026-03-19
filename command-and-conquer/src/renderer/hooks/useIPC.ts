import { useState, useCallback, useEffect } from 'react';

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

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);

    if (typeof apiFn !== 'function') {
      setError('IPC API not available (are you running in a browser instead of Electron?)');
      setLoading(false);
      return null;
    }

    try {
      const result = await apiFn(...args);

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
  }, [apiFn]);

  return { data, loading, error, execute };
}

export function useIPCQuery<T>(apiFn: (...args: any[]) => Promise<any>, ...args: any[]): UseIPCResult<T> {
  const result = useIPC<T>(apiFn);
  const { execute } = result;

  useEffect(() => {
    void execute(...args);
  }, [execute, ...args]);

  return result;
}
