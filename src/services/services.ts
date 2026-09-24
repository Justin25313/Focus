import type { UserAgent } from '../screens/BrowserView';

export type ServiceId = 'instagram' | 'youtube' | 'snapchat';

export const SERVICE_IDS: ServiceId[] = ['instagram', 'youtube', 'snapchat'];

export const SERVICE_INFO: Record<
  ServiceId,
  { name: string; tagline: string; monogram: string; beta?: boolean }
> = {
  instagram: {
    name: 'Instagram',
    tagline: 'Ohne Reels und Explore',
    monogram: 'Ig',
  },
  youtube: {
    name: 'YouTube',
    tagline: 'Ohne Shorts und Empfehlungen',
    monogram: 'Yt',
  },
  snapchat: {
    name: 'Snapchat',
    tagline: 'Nur Chats – ohne Spotlight',
    monogram: 'Sc',
    beta: true,
  },
};

/**
 * Snapchat for Web is built for desktop browsers and sends phones to the
 * App Store, so Focus presents itself as a desktop browser there.
 */
export const SNAPCHAT_USER_AGENT: UserAgent = {
  full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

export function isServiceId(value: unknown): value is ServiceId {
  return SERVICE_IDS.includes(value as ServiceId);
}
