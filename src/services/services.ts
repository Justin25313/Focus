export type ServiceId = 'instagram' | 'youtube';

export const SERVICE_IDS: ServiceId[] = ['instagram', 'youtube'];

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
};

export function isServiceId(value: unknown): value is ServiceId {
  return SERVICE_IDS.includes(value as ServiceId);
}
