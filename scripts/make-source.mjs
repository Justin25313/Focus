#!/usr/bin/env node
// Writes dist/source.json, a SideStore/AltStore source describing the
// freshly built dist/Focus.ipa. SideStore polls this file and offers the
// update in "My Apps" when the build number goes up.
//
// Usage: node scripts/make-source.mjs <release-download-base-url> [notes]
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const [base, notes = ''] = process.argv.slice(2);
if (!base) {
  console.error('usage: make-source.mjs <download-base-url> [notes]');
  process.exit(1);
}

const [version, build] = readFileSync('dist/version.txt', 'utf8')
  .trim()
  .split('\n');
const plist = readFileSync('ios/Focus/Info.plist', 'utf8');
const usage = key => {
  const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(
    plist,
  );
  return match ? match[1] : undefined;
};
const privacy = Object.fromEntries(
  [
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
  ]
    .map(key => [key, usage(key)])
    .filter(([, text]) => text),
);

const source = {
  name: 'Focus',
  identifier: 'com.justin25313.focus.source',
  subtitle: 'Private Builds',
  iconURL: `${base}/icon.png`,
  tintColor: '#1E6B57',
  apps: [
    {
      name: 'Focus',
      bundleIdentifier: 'com.justin25313.focus',
      developerName: 'Justin',
      subtitle: 'Instagram ohne Reels und Explore',
      localizedDescription:
        'Instagram ohne Reels, Explore und algorithmischen Ballast. Kein Konto, keine Cloud, kein Tracking.',
      iconURL: `${base}/icon.png`,
      tintColor: '#1E6B57',
      category: 'social',
      versions: [
        {
          version,
          buildVersion: build,
          date: new Date().toISOString(),
          localizedDescription: notes.slice(0, 2000),
          downloadURL: `${base}/Focus.ipa`,
          size: statSync('dist/Focus.ipa').size,
          minOSVersion: '16.0',
        },
      ],
      appPermissions: { entitlements: [], privacy },
    },
  ],
  news: [],
};

writeFileSync('dist/source.json', `${JSON.stringify(source, null, 2)}\n`);
console.log(`✓ dist/source.json (${version}, Build ${build})`);
