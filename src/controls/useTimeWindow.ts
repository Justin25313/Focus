import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { removeKeys, writeJson } from '../storage/kv';
import {
  TimeWindow,
  WindowStatus,
  checkpointWindow,
  closeWindow,
  openWindow,
  setWindowRunning,
  settleWindow,
  windowStatus,
} from './timeWindow';

/** A running window is saved this often, so a kill loses at most this. */
const CHECKPOINT_MS = 5 * 1000;

/**
 * A Reels or Shorts window that only runs while `visible` (the content is
 * on screen) and Focus is in the foreground. Every change is saved at
 * once; a running window is saved every few seconds.
 */
export function useTimeWindow(
  initial: TimeWindow | null,
  storageKey: string,
  visible: boolean,
): {
  status: WindowStatus;
  open: (minutes: number) => void;
  close: () => void;
} {
  const [stored, setStored] = useState(initial);
  const ref = useRef(initial);
  const [now, setNow] = useState(() => Date.now());
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background',
  );
  const running = visible && foreground;
  const runningRef = useRef(running);
  runningRef.current = running;

  const save = useCallback(
    (next: TimeWindow | null) => {
      setNow(Date.now());
      if (next === ref.current) {
        return;
      }
      ref.current = next;
      setStored(next);
      if (next) {
        writeJson(storageKey, next);
      } else {
        removeKeys([storageKey]);
      }
    },
    [storageKey],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const next = state !== 'background';
      if (!next) {
        // Pause right away; the JS thread may not run again for a while.
        save(setWindowRunning(ref.current, false, Date.now()));
      }
      setForeground(next);
    });
    return () => subscription.remove();
  }, [save]);

  const open = stored !== null && stored.lockedUntil === null;
  useEffect(() => {
    save(setWindowRunning(ref.current, running, Date.now()));
  }, [open, running, save]);

  // Tick every second while running (countdown and an exact stop), with
  // a saved checkpoint every few seconds; wake up once when a lockout ends.
  const isRunning =
    stored !== null &&
    stored.lockedUntil === null &&
    stored.runningSince !== null;
  const lockedUntil = stored?.lockedUntil ?? null;
  useEffect(() => {
    if (isRunning) {
      let last = Date.now();
      const timer = setInterval(() => {
        const t = Date.now();
        const settled = settleWindow(ref.current, t);
        if (settled !== ref.current) {
          save(settled);
        } else if (t - last >= CHECKPOINT_MS) {
          last = t;
          save(checkpointWindow(ref.current, t));
        } else {
          setNow(t);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
    if (lockedUntil !== null) {
      const timer = setTimeout(
        () => save(settleWindow(ref.current, Date.now())),
        Math.max(0, lockedUntil - Date.now()) + 50,
      );
      return () => clearTimeout(timer);
    }
  }, [isRunning, lockedUntil, save]);

  const openNow = useCallback(
    (minutes: number) => {
      const t = Date.now();
      const next = openWindow(ref.current, minutes, t);
      if (next) {
        save(setWindowRunning(next, runningRef.current, t));
      }
    },
    [save],
  );

  const close = useCallback(() => {
    save(closeWindow(ref.current, Date.now()));
  }, [save]);

  return { status: windowStatus(stored, now), open: openNow, close };
}
