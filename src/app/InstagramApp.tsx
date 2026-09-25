import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ScrollViewInstance } from 'react-native';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Controls, homePathFor } from '../controls/controls';
import { SearchUser, WebMessage } from '../filtering/engine/messages';
import {
  INSTAGRAM_INBOX_PATH,
  INSTAGRAM_ORIGIN,
  routeKindForPath,
} from '../filtering/instagram/routes';
import { profilePath } from '../filtering/instagram/search';
import { GuardConfig } from '../filtering/instagram/scripts';
import { BlockedOverlay } from '../screens/BlockedOverlay';
import { BlockState } from '../screens/BrowserView';
import { SearchResult, SearchScreen } from '../screens/SearchScreen';
import { InstagramPage, InstagramPageHandle } from './InstagramPage';

export type IgTab = 'feed' | 'reels' | 'messages' | 'search' | 'profile';

export const INSTAGRAM_REELS_PATH = '/reels/';
/** Instagram's own search page: light, and a start for the search tab. */
const SEARCH_PAGE_PATH = '/explore/search/';
const SEARCH_TIMEOUT_MS = 6000;
/** Other tabs load in the background once the first one is up. */
const PRELOAD_AFTER_MS = 1200;
const PRELOAD_STAGGER_MS = 700;

export type InstagramAppHandle = {
  /** A tab bar button: switch, or – on the current tab – go to its root. */
  pressTab: (tab: IgTab) => void;
  /** Open a path in the tab it belongs to. */
  openPath: (path: string) => void;
  pauseMedia: () => void;
  reloadActive: () => void;
  clearCaches: () => void;
  /** After clearing website data: every tab starts over. */
  restartAll: () => void;
  runSearch: (query: string) => Promise<SearchResult>;
};

type Props = {
  visible: boolean;
  guardConfig: GuardConfig;
  controls: Controls;
  ownProfilePath: string | null;
  reelsOpen: boolean;
  lockedUntil: number;
  tabBarSpace: number;
  /** Where the user was last time (restored into its tab). */
  restorePath: string | null;
  searchHistory: string[];
  onProfileSearched: (username: string) => void;
  onClearSearchHistory: () => void;
  onTabChange: (tab: IgTab) => void;
  onRoute: (tab: IgTab, path: string) => void;
  onMessage: (message: WebMessage) => void;
  onBlocked: (state: BlockState) => void;
  onLoadEnd: () => void;
  onLoadError: (code: number) => void;
  onProcessTerminated: () => void;
  onOpenNative: (path: string) => void;
  onExternalLink: (url: string) => boolean;
};

function isOwnProfile(path: string, own: string | null): boolean {
  return own !== null && path.toLowerCase().startsWith(own.toLowerCase());
}

/**
 * Instagram like the app: one page per tab, side by side. Swipe between
 * them or tap the tab bar; every tab keeps its place and nothing reloads.
 */
function InstagramAppImpl(
  {
    visible,
    guardConfig,
    controls,
    ownProfilePath,
    reelsOpen,
    lockedUntil,
    tabBarSpace,
    restorePath,
    searchHistory,
    onProfileSearched,
    onClearSearchHistory,
    onTabChange,
    onRoute,
    onMessage,
    onBlocked,
    onLoadEnd,
    onLoadError,
    onProcessTerminated,
    onOpenNative,
    onExternalLink,
  }: Props,
  ref: React.Ref<InstagramAppHandle>,
) {
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const pages = useRef<Partial<Record<IgTab, InstagramPageHandle | null>>>({});
  const homePath = homePathFor(controls);
  const hasFeed = controls.homeFeed !== 'off';

  // ---- tabs --------------------------------------------------------
  const tabs = useMemo<IgTab[]>(
    () => [
      ...(hasFeed ? (['feed'] as const) : []),
      ...(reelsOpen ? (['reels'] as const) : []),
      'messages',
      'search',
      ...(ownProfilePath ? (['profile'] as const) : []),
    ],
    [hasFeed, ownProfilePath, reelsOpen],
  );

  // Each tab's first URL, read once when its page is created.
  const initialUrls = useRef<Partial<Record<IgTab, string>>>({});
  const firstTab = useMemo<IgTab>(() => {
    const kind = restorePath ? routeKindForPath(restorePath) : null;
    if (restorePath && kind === 'direct') {
      initialUrls.current.messages = INSTAGRAM_ORIGIN + restorePath;
      return 'messages';
    }
    if (restorePath && isOwnProfile(restorePath, ownProfilePath)) {
      initialUrls.current.profile = INSTAGRAM_ORIGIN + restorePath;
      return 'profile';
    }
    if (!hasFeed) {
      return 'messages';
    }
    if (restorePath && restorePath !== '/') {
      initialUrls.current.feed = INSTAGRAM_ORIGIN + restorePath;
    }
    return 'feed';
    // Only the very first render decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const urlFor = (tab: IgTab): string => {
    if (!initialUrls.current[tab]) {
      const root =
        tab === 'feed'
          ? homePath
          : tab === 'reels'
          ? INSTAGRAM_REELS_PATH
          : tab === 'messages'
          ? INSTAGRAM_INBOX_PATH
          : tab === 'profile'
          ? ownProfilePath ?? '/'
          : SEARCH_PAGE_PATH;
      initialUrls.current[tab] = INSTAGRAM_ORIGIN + root;
    }
    return initialUrls.current[tab]!;
  };

  const [active, setActive] = useState<IgTab>(firstTab);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [mounted, setMounted] = useState<IgTab[]>([firstTab]);
  const mount = useCallback((tab: IgTab) => {
    setMounted(prev => (prev.includes(tab) ? prev : [...prev, tab]));
  }, []);
  const [paths, setPaths] = useState<Partial<Record<IgTab, string>>>({});
  // The search tab shows Focus's search until you open a result.
  const [searchOverlay, setSearchOverlay] = useState(true);
  const [hScroll, setHScroll] = useState(false);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    onTabChange(active);
  }, [active, onTabChange]);

  // Preload the other tabs once the first is up: then switching is instant.
  useEffect(() => {
    const timers = (['feed', 'messages', 'profile'] as IgTab[])
      .filter(tab => tabs.includes(tab))
      .map((tab, index) =>
        setTimeout(
          () => mount(tab),
          PRELOAD_AFTER_MS + index * PRELOAD_STAGGER_MS,
        ),
      );
    return () => timers.forEach(clearTimeout);
  }, [mount, tabs]);

  // Keep the pager on the active tab when tabs come and go (Reels).
  const indexOf = useCallback(
    (tab: IgTab) => Math.max(0, tabs.indexOf(tab)),
    [tabs],
  );
  useLayoutEffect(() => {
    pager.current?.scrollTo({ x: indexOf(active) * width, animated: false });
    // Only when the tab list or the width changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, width]);

  const goToTab = useCallback(
    (tab: IgTab, animated = true) => {
      mount(tab);
      setActive(tab);
      pager.current?.scrollTo({ x: indexOf(tab) * width, animated });
    },
    [indexOf, mount, width],
  );

  // A Reels window opens: its tab appears and opens. Time up: back home.
  const wasReelsOpen = useRef(reelsOpen);
  useEffect(() => {
    if (!wasReelsOpen.current && reelsOpen) {
      goToTab('reels');
    }
    if (wasReelsOpen.current && !reelsOpen) {
      delete initialUrls.current.reels;
      setMounted(prev => prev.filter(tab => tab !== 'reels'));
      if (activeRef.current === 'reels') {
        setActive(hasFeed ? 'feed' : 'messages');
        setTimeUp(true);
      }
    }
    wasReelsOpen.current = reelsOpen;
  }, [goToTab, hasFeed, reelsOpen]);

  const rootOf = (tab: IgTab): string =>
    tab === 'feed'
      ? homePath
      : tab === 'reels'
      ? INSTAGRAM_REELS_PATH
      : tab === 'messages'
      ? INSTAGRAM_INBOX_PATH
      : tab === 'profile'
      ? ownProfilePath ?? '/'
      : SEARCH_PAGE_PATH;

  const pressTab = (tab: IgTab) => {
    if (!tabs.includes(tab)) {
      return;
    }
    if (tab !== activeRef.current) {
      goToTab(tab);
      return;
    }
    if (tab === 'search') {
      setSearchOverlay(true);
      return;
    }
    // The tab you are on: back to its start, or up to the top.
    const page = pages.current[tab];
    const root = rootOf(tab);
    if (page && page.path() !== root.split('?')[0]) {
      page.navigate(root);
    } else {
      page?.scrollToTop();
    }
  };

  const openPath = (path: string) => {
    const kind = routeKindForPath(path.split('?')[0]);
    const tab: IgTab =
      kind === 'direct'
        ? 'messages'
        : isOwnProfile(path, ownProfilePath)
        ? 'profile'
        : /^\/reels?\//i.test(path) && reelsOpen
        ? 'reels'
        : activeRef.current === 'search'
        ? 'search'
        : hasFeed
        ? 'feed'
        : 'messages';
    if (tab === 'search') {
      setSearchOverlay(false);
    }
    if (!mounted.includes(tab)) {
      initialUrls.current[tab] = INSTAGRAM_ORIGIN + path;
      goToTab(tab);
      return;
    }
    goToTab(tab);
    pages.current[tab]?.navigate(path);
  };

  // ---- search (Instagram's own account search, via any page) ---------
  const pendingSearches = useRef(
    new Map<number, (result: SearchResult) => void>(),
  );
  const nextSearchId = useRef(1);
  const runSearch = useCallback((query: string) => {
    return new Promise<SearchResult>(resolve => {
      const id = nextSearchId.current++;
      const timer = setTimeout(() => {
        if (pendingSearches.current.delete(id)) {
          resolve({ ok: false, users: [] as SearchUser[] });
        }
      }, SEARCH_TIMEOUT_MS);
      pendingSearches.current.set(id, result => {
        clearTimeout(timer);
        resolve(result);
      });
      const page =
        pages.current[activeRef.current] ??
        Object.values(pages.current).find(Boolean);
      page?.search(query, id);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    pressTab,
    openPath,
    pauseMedia: () =>
      Object.values(pages.current).forEach(page => page?.pauseMedia()),
    reloadActive: () => pages.current[activeRef.current]?.reload(),
    clearCaches: () =>
      Object.values(pages.current).find(Boolean)?.clearCaches(),
    restartAll: () =>
      (Object.keys(pages.current) as IgTab[]).forEach(tab =>
        pages.current[tab]?.replaceWith(INSTAGRAM_ORIGIN + rootOf(tab)),
      ),
    runSearch,
  }));

  // ---- page events ---------------------------------------------------
  const handlers = useMemo(() => {
    const make = (tab: IgTab) => ({
      onRoute: (path: string) => {
        setPaths(prev =>
          prev[tab] === path ? prev : { ...prev, [tab]: path },
        );
        onRoute(tab, path);
      },
      onMessage: (message: WebMessage) => {
        if (message.type === 'SEARCH_RESULTS') {
          const resolve = pendingSearches.current.get(message.requestId);
          if (resolve) {
            pendingSearches.current.delete(message.requestId);
            resolve({ ok: message.ok, users: message.users });
          }
          return;
        }
        if (message.type === 'H_SCROLL') {
          setHScroll(message.active);
          return;
        }
        onMessage(message);
      },
      onSearch: () => {
        setSearchOverlay(true);
        goToTab('search');
      },
      ref: (handle: InstagramPageHandle | null) => {
        pages.current[tab] = handle;
      },
    });
    return {
      feed: make('feed'),
      reels: make('reels'),
      messages: make('messages'),
      search: make('search'),
      profile: make('profile'),
    };
  }, [goToTab, onMessage, onRoute]);

  const onPagerEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    const tab = tabs[Math.min(Math.max(index, 0), tabs.length - 1)];
    if (tab && tab !== activeRef.current) {
      mount(tab);
      setActive(tab);
    }
  };

  // No tab swiping inside a chat (the app has no tabs there either) or
  // while a carousel or the story tray is being swiped.
  const inChat =
    active === 'messages' && /^\/direct\/t\//i.test(paths.messages ?? '');
  const swipeable = visible && !inChat && !hScroll;

  return (
    <>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        scrollEnabled={swipeable}
        bounces={false}
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onMomentumScrollEnd={onPagerEnd}
        contentOffset={{ x: indexOf(firstTab) * width, y: 0 }}
        onLayout={event => setPageHeight(event.nativeEvent.layout.height)}
        style={styles.fill}
      >
        {tabs.map(tab => (
          <View key={tab} style={{ width, height: pageHeight }}>
            {mounted.includes(tab) ? (
              <InstagramPage
                ref={handlers[tab].ref}
                initialUrl={urlFor(tab)}
                guardConfig={guardConfig}
                bottomInset={tab === 'messages' && inChat ? 0 : tabBarSpace}
                lockedUntil={lockedUntil || undefined}
                onRoute={handlers[tab].onRoute}
                onMessage={handlers[tab].onMessage}
                onBlocked={onBlocked}
                onLoadEnd={onLoadEnd}
                onLoadError={onLoadError}
                onProcessTerminated={onProcessTerminated}
                onSearch={handlers[tab].onSearch}
                onOpenNative={onOpenNative}
                onExternalLink={onExternalLink}
              />
            ) : null}
            {tab === 'search' && searchOverlay ? (
              <SearchScreen
                visible={visible && active === 'search'}
                history={searchHistory}
                runSearch={runSearch}
                onOpenProfile={username => {
                  onProfileSearched(username);
                  openPath(profilePath(username));
                }}
                onOpenPath={openPath}
                onClearHistory={onClearSearchHistory}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
      {timeUp ? (
        <BlockedOverlay
          reason="reels"
          lockedUntil={lockedUntil || undefined}
          onBack={() => setTimeUp(false)}
          onSearch={() => setTimeUp(false)}
          onOpenNative={() => setTimeUp(false)}
        />
      ) : null}
    </>
  );
}

export const InstagramApp = forwardRef(InstagramAppImpl);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
