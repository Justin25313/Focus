import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebMessage } from '../filtering/engine/messages';
import {
  INSTAGRAM_SERVICE_RULES,
  routeKindForPath,
} from '../filtering/instagram/routes';
import { GuardConfig } from '../filtering/instagram/scripts';
import { instagramPathFromUrl } from '../filtering/engine/RouteGuard';
import { BlockedOverlay } from '../screens/BlockedOverlay';
import { BlockState, BrowserHandle, BrowserView } from '../screens/BrowserView';
import { LoadingOverlay } from '../screens/LoadingOverlay';
import { OfflineOverlay } from '../screens/OfflineOverlay';
import {
  SkeletonVariant,
  skeletonForRoute,
} from '../ui/skeleton/InstagramSkeleton';

/** Longest a loading skeleton may stay up, whatever happens. */
const LOADING_MAX_MS = 8000;
/** After the document itself loaded, the page gets this long to settle. */
const LOADING_AFTER_LOAD_MS = 1500;
/** PAGE_READY messages this soon after a new load began are leftovers. */
const LOADING_STALE_MS = 400;

export type InstagramPageHandle = {
  navigate: (path: string) => void;
  scrollToTop: () => void;
  pauseMedia: () => void;
  reload: () => void;
  replaceWith: (url: string) => void;
  search: (query: string, requestId: number) => void;
  clearCaches: () => void;
  path: () => string;
  blocked: () => boolean;
};

type Props = {
  initialUrl: string;
  guardConfig: GuardConfig;
  bottomInset: number;
  /** Reels are locked until then (after a timed window). */
  lockedUntil?: number;
  onRoute: (path: string) => void;
  /** Messages that concern the whole app (filter state, profile, …). */
  onMessage: (message: WebMessage) => void;
  onBlocked: (state: BlockState) => void;
  onLoadEnd: () => void;
  onLoadError: (code: number) => void;
  onProcessTerminated: () => void;
  onSearch: () => void;
  onOpenNative: (path: string) => void;
  onExternalLink: (url: string) => boolean;
};

/**
 * One Instagram tab (home, messages, profile, …) with its own WebView,
 * so every tab keeps its place – like the app's tab stacks – and
 * switching tabs never reloads anything.
 */
function InstagramPageImpl(
  {
    initialUrl,
    guardConfig,
    bottomInset,
    lockedUntil,
    onRoute,
    onMessage,
    onBlocked,
    onLoadEnd,
    onLoadError,
    onProcessTerminated,
    onSearch,
    onOpenNative,
    onExternalLink,
  }: Props,
  ref: React.Ref<InstagramPageHandle>,
) {
  const browser = useRef<BrowserHandle>(null);
  const initialPath = useRef(instagramPathFromUrl(initialUrl) ?? '/').current;
  const pathRef = useRef(initialPath);
  const [block, setBlock] = useState<BlockState | null>(null);
  const blockRef = useRef<BlockState | null>(null);
  blockRef.current = block;
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState<SkeletonVariant | null>(
    skeletonForRoute(routeKindForPath(initialPath)),
  );
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingSince = useRef(Date.now());

  const redirectsRef = useRef(guardConfig.redirects);
  redirectsRef.current = guardConfig.redirects;

  const hideLoading = useCallback(() => {
    for (const timer of [loadingTimer, reloadTimer]) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
    setLoading(null);
  }, []);

  const hideLoadingIn = useCallback(
    (ms: number) => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
      loadingTimer.current = setTimeout(hideLoading, ms);
    },
    [hideLoading],
  );

  const showLoading = useCallback(
    (variant: SkeletonVariant) => {
      loadingSince.current = Date.now();
      setLoading(variant);
      hideLoadingIn(LOADING_MAX_MS);
    },
    [hideLoadingIn],
  );

  const navigate = useCallback(
    (path: string) => {
      setBlock(null);
      const pathname = path.split('?')[0];
      if (pathname.toLowerCase() !== pathRef.current.toLowerCase()) {
        showLoading(skeletonForRoute(routeKindForPath(pathname)));
      }
      browser.current?.navigate(path);
    },
    [showLoading],
  );

  useImperativeHandle(
    ref,
    () => ({
      navigate,
      scrollToTop: () => browser.current?.scrollToTop(),
      pauseMedia: () => browser.current?.pauseMedia(),
      reload: () => browser.current?.reload(),
      replaceWith: url => browser.current?.replaceWith(url),
      search: (query, id) => browser.current?.search(query, id),
      clearCaches: () => browser.current?.clearCaches(),
      path: () => pathRef.current,
      blocked: () => blockRef.current !== null,
    }),
    [navigate],
  );

  const handleRoute = useCallback(
    (path: string) => {
      pathRef.current = path;
      setBlock(null);
      setOffline(false);
      onRoute(path);
    },
    [onRoute],
  );

  const handleBlocked = useCallback(
    (state: BlockState) => {
      const redirect = redirectsRef.current[state.reason];
      if (redirect) {
        // E.g. "Messages only": no home feed, the inbox instead. The page
        // redirects itself when it is already there.
        if (!state.navigated) {
          navigate(redirect);
        }
        return;
      }
      const prev = blockRef.current;
      const duplicate =
        prev !== null &&
        prev.path === state.path &&
        prev.reason === state.reason;
      // Page and native callback can both report it; "navigated" wins
      // because it needs a real way back.
      const next =
        duplicate && (prev.navigated || !state.navigated) ? prev : state;
      blockRef.current = next;
      setBlock(next);
      hideLoading();
      if (!duplicate) {
        onBlocked(state);
      }
    },
    [hideLoading, navigate, onBlocked],
  );

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
          if (Date.now() - loadingSince.current >= LOADING_STALE_MS) {
            hideLoading();
          } else {
            hideLoadingIn(LOADING_STALE_MS);
          }
          break;
        case 'OPEN_SEARCH':
          onSearch();
          break;
        default:
          onMessage(message);
      }
    },
    [
      handleBlocked,
      handleRoute,
      hideLoading,
      hideLoadingIn,
      onMessage,
      onSearch,
    ],
  );

  return (
    <View style={styles.fill}>
      <BrowserView
        ref={browser}
        initialUrl={initialUrl}
        service={INSTAGRAM_SERVICE_RULES}
        guardConfig={guardConfig}
        bottomInset={bottomInset}
        onExternalLink={onExternalLink}
        onRoute={handleRoute}
        onBlocked={handleBlocked}
        onMessage={handleMessage}
        onLoadStart={(url, isReload) => {
          const path = instagramPathFromUrl(url);
          const variant = path
            ? skeletonForRoute(routeKindForPath(path))
            : 'generic';
          if (isReload) {
            // Pull to refresh: the page's own spinner first; the skeleton
            // only if the reload takes a moment.
            reloadTimer.current = setTimeout(() => showLoading(variant), 350);
            return;
          }
          showLoading(variant);
        }}
        onLoadEnd={url => {
          if (instagramPathFromUrl(url)) {
            hideLoadingIn(LOADING_AFTER_LOAD_MS);
          } else {
            hideLoading();
          }
          onLoadEnd();
        }}
        onLoadError={code => {
          setOffline(true);
          hideLoading();
          onLoadError(code);
        }}
        onProcessTerminated={onProcessTerminated}
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
          lockedUntil={lockedUntil || undefined}
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
          onOpenNative={() => {
            onOpenNative(block.path);
            if (block.navigated) {
              browser.current?.leaveBlocked();
            } else {
              setBlock(null);
            }
          }}
        />
      ) : null}
    </View>
  );
}

export const InstagramPage = forwardRef(InstagramPageImpl);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
