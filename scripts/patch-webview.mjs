/**
 * Keeps Focus's WebViews from handing pages to the real apps.
 *
 * WKWebView follows Universal Links: a tap that moves to another address
 * of a site with an app (e.g. YouTube's cookie page → m.youtube.com, or an
 * "Open app" button) opens the YouTube or Instagram app instead of
 * loading the page. WebKit's "allow, but without trying app links" policy
 * (WKNavigationActionPolicyAllow + 2) loads it in the WebView instead.
 *
 * Runs after `npm install`; safe to run more than once.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(
  root,
  'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
);
const ALLOW = /(^\s*)decisionHandler\(WKNavigationActionPolicyAllow\);/gm;
const NO_APP_LINKS =
  '$1decisionHandler((WKNavigationActionPolicy)(WKNavigationActionPolicyAllow + 2)); // Focus: no Universal Links';

const source = readFileSync(file, 'utf8');
const patched = source.replace(ALLOW, NO_APP_LINKS);
const count = (patched.match(/Focus: no Universal Links/g) ?? []).length;
if (count < 2) {
  console.error(
    `patch-webview: expected at least 2 patched decision handlers, found ${count}. ` +
      'react-native-webview changed – check RNCWebViewImpl.m.',
  );
  process.exit(1);
}
if (patched !== source) {
  writeFileSync(file, patched);
}
console.log(`patch-webview: ${count} navigation decisions skip app links`);
