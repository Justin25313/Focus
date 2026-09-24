import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Linking, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Controls } from '../controls/controls';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';
import {
  blockReasonForPath,
  decideNavigation,
  instagramPathFromUrl,
} from '../filtering/engine/RouteGuard';
import { WebMessage, parseWebMessage } from '../filtering/engine/messages';
import { BlockReason } from '../filtering/instagram/routes';
import {
  LEAVE_BLOCKED_SCRIPT,
  SCROLL_TO_TOP_SCRIPT,
  buildGuardConfig,
  buildGuardScript,
  configureScript,
  navigateScript,
  searchScript,
} from '../filtering/instagram/scripts';

/**
 * Appended to WKWebView's default user agent so Instagram serves its
 * regular mobile-Safari experience rather than a degraded in-app one.
 */
const USER_AGENT_SUFFIX = 'Version/18.0 Safari/604.1';

// react-native-webview's typings default the extra-props generic to
// `undefined`, which collapses to `never` under strict TypeScript.
type InstagramWebView = WebView<object>;

/** WebKit/NSURL error codes that are not real failures. */
const IGNORED_ERROR_CODES = new Set([-999, 102, 204]);

export type BlockState = {
  reason: BlockReason;
  path: string;
  /** Whether the page actually sits on the blocked route. */
  navigated: boolean;
};

export type BrowserHandle = {
  navigate: (path: string) => void;
  leaveBlocked: () => void;
  scrollToTop: () => void;
  reload: () => void;
  replaceWith: (url: string) => void;
  search: (query: string, requestId: number) => void;
  clearCaches: () => void;
};

export type BrowserEvents = {
  onRoute: (path: string) => void;
  onBlocked: (state: BlockState) => void;
  onMessage: (message: WebMessage) => void;
  onLoadStart: (url: string) => void;
  onLoadEnd: (url: string) => void;
  onLoadError: (code: number) => void;
  onProcessTerminated: () => void;
};

type Props = BrowserEvents & {
  initialUrl: string;
  controls: Controls;
  grayscale: boolean;
};

/**
 * The Instagram WebView. It is mounted once and never re-keyed, so
 * switching tabs, backgrounding, Control Center or locking the phone
 * never reloads Instagram. `initialUrl` is only read on first mount.
 */
function BrowserViewImpl(
  {
    initialUrl,
    controls,
    grayscale,
    onRoute,
    onBlocked,
    onMessage,
    onLoadStart,
    onLoadEnd,
    onLoadError,
    onProcessTerminated,
  }: Props,
  ref: React.Ref<BrowserHandle>,
) {
  const webRef = useRef<InstagramWebView>(null);
  const source = useRef({ uri: initialUrl }).current;
  const lastExternal = useRef<{ url: string; at: number } | null>(null);

  const inject = useCallback((script: string) => {
    webRef.current?.injectJavaScript(script);
  }, []);

  // The guard config follows the user's controls. New page loads get it via
  // the document-start script; the current page is reconfigured in place,
  // so changing a mode never reloads Instagram.
  const guardConfig = useMemo(
    () => buildGuardConfig(controls, grayscale),
    [controls, grayscale],
  );
  const guardScript = useMemo(
    () => buildGuardScript(guardConfig),
    [guardConfig],
  );
  const policyRef = useRef(guardConfig.policy);
  policyRef.current = guardConfig.policy;
  const configured = useRef(false);
  useEffect(() => {
    if (!configured.current) {
      configured.current = true;
      return;
    }
    inject(configureScript(guardConfig));
  }, [guardConfig, inject]);

  useImperativeHandle(
    ref,
    () => ({
      navigate: path => {
        const script = navigateScript(path);
        if (script) {
          inject(script);
        }
      },
      leaveBlocked: () => inject(LEAVE_BLOCKED_SCRIPT),
      scrollToTop: () => inject(SCROLL_TO_TOP_SCRIPT),
      reload: () => webRef.current?.reload(),
      replaceWith: url =>
        inject(`location.replace(${JSON.stringify(url)});true;`),
      search: (query, requestId) => inject(searchScript(query, requestId)),
      clearCaches: () => webRef.current?.clearCache(true),
    }),
    [inject],
  );

  const openExternal = useCallback((url: string) => {
    const now = Date.now();
    const last = lastExternal.current;
    if (last && last.url === url && now - last.at < 2000) {
      return;
    }
    lastExternal.current = { url, at: now };
    Linking.openURL(url).catch(() => {});
  }, []);

  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const decision = decideNavigation(
        { url: request.url, isTopFrame: request.isTopFrame },
        policyRef.current,
      );
      switch (decision.action) {
        case 'allow':
          return true;
        case 'block':
          onBlocked({
            reason: decision.reason,
            path: decision.path,
            navigated: false,
          });
          return false;
        case 'openExternally':
          openExternal(decision.url);
          return false;
        case 'ignore':
          return false;
      }
    },
    [onBlocked, openExternal],
  );

  const handleNavigationStateChange = useCallback(
    (nav: WebViewNavigation) => {
      const path = instagramPathFromUrl(nav.url);
      if (!path) {
        return;
      }
      const reason = blockReasonForPath(path, policyRef.current);
      if (reason) {
        onBlocked({ reason, path, navigated: true });
      } else if (!nav.loading) {
        onRoute(path);
      }
    },
    [onBlocked, onRoute],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseWebMessage(
        event.nativeEvent.data,
        event.nativeEvent.url,
      );
      if (message) {
        onMessage(message);
      }
    },
    [onMessage],
  );

  const handleLoadStart = useCallback(
    (event: WebViewNavigationEvent) => onLoadStart(event.nativeEvent.url),
    [onLoadStart],
  );

  const handleLoadEnd = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) =>
      onLoadEnd(event.nativeEvent.url),
    [onLoadEnd],
  );

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      const { code } = event.nativeEvent;
      if (!IGNORED_ERROR_CODES.has(code)) {
        onLoadError(code);
      }
    },
    [onLoadError],
  );

  const handleProcessTerminated = useCallback(() => {
    onProcessTerminated();
    webRef.current?.reload();
  }, [onProcessTerminated]);

  return (
    <WebView<object>
      ref={webRef}
      source={source}
      style={styles.web}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onNavigationStateChange={handleNavigationStateChange}
      onMessage={handleMessage}
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      onError={handleError}
      onContentProcessDidTerminate={handleProcessTerminated}
      injectedJavaScriptBeforeContentLoaded={guardScript}
      injectedJavaScriptBeforeContentLoadedForMainFrameOnly
      applicationNameForUserAgent={USER_AGENT_SUFFIX}
      // Persistent website data store: login survives restarts.
      incognito={false}
      cacheEnabled
      sharedCookiesEnabled={false}
      // Native feel on iPhone.
      allowsBackForwardNavigationGestures
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsLinkPreview={false}
      dataDetectorTypes="none"
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      decelerationRate="normal"
      // Pull-to-refresh would reload DMs while scrolling up; refresh lives in the Focus tab.
      pullToRefreshEnabled={false}
      fraudulentWebsiteWarningEnabled
      webviewDebuggingEnabled={__DEV__}
    />
  );
}

export const BrowserView = memo(forwardRef(BrowserViewImpl));

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
