import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny JSON key-value layer on top of AsyncStorage. Everything Focus
 * stores lives on this device only. Failures are swallowed: storage is a
 * convenience, never a reason to break browsing.
 */
export async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: the next write will try again.
  }
}

export async function removeKeys(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.removeMany(keys);
  } catch {
    // Ignore.
  }
}

export const STORAGE_KEYS = {
  settings: 'focus.settings',
  lastRoute: 'focus.lastRoute',
  diagnostics: 'focus.diagnostics',
  searchHistory: 'focus.searchHistory',
  ownProfile: 'focus.ownProfile',
  usage: 'focus.usage',
} as const;
