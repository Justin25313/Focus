import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { STORAGE_KEYS, removeKeys, writeJson } from '../storage/kv';
import { UsageLog, addInterval, pruneLog } from './usage';

const FLUSH_MS = 30 * 1000;

/**
 * Counts foreground time while `counting` is true (Instagram visible).
 * Brief system overlays (Control Center, notifications) make the app
 * "inactive", not "background", so they don't interrupt a session;
 * locking the phone or switching apps does.
 */
export function useUsageTracker(initial: UsageLog, counting: boolean) {
  const [log, setLog] = useState(initial);
  const startedAt = useRef<number | null>(null);
  const foreground = useRef(AppState.currentState !== 'background');

  const commit = useCallback((until: number, restart: boolean) => {
    const start = startedAt.current;
    startedAt.current = restart ? until : null;
    if (start === null) {
      return;
    }
    setLog(prev => {
      const next = pruneLog(addInterval(prev, start, until), until);
      writeJson(STORAGE_KEYS.usage, next);
      return next;
    });
  }, []);

  const sync = useCallback(() => {
    const shouldCount = counting && foreground.current;
    if (shouldCount && startedAt.current === null) {
      startedAt.current = Date.now();
    } else if (!shouldCount && startedAt.current !== null) {
      commit(Date.now(), false);
    }
  }, [commit, counting]);

  useEffect(() => {
    sync();
  }, [sync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state !== 'background';
      sync();
    });
    return () => subscription.remove();
  }, [sync]);

  // Save regularly, so a crash or kill loses at most FLUSH_MS.
  useEffect(() => {
    const timer = setInterval(() => {
      if (startedAt.current !== null) {
        commit(Date.now(), true);
      }
    }, FLUSH_MS);
    return () => clearInterval(timer);
  }, [commit]);

  const reset = useCallback(() => {
    startedAt.current = startedAt.current === null ? null : Date.now();
    setLog({});
    removeKeys([STORAGE_KEYS.usage]);
  }, []);

  return { log, reset };
}
