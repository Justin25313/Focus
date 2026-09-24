import { BLOCK_REASONS, BlockReason } from '../filtering/instagram/routes';

/** Local-only diagnostics. Never leaves the device. */
export type Diagnostics = {
  lastFilterReadyAt: number | null;
  lastBlocked: { path: string; reason: BlockReason; at: number } | null;
  blockedCount: number;
  lastUnknownRoute: { path: string; at: number } | null;
  lastError: { code: string; at: number } | null;
  webProcessRestarts: number;
  hiddenSponsored: number;
  hiddenSuggested: number;
};

export const EMPTY_DIAGNOSTICS: Diagnostics = {
  lastFilterReadyAt: null,
  lastBlocked: null,
  blockedCount: 0,
  lastUnknownRoute: null,
  lastError: null,
  webProcessRestarts: 0,
  hiddenSponsored: 0,
  hiddenSuggested: 0,
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function parseDiagnostics(raw: unknown): Diagnostics {
  const data = obj(raw);
  if (!data) {
    return { ...EMPTY_DIAGNOSTICS };
  }
  const blocked = obj(data.lastBlocked);
  const unknown = obj(data.lastUnknownRoute);
  const error = obj(data.lastError);
  return {
    lastFilterReadyAt: num(data.lastFilterReadyAt),
    lastBlocked:
      blocked &&
      typeof blocked.path === 'string' &&
      (BLOCK_REASONS as readonly unknown[]).includes(blocked.reason) &&
      num(blocked.at) !== null
        ? {
            path: blocked.path,
            reason: blocked.reason as BlockReason,
            at: blocked.at as number,
          }
        : null,
    blockedCount: num(data.blockedCount) ?? 0,
    lastUnknownRoute:
      unknown && typeof unknown.path === 'string' && num(unknown.at) !== null
        ? { path: unknown.path, at: unknown.at as number }
        : null,
    lastError:
      error && typeof error.code === 'string' && num(error.at) !== null
        ? { code: error.code, at: error.at as number }
        : null,
    webProcessRestarts: num(data.webProcessRestarts) ?? 0,
    hiddenSponsored: num(data.hiddenSponsored) ?? 0,
    hiddenSuggested: num(data.hiddenSuggested) ?? 0,
  };
}
