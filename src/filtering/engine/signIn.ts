/**
 * Google domains, including country ones: sign-in hops through e.g.
 * accounts.google.de to set its cookies there. Handing such a hop to
 * iOS breaks the login (white page) and can open another app.
 */
const GOOGLE_HOST =
  /^(?:[a-z0-9-]+\.)*google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;

/** "Sign in with Google/Apple" pages, which must stay in the WebView. */
export function isSignInHost(host: string): boolean {
  return (
    GOOGLE_HOST.test(host) ||
    host === 'appleid.apple.com' ||
    host === 'idmsa.apple.com'
  );
}
