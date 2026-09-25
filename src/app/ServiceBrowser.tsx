import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebMessage } from '../filtering/engine/messages';
import { ServiceRules } from '../filtering/engine/types';
import { GuardConfig } from '../filtering/instagram/scripts';
import { BlockedOverlay } from '../screens/BlockedOverlay';
import {
  BlockState,
  BrowserHandle,
  BrowserView,
  UserAgent,
} from '../screens/BrowserView';
import { LoadingOverlay } from '../screens/LoadingOverlay';
import { OfflineOverlay } from '../screens/OfflineOverlay';
import { SkeletonVariant } from '../ui/skeleton/InstagramSkeleton';

export type ServiceBrowserHandle = {
  navigate: (path: string) => void;
  scrollToTop: () => void;
  pauseMedia: () => void;
  reload: () => void;
  goBack: () => void;
};

type Props = {
  initialUrl: string;
  service: ServiceRules;
  guardConfig: GuardConfig;
  userAgent?: UserAgent;
  skeleton: SkeletonVariant;
  bottomInset: number;
  onRoute: (path: string) => void;
  /** "Search" on a block screen (e.g. YouTube's search-only home). */
  onSearch: () => void;
  /** Scrolling down (compact tab bar) or back up. */
  onScrollState: (compact: boolean) => void;
  /** App-specific messages (e.g. Reddit's joined communities). */
  onAppMessage?: (message: WebMessage) => void;
  onExternalLink?: (url: string) => boolean;
};

const LOADING_MAX_MS = 8000;
const LOADING_AFTER_LOAD_MS = 3000;

/**
 * A complete, self-contained browser for one app other than Instagram:
 * WebView, route guard, block screen, loading skeleton and offline state.
 */
function ServiceBrowserImpl(
  {
    initialUrl,
    service,
    guardConfig,
    userAgent,
    skeleton,
    bottomInset,
    onRoute,
    onSearch,
    onScrollState,
    onAppMessage,
    onExternalLink,
  }: Props,
  ref: React.Ref<ServiceBrowserHandle>,
) {
  const browser = useRef<BrowserHandle>(null);
  const [block, setBlock] = useState<BlockState | null>(null);
  const [loading, setLoading] = useState<SkeletonVariant | null>(skeleton);
  const [offline, setOffline] = useState(false);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideLoadingIn = useCallback((ms: number) => {
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
    }
    loadingTimer.current = setTimeout(() => setLoading(null), ms);
  }, []);

  const redirectsRef = useRef(guardConfig.redirects);
  redirectsRef.current = guardConfig.redirects;

  useImperativeHandle(
    ref,
    () => ({
      navigate: path => {
        setBlock(null);
        browser.current?.navigate(path);
      },
      scrollToTop: () => browser.current?.scrollToTop(),
      pauseMedia: () => browser.current?.pauseMedia(),
      reload: () => browser.current?.reload(),
      goBack: () => browser.current?.goBack(),
    }),
    [],
  );

  const handleRoute = useCallback(
    (path: string) => {
      setBlock(null);
      setOffline(false);
      onRoute(path);
    },
    [onRoute],
  );

  const handleBlocked = useCallback((state: BlockState) => {
    const redirect = redirectsRef.current[state.reason];
    if (redirect) {
      // The page redirects itself when it is already there.
      if (!state.navigated) {
        browser.current?.navigate(redirect);
      }
      return;
    }
    setBlock(state);
    setLoading(null);
  }, []);

  const handleMessage = useCallback(
    (message: WebMessage) => {
      switch (message.type) {
        case 'ROUTE_CHANGED':
          handleRoute(message.path);
          break;
        case 'BLOCKED_ROUTE':
          handleBlocked({
            reason: message.reason,
            path: message.path,
            navigated: message.navigated,
          });
          break;
        case 'PAGE_READY':
          setLoading(null);
          break;
        case 'OPEN_SEARCH':
          onSearch();
          break;
        case 'SCROLL_STATE':
          onScrollState(message.compact);
          break;
        default:
          onAppMessage?.(message);
          break;
      }
    },
    [handleBlocked, handleRoute, onAppMessage, onScrollState, onSearch],
  );

  return (
    <View style={styles.fill}>
      <BrowserView
        ref={browser}
        initialUrl={initialUrl}
        service={service}
        guardConfig={guardConfig}
        userAgent={userAgent}
        bottomInset={bottomInset}
        onExternalLink={onExternalLink}
        onRoute={handleRoute}
        onBlocked={handleBlocked}
        onMessage={handleMessage}
        onLoadStart={(_url, isReload) => {
          if (!isReload) {
            setLoading(skeleton);
          }
          hideLoadingIn(LOADING_MAX_MS);
        }}
        onLoadEnd={() => hideLoadingIn(LOADING_AFTER_LOAD_MS)}
        onLoadError={() => {
          setOffline(true);
          setLoading(null);
        }}
        onProcessTerminated={() => setLoading(skeleton)}
      />
      <LoadingOverlay variant={offline || block ? null : loading} />
      {offline && !block ? (
        <OfflineOverlay
          onRetry={() => {
            setOffline(false);
            browser.current?.reload();
          }}
        />
      ) : null}
      {block ? (
        <BlockedOverlay
          reason={block.reason}
          onBack={() => {
            if (block.navigated) {
              browser.current?.leaveBlocked();
            } else {
              setBlock(null);
            }
          }}
          onSearch={() => {
            setBlock(null);
            onSearch();
          }}
          onOpenNative={() => setBlock(null)}
        />
      ) : null}
    </View>
  );
}

export const ServiceBrowser = forwardRef(ServiceBrowserImpl);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
