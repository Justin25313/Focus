function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** "14:05", "gestern 14:05" or "03.09. 14:05". */
export function formatTimestamp(at: number, now: number = Date.now()): string {
  const date = new Date(at);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const today = new Date(now);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  if (at >= startOfToday) {
    return time;
  }
  if (at >= startOfToday - 24 * 60 * 60 * 1000) {
    return `gestern ${time}`;
  }
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${time}`;
}
