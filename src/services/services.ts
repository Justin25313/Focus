export type ServiceId = 'instagram' | 'youtube' | 'x' | 'reddit';

export const SERVICE_IDS: ServiceId[] = ['instagram', 'youtube', 'x', 'reddit'];

/** Apps shown in a generic web browser (everything except Instagram). */
export type WebAppId = Exclude<ServiceId, 'instagram'>;
export const WEB_APP_IDS: WebAppId[] = ['youtube', 'x', 'reddit'];

export const SERVICE_INFO: Record<
  ServiceId,
  { name: string; tagline: string }
> = {
  instagram: {
    name: 'Instagram',
    tagline: 'Ohne Reels und Explore',
  },
  youtube: {
    name: 'YouTube',
    tagline: 'Ohne Shorts und Empfehlungen',
  },
  x: {
    name: 'X',
    tagline: 'Nur „Folge ich“, ohne Erkunden',
  },
  reddit: {
    name: 'Reddit',
    tagline: 'Nur deine Communities',
  },
};

export function isServiceId(value: unknown): value is ServiceId {
  return SERVICE_IDS.includes(value as ServiceId);
}
