import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, withQuery } from '../services/apiClient';
import { read, write } from '../services/contractApi';
import type { Page } from '../types/contracts';
import { uniqueItems } from '../utils/contracts';

export function useRemote<T>(path?: string) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ path?: string; data?: T; error?: unknown; loading: boolean }>({
    loading: true,
  });
  const refresh = useCallback(() => setVersion((x) => x + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ path, loading: Boolean(path) });
    if (path)
      read<T>(path, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setState({ path, data, loading: false });
        })
        .catch((error) => {
          if (!controller.signal.aborted) setState({ path, error, loading: false });
        });
    return () => controller.abort();
  }, [path, version]);
  return { ...(state.path === path ? state : { loading: Boolean(path) }), refresh };
}
export function usePage<T extends { id: string }>(path: string, cursorParameter = 'cursor') {
  const [cursor, setCursor] = useState<string>();
  const [items, setItems] = useState<T[]>([]);
  const [scope, setScope] = useState(path);
  const effectiveCursor = scope === path ? cursor : undefined;
  const remote = useRemote<Page<T>>(withQuery(path, { [cursorParameter]: effectiveCursor }));
  // Append via URLSearchParams in withQuery, preserving filter parameters.
  useEffect(() => {
    setScope(path);
    setCursor(undefined);
    setItems([]);
  }, [path]);
  useEffect(() => {
    if (remote.data)
      setItems((previous) =>
        uniqueItems(effectiveCursor ? [...previous, ...remote.data!.items] : remote.data!.items),
      );
  }, [remote.data, effectiveCursor]);
  const refreshRemote = remote.refresh;
  const refresh = useCallback(() => {
    setItems([]);
    setCursor(undefined);
    refreshRemote();
  }, [refreshRemote]);
  return {
    ...remote,
    items: scope === path ? items : [],
    more: () => {
      if (remote.data?.nextCursor) setCursor(remote.data.nextCursor);
    },
    hasMore: Boolean(remote.data?.nextCursor),
    refresh,
  };
}
export function useAction(onConflict?: () => void) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [result, setResult] = useState<unknown>();
  const lock = useRef(false);
  const execute = async <T>(fn: () => Promise<T>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const value = await fn();
      setResult(value);
      return value;
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.status === 409) onConflict?.();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, result, execute };
}
// Tab-scoped recovery stores only an operation key and SHA256 fingerprint, never
// prompts, profile/world snapshots, tokens or response data.
const operationPrefix = 'vfandex:operation:';
const operations = new Map<string, { key: string; fingerprint: string; path: string }>();
export async function operationRequest<T>(scope: string, path: string, body: unknown) {
  const encoded = JSON.stringify(body) ?? '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encoded));
  const fingerprint = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
  let operation = operations.get(scope);
  if (!operation) {
    const stored = window.sessionStorage.getItem(operationPrefix + scope);
    if (stored) operation = JSON.parse(stored) as typeof operation;
  }
  if (operation && (operation.fingerprint !== fingerprint || operation.path !== path))
    throw new Error('이전 작업의 결과를 먼저 확인하세요. 변경된 요청은 ‘새 작업’으로 시작해야 합니다.');
  if (!operation) {
    operation = { key: crypto.randomUUID(), fingerprint, path };
    // Fail before submission if recovery data cannot be saved.
    window.sessionStorage.setItem(operationPrefix + scope, JSON.stringify(operation));
  }
  operations.set(scope, operation);
  return write<T>(path, 'POST', body, operation.key);
}
export function newOperation(scope: string) {
  operations.delete(scope);
  window.sessionStorage.removeItem(operationPrefix + scope);
}
export function clearOperations() {
  operations.clear();
  Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith(operationPrefix))
    .forEach((key) => window.sessionStorage.removeItem(key));
}
