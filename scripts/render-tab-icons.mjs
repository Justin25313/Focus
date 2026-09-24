#!/usr/bin/env node
// Renders the tab bar icons as template PNGs (black on transparent, @2x
// and @3x) into src/ui/tabIcons. The tab bar tints them with the system
// label color, so they flip between dark and light together with the
// Liquid Glass underneath – which SVG icons cannot.
//
// The shapes mirror src/ui/icons.tsx. Rerun after changing them:
//   node scripts/render-tab-icons.mjs [path/to/chromium]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/ui/tabIcons');
const chromium =
  process.argv[2] ??
  process.env.CHROMIUM ??
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const stroke = (width = 1.9) =>
  `stroke="#000" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

const ICONS = {
  home: filled =>
    `<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z" ${stroke()} fill="${filled ? '#000' : 'none'}"/>`,
  search: filled => {
    const w = filled ? 2.6 : 1.9;
    return `<circle cx="10.8" cy="10.8" r="6.8" ${stroke(w)}/><path d="m16 16 4.5 4.5" ${stroke(w)}/>`;
  },
  message: filled =>
    `<path d="M20.8 3.2 3.6 9.6l7 3.1 3.1 7.1z" ${stroke()} fill="${filled ? '#000' : 'none'}"/>` +
    (filled ? '' : `<path d="m20.8 3.2-10.2 9.5" ${stroke()}/>`),
  reels: filled =>
    `<path d="M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z" ${stroke(filled ? 2.3 : 1.9)}/>` +
    '<path d="m10 8.6 5.4 3.4-5.4 3.4z" fill="#000"/>',
  profile: filled => {
    const w = filled ? 2.3 : 1.9;
    return (
      `<circle cx="12" cy="12" r="9.6" ${stroke(w)}/>` +
      `<circle cx="12" cy="10" r="3.4" ${stroke(w)}/>` +
      `<path d="M6.2 18.9c1.2-2.4 3.3-3.7 5.8-3.7s4.6 1.3 5.8 3.7" ${stroke(w)}/>`
    );
  },
  bell: filled =>
    `<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15z" ${stroke(filled ? 2.1 : 1.9)} fill="${filled ? '#000' : 'none'}"/>` +
    `<path d="M10 20.5a2.2 2.2 0 0 0 4 0" ${stroke(filled ? 2.1 : 1.9)}/>`,
  focus: filled =>
    `<circle cx="12" cy="12" r="8.3" ${stroke(filled ? 2.5 : 1.9)}/>` +
    '<circle cx="12" cy="12" r="2.9" fill="#000"/>',
};

/** Points; the tab bar draws the icons at this size. */
const SIZE = 27;

const work = mkdtempSync(join(tmpdir(), 'tab-icons-'));
try {
  for (const [name, draw] of Object.entries(ICONS)) {
    for (const filled of [false, true]) {
      for (const scale of [2, 3]) {
        const px = SIZE * scale;
        const file = `${name}${filled ? '-filled' : ''}@${scale}x.png`;
        const html = join(work, 'icon.html');
        writeFileSync(
          html,
          `<html><body style="margin:0;background:transparent">` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">${draw(filled)}</svg>` +
            '</body></html>',
        );
        execFileSync(chromium, [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          '--hide-scrollbars',
          '--default-background-color=00000000',
          `--window-size=${px},${px}`,
          `--screenshot=${join(out, file)}`,
          `file://${html}`,
        ], { stdio: 'ignore' });
        console.log(file);
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
