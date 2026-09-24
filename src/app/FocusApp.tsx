import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppState,
  Linking,
  Settings,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  blockReasonForPath,
  instagramPathFromUrl,
  isSafeRouteToPersist,
} from '../filtering/engine/RouteGuard';
import { Controls, homePathFor, policyFor } from '../controls/controls';
import {
  ReelsSession,
  endReelsSession,
  formatCountdown,
  parseReelsSession,
  reelsStatus,
  startReelsSession,
} from '../controls/reelsSession';
import { LimitStatus, limitStatus, settleLimit } from '../controls/limits';
import { SearchUser, WebMessage } from '../filtering/engine/messages';
import {
  GuardConfig,
  buildGuardConfig,
  buildRedditGuardConfig,
  buildXGuardConfig,
  buildYouTubeGuardConfig,
} from '../filtering/instagram/scripts';
import { youtubeHomePathFor } from '../controls/youtube';
import {
  YOUTUBE_ORIGIN,
  YOUTUBE_SERVICE_RULES,
} from '../filtering/youtube/routes';
import { LinkItem, LinkListScreen } from '../screens/LinkListScreen';
import { RedditHeader } from '../screens/RedditHeader';
import { WebSearchScreen, youtubeSearchPath } from '../screens/WebSearchScreen';
import { fetchYouTubeSuggestions } from '../search/youtubeSuggest';
import {
  addCommunity,
  parseCommunities,
  redditShortcuts,
  xShortcuts,
} from '../search/shortcuts';
import {
  X_HOME_PATH,
  X_MESSAGES_PATH,
  X_NOTIFICATIONS_PATH,
  X_ORIGIN,
  X_SERVICE_RULES,
  xSearchPath,
} from '../filtering/x/routes';
import {
  REDDIT_NOTIFICATIONS_PATH,
  REDDIT_ORIGIN,
  REDDIT_SERVICE_RULES,
  redditFeedPath,
  redditSearchPath,
  subredditFromPath,
} from '../filtering/reddit/routes';
import { ServiceRules } from '../filtering/engine/types';
import {
  SERVICE_IDS,
  ServiceId,
  WEB_APP_IDS,
  WebAppId,
} from '../services/services';
import { GateScreen } from '../screens/GateScreen';
import { ServiceBrowser, ServiceBrowserHandle } from './ServiceBrowser';
import {
  INSTAGRAM_INBOX_PATH,
  INSTAGRAM_ORIGIN,
  INSTAGRAM_SERVICE_RULES,
  routeKindForPath,
} from '../filtering/instagram/routes';
import { profilePath } from '../filtering/instagram/search';
import { BlockedOverlay } from '../screens/BlockedOverlay';
import { BlockState, BrowserHandle, BrowserView } from '../screens/BrowserView';
import { LoadingOverlay } from '../screens/LoadingOverlay';
import { OfflineOverlay } from '../screens/OfflineOverlay';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SearchResult, SearchScreen } from '../screens/SearchScreen';
import { FilterHealth, SettingsScreen } from '../screens/SettingsScreen';
import {
  Diagnostics,
  EMPTY_DIAGNOSTICS,
  parseDiagnostics,
} from '../storage/diagnostics';
import { STORAGE_KEYS, readJson, removeKeys, writeJson } from '../storage/kv';
import {
  addToSearchHistory,
  parseSearchHistory,
} from '../storage/searchHistory';
import {
  DEFAULT_SETTINGS,
  FocusSettings,
  parseSettings,
} from '../storage/settings';
import {
  SkeletonVariant,
  skeletonForRoute,
} from '../ui/skeleton/InstagramSkeleton';
import { INSTAGRAM_TABS, TabBar, TabId, WEB_APP_TABS } from '../ui/TabBar';
import {
  UsageLog,
  dayKey,
  formatDuration,
  parseUsageLog,
} from '../usage/usage';
import { useUsageTracker } from '../usage/useUsageTracker';
import { tabBarSpace, useTheme } from '../ui/theme';

/** Keys shared with AppDelegate.swift (NSUserDefaults). */
const CLEAR_REQUEST_KEY = 'FocusClearWebsiteDataRequest';
const CLEAR_DONE_KEY = 'FocusClearWebsiteDataDoneAt';

const FILTER_TIMEOUT_MS = 5000;
const SEARCH_TIMEOUT_MS = 6000;
/** Longest a loading skeleton may stay up, whatever happens. */
const LOADING_MAX_MS = 8000;
/** After the document itself loaded, the page gets this long to settle. */
const LOADING_AFTER_LOAD_MS = 1500;
/** PAGE_READY messages this soon after a new load began are leftovers. */
const LOADING_STALE_MS = 400;

const WEB_APP_RULES: Record<WebAppId, ServiceRules> = {
  youtube: YOUTUBE_SERVICE_RULES,
  x: X_SERVICE_RULES,
  reddit: REDDIT_SERVICE_RULES,
};

/** Coming back after this long counts as opening the app again. */
const RESUME_PAUSE_AFTER_MS = 5 * 60 * 1000;
/** How often the daily limit is checked while an app is open. */
const LIMIT_CHECK_MS = 5000;

type Screen = 'browser' | 'search' | 'settings' | 'library';

/** Native "Du" pages: places that the websites render unreliably. */
const LIBRARY: Partial<Record<WebAppId, { title: string; items: LinkItem[] }>> =
  {
    youtube: {
      title: 'Du',
      items: [
        { key: 'history', title: 'Verlauf', path: '/feed/history' },
        { key: 'wl', title: 'Später ansehen', path: '/playlist?list=WL' },
        { key: 'playlists', title: 'Playlists', path: '/feed/playlists' },
        { key: 'liked', title: 'Mag ich', path: '/playlist?list=LL' },
        {
          key: 'channels',
          title: 'Deine Kanäle (Abos)',
          path: '/feed/channels',
        },
      ],
    },
    reddit: {
      title: 'Du',
      items: [
        { key: 'profile', title: 'Profil', path: '/user/me/' },
        { key: 'saved', title: 'Gespeichert', path: '/user/me/saved/' },
        { key: 'settings', title: 'Einstellungen', path: '/settings/' },
      ],
    },
  };

type Gate = { app: ServiceId; mode: 'pause' | 'limit' };

type Loaded = {
  settings: FocusSettings;
  initialUrl: string;
  diagnostics: Diagnostics;
  searchHistory: string[];
  ownProfilePath: string | null;
  usageLog: UsageLog;
  appUsage: Record<ServiceId, UsageLog>;
  communities: string[];
  subscriptions: string[];
  reelsSession: ReelsSession | null;
};

const INSTAGRAM_REELS_PATH = '/reels/';

function isReelsPath(path: string): boolean {
  return /^\/reels?(\/|$)/i.test(path);
}

/** Whether `path` is the signed-in user's profile or one of its tabs. */
function isOwnProfile(path: string, ownPath: string | null): boolean {
  return (
    ownPath !== null && path.toLowerCase().startsWith(ownPath.toLowerCase())
  );
}

async function loadState(): Promise<Loaded> {
  const [
    rawSettings,
    rawRoute,
    rawDiagnostics,
    rawHistory,
    rawProfile,
    rawUsage,
    rawReels,
    rawUsageInstagram,
    rawUsageYouTube,
    rawUsageX,
    rawUsageReddit,
    rawCommunities,
    rawSubscriptions,
  ] = await Promise.all([
    readJson(STORAGE_KEYS.settings),
    readJson(STORAGE_KEYS.lastRoute),
    readJson(STORAGE_KEYS.diagnostics),
    readJson(STORAGE_KEYS.searchHistory),
    readJson(STORAGE_KEYS.ownProfile),
    readJson(STORAGE_KEYS.usage),
    readJson(STORAGE_KEYS.reelsSession),
    readJson(STORAGE_KEYS.usageInstagram),
    readJson(STORAGE_KEYS.usageYouTube),
    readJson(STORAGE_KEYS.usageX),
    readJson(STORAGE_KEYS.usageReddit),
    readJson(STORAGE_KEYS.redditCommunities),
    readJson(STORAGE_KEYS.redditSubscriptions),
  ]);
  const parsedSettings = parseSettings(rawSettings);
  const now = Date.now();
  const settings = {
    ...parsedSettings,
    limits: {
      instagram: settleLimit(parsedSettings.limits.instagram, now),
      youtube: settleLimit(parsedSettings.limits.youtube, now),
      x: settleLimit(parsedSettings.limits.x, now),
      reddit: settleLimit(parsedSettings.limits.reddit, now),
    },
  };
  const restore =
    settings.keepLastLocation &&
    typeof rawRoute === 'string' &&
    isSafeRouteToPersist(rawRoute, policyFor(settings.controls));
  return {
    settings,
    initialUrl:
      INSTAGRAM_ORIGIN +
      // "/" is restored as the mode's home (e.g. the Following feed).
      (restore && rawRoute !== '/' ? rawRoute : homePathFor(settings.controls)),
    diagnostics: parseDiagnostics(rawDiagnostics),
    searchHistory: parseSearchHistory(rawHistory),
    ownProfilePath:
      typeof rawProfile === 'string' &&
      routeKindForPath(rawProfile) === 'profile'
        ? rawProfile
        : null,
    usageLog: parseUsageLog(rawUsage),
    appUsage: {
      instagram: parseUsageLog(rawUsageInstagram),
      youtube: parseUsageLog(rawUsageYouTube),
      x: parseUsageLog(rawUsageX),
      reddit: parseUsageLog(rawUsageReddit),
    },
    communities: parseCommunities(rawCommunities),
    subscriptions: parseCommunities(rawSubscriptions),
    reelsSession: parseReelsSession(rawReels, Date.now()),
  };
}

export default function FocusApp() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    loadState().then(setLoaded);
  }, []);

  return (
    <SafeAreaProvider>
      {loaded ? <FocusShell initial={loaded} /> : <Blank />}
    </SafeAreaProvider>
  );
}

function Blank() {
  const theme = useTheme();
  return <View style={[styles.fill, { backgroundColor: theme.background }]} />;
}

function FocusShell({ initial }: { initial: Loaded }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const browser = useRef<BrowserHandle>(null);

  const [settings, setSettings] = useState(initial.settings);
  const [diagnostics, setDiagnostics] = useState(initial.diagnostics);
  const [searchHistory, setSearchHistory] = useState(initial.searchHistory);
  const [ownProfilePath, setOwnProfilePath] = useState(initial.ownProfilePath);
  // Read once when the WebView mounts (after onboarding on first launch).
  const [startUrl, setStartUrl] = useState(initial.initialUrl);
  const [screen, setScreen] = useState<Screen>(
    initial.settings.openLastAppOnLaunch ? 'browser' : 'settings',
  );
  const initialPath = instagramPathFromUrl(initial.initialUrl) ?? '/';
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const [block, setBlock] = useState<BlockState | null>(null);
  const [health, setHealth] = useState<FilterHealth>('starting');
  const [offline, setOffline] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Scrolling down makes the tab bar a little smaller (like the apps).
  const [compactBar, setCompactBar] = useState(false);

  // ---- timed Reels ---------------------------------------------------
  const [reelsSession, setReelsSession] = useState(initial.reelsSession);
  const [now, setNow] = useState(() => Date.now());
  const reels = reelsStatus(reelsSession, now);
  const reelsOpen = reels.state === 'active' && settings.controls.blockReels;
  const lockedUntil = reels.state === 'locked' ? reels.until : 0;
  // The controls Instagram actually runs with: Reels unblocked only while
  // a window is open. The stored controls never change.
  const effectiveControls = useMemo(
    () =>
      reelsOpen
        ? { ...settings.controls, blockReels: false }
        : settings.controls,
    [reelsOpen, settings.controls],
  );

  const instagramGuardConfig = useMemo(
    () => buildGuardConfig(effectiveControls, settings.grayscale),
    [effectiveControls, settings.grayscale],
  );

  // ---- other apps ------------------------------------------------------
  const [activeService, setActiveService] = useState<ServiceId>(
    initial.settings.lastService,
  );
  // An app's WebView is created the first time it is opened, then kept.
  const [opened, setOpened] = useState<ServiceId[]>([
    initial.settings.lastService,
  ]);
  // YouTube, X and Reddit: one generic browser each.
  const webRefs = useRef<Record<WebAppId, ServiceBrowserHandle | null>>({
    youtube: null,
    x: null,
    reddit: null,
  });
  const setWebRef = useMemo(() => {
    const make = (id: WebAppId) => (handle: ServiceBrowserHandle | null) => {
      webRefs.current[id] = handle;
    };
    return { youtube: make('youtube'), x: make('x'), reddit: make('reddit') };
  }, []);
  const [webPaths, setWebPaths] = useState<Record<WebAppId, string>>({
    youtube: '/',
    x: '/',
    reddit: '/',
  });
  // Read once: a WebView keeps its page, later changes never reload it.
  const [webInitialUrls] = useState<Record<WebAppId, string>>(() => ({
    youtube: YOUTUBE_ORIGIN + youtubeHomePathFor(initial.settings.youtube),
    x: X_ORIGIN + X_HOME_PATH,
    reddit:
      REDDIT_ORIGIN +
      (redditFeedPath(
        initial.subscriptions.length
          ? initial.subscriptions
          : initial.communities,
      ) ?? REDDIT_NOTIFICATIONS_PATH),
  }));
  const [communities, setCommunities] = useState(initial.communities);
  const [subscriptions, setSubscriptions] = useState(initial.subscriptions);
  // Reddit's home in Focus: the combined feed of the communities you
  // joined (or, until Reddit told us, the ones you opened) – no suggestions.
  const redditHomePath = redditFeedPath(
    subscriptions.length ? subscriptions : communities,
  );
  const onRedditMessage = useCallback((message: WebMessage) => {
    if (message.type !== 'SUBSCRIPTIONS') {
      return;
    }
    setSubscriptions(prev => {
      if (prev.join('+') === message.names.join('+')) {
        return prev;
      }
      writeJson(STORAGE_KEYS.redditSubscriptions, message.names);
      return message.names;
    });
  }, []);
  const webGuardConfigs = useMemo<Record<WebAppId, GuardConfig>>(
    () => ({
      youtube: buildYouTubeGuardConfig(settings.youtube, settings.grayscale),
      x: buildXGuardConfig(settings.x, settings.grayscale),
      reddit: buildRedditGuardConfig(settings.grayscale, redditHomePath),
    }),
    [settings.youtube, settings.x, settings.grayscale, redditHomePath],
  );
  const [recentQueries, setRecentQueries] = useState<
    Record<WebAppId, string[]>
  >({ youtube: [], x: [], reddit: [] });
  const onWebRoute = useMemo(() => {
    const make = (id: WebAppId) => (path: string) => {
      setCompactBar(false);
      setWebPaths(prev => (prev[id] === path ? prev : { ...prev, [id]: path }));
      const community = id === 'reddit' ? subredditFromPath(path) : null;
      if (community) {
        setCommunities(prev => {
          if (prev[0]?.toLowerCase() === community.toLowerCase()) {
            return prev;
          }
          const next = addCommunity(prev, community);
          writeJson(STORAGE_KEYS.redditCommunities, next);
          return next;
        });
      }
    };
    return { youtube: make('youtube'), x: make('x'), reddit: make('reddit') };
  }, []);

  // Tick every second while a window runs (countdown + exact stop); wake up
  // once when a lockout ends; re-check whenever the app comes back.
  useEffect(() => {
    if (reels.state === 'active') {
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }
    if (lockedUntil) {
      const timer = setTimeout(
        () => setNow(Date.now()),
        lockedUntil - Date.now() + 50,
      );
      return () => clearTimeout(timer);
    }
  }, [reels.state, lockedUntil]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(Date.now());
      }
    });
    return () => subscription.remove();
  }, []);

  const saveReelsSession = useCallback((next: ReelsSession | null) => {
    setReelsSession(next);
    setNow(Date.now());
    if (next) {
      writeJson(STORAGE_KEYS.reelsSession, next);
    } else {
      removeKeys([STORAGE_KEYS.reelsSession]);
    }
  }, []);
  const [loading, setLoading] = useState<SkeletonVariant | null>(
    skeletonForRoute(routeKindForPath(initialPath)),
  );

  // ---- pause before opening, daily limits -----------------------------
  const [gate, setGate] = useState<Gate | null>(() => {
    const s = initial.settings;
    if (!s.onboardingComplete || !s.openLastAppOnLaunch) {
      return null;
    }
    const app = s.lastService;
    const time = Date.now();
    const used = initial.appUsage[app][dayKey(time)] ?? 0;
    if (limitStatus(s.limits[app], used, time).state === 'reached') {
      return { app, mode: 'limit' };
    }
    return s.pauseSeconds > 0 ? { app, mode: 'pause' } : null;
  });

  const inApp =
    settings.onboardingComplete && screen === 'browser' && gate === null;
  const usage = useUsageTracker(initial.usageLog, settings.trackUsage && inApp);
  // Per app, for the daily limits (also when the total is not shown).
  const instagramUsage = useUsageTracker(
    initial.appUsage.instagram,
    inApp &&
      activeService === 'instagram' &&
      (settings.trackUsage || settings.limits.instagram.minutes !== null),
    STORAGE_KEYS.usageInstagram,
  );
  const youtubeUsage = useUsageTracker(
    initial.appUsage.youtube,
    inApp &&
      activeService === 'youtube' &&
      (settings.trackUsage || settings.limits.youtube.minutes !== null),
    STORAGE_KEYS.usageYouTube,
  );
  const xUsage = useUsageTracker(
    initial.appUsage.x,
    inApp &&
      activeService === 'x' &&
      (settings.trackUsage || settings.limits.x.minutes !== null),
    STORAGE_KEYS.usageX,
  );
  const redditUsage = useUsageTracker(
    initial.appUsage.reddit,
    inApp &&
      activeService === 'reddit' &&
      (settings.trackUsage || settings.limits.reddit.minutes !== null),
    STORAGE_KEYS.usageReddit,
  );
  const appUsage = {
    instagram: instagramUsage,
    youtube: youtubeUsage,
    x: xUsage,
    reddit: redditUsage,
  };
  const appLimit = (app: ServiceId, time = Date.now()): LimitStatus =>
    limitStatus(settings.limits[app], appUsage[app].todaySeconds(time), time);
  // For timers and listeners, which must not restart on every render.
  const appLimitRef = useRef(appLimit);
  appLimitRef.current = appLimit;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---- persistence helpers -------------------------------------------

  const updateSettings = useCallback((patch: Partial<FocusSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      writeJson(STORAGE_KEYS.settings, next);
      if (patch.keepLastLocation === false) {
        removeKeys([STORAGE_KEYS.lastRoute]);
      }
      return next;
    });
  }, []);

  const diagnosticsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateDiagnostics = useCallback(
    (change: (prev: Diagnostics) => Diagnostics) => {
      setDiagnostics(prev => {
        const next = change(prev);
        if (diagnosticsTimer.current) {
          clearTimeout(diagnosticsTimer.current);
        }
        diagnosticsTimer.current = setTimeout(
          () => writeJson(STORAGE_KEYS.diagnostics, next),
          1000,
        );
        return next;
      });
    },
    [],
  );

  const routeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rememberRoute = useCallback((path: string) => {
    const { keepLastLocation, controls } = settingsRef.current;
    if (!keepLastLocation || !isSafeRouteToPersist(path, policyFor(controls))) {
      return;
    }
    if (routeTimer.current) {
      clearTimeout(routeTimer.current);
    }
    routeTimer.current = setTimeout(
      () => writeJson(STORAGE_KEYS.lastRoute, path),
      800,
    );
  }, []);

  // ---- loading skeleton ----------------------------------------------

  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingSince = useRef(Date.now());

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideLoading = useCallback(() => {
    if (reloadTimer.current) {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
    }
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
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

  useEffect(() => {
    hideLoadingIn(LOADING_MAX_MS);
  }, [hideLoadingIn]);

  // ---- browser events ------------------------------------------------

  const handleRoute = useCallback(
    (path: string) => {
      setCompactBar(false);
      setCurrentPath(prev => (prev === path ? prev : path));
      setBlock(null);
      setOffline(false);
      rememberRoute(path);
      if (routeKindForPath(path) === 'other') {
        updateDiagnostics(prev =>
          prev.lastUnknownRoute?.path === path
            ? prev
            : { ...prev, lastUnknownRoute: { path, at: Date.now() } },
        );
      }
    },
    [rememberRoute, updateDiagnostics],
  );

  const blockRef = useRef<BlockState | null>(null);
  blockRef.current = block;

  const openPathRef = useRef<(path: string) => void>(() => {});

  const handleBlocked = useCallback(
    (state: BlockState) => {
      if (state.reason === 'feed') {
        // "Messages only" has no home: go to the inbox instead of a block
        // screen. When the page is already on /, the guard redirects itself.
        if (!state.navigated) {
          openPathRef.current(INSTAGRAM_INBOX_PATH);
        }
        return;
      }
      const prev = blockRef.current;
      const duplicate =
        prev !== null &&
        prev.path === state.path &&
        prev.reason === state.reason;
      // The page and the native navigation callback can both report the
      // same event; "navigated" wins because it needs a real way back.
      const next =
        duplicate && (prev.navigated || !state.navigated) ? prev : state;
      blockRef.current = next;
      setBlock(next);
      hideLoading();
      setScreen('browser');
      if (!duplicate) {
        updateDiagnostics(d => ({
          ...d,
          blockedCount: d.blockedCount + 1,
          lastBlocked: {
            path: state.path,
            reason: state.reason,
            at: Date.now(),
          },
        }));
      }
    },
    [hideLoading, updateDiagnostics],
  );

  const pendingSearches = useRef(
    new Map<number, (result: SearchResult) => void>(),
  );
  const nextSearchId = useRef(1);

  const handleMessage = useCallback(
    (message: WebMessage) => {
      switch (message.type) {
        case 'FILTER_READY':
          setHealth('active');
          updateDiagnostics(prev => ({
            ...prev,
            lastFilterReadyAt: Date.now(),
          }));
          break;
        case 'FILTER_ERROR':
          updateDiagnostics(prev => ({
            ...prev,
            lastError: { code: message.code, at: Date.now() },
          }));
          break;
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
        case 'CONTENT_HIDDEN':
          updateDiagnostics(prev =>
            message.kind === 'sponsored'
              ? { ...prev, hiddenSponsored: prev.hiddenSponsored + 1 }
              : { ...prev, hiddenSuggested: prev.hiddenSuggested + 1 },
          );
          break;
        case 'OWN_PROFILE':
          setOwnProfilePath(prev => {
            if (prev !== message.path) {
              writeJson(STORAGE_KEYS.ownProfile, message.path);
            }
            return message.path;
          });
          break;
        case 'OPEN_SEARCH':
          setScreen('search');
          break;
        case 'SCROLL_STATE':
          setCompactBar(message.compact);
          break;
        case 'SWIPE':
          swipeRef.current(message.direction);
          break;
        case 'SEARCH_RESULTS': {
          const resolve = pendingSearches.current.get(message.requestId);
          if (resolve) {
            pendingSearches.current.delete(message.requestId);
            resolve({ ok: message.ok, users: message.users });
          }
          break;
        }
      }
    },
    [handleBlocked, handleRoute, hideLoading, hideLoadingIn, updateDiagnostics],
  );

  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLoadStart = useCallback(
    (url: string, isReload: boolean) => {
      setHealth(prev => (prev === 'active' ? prev : 'starting'));
      const path = instagramPathFromUrl(url);
      const variant = path
        ? skeletonForRoute(routeKindForPath(path))
        : 'generic';
      if (isReload) {
        // Pull-to-refresh: let the page's own spinner show first; only if
        // the reload takes a moment does the skeleton take over.
        reloadTimer.current = setTimeout(() => showLoading(variant), 350);
        return;
      }
      showLoading(variant);
    },
    [showLoading],
  );
  const handleLoadEnd = useCallback(
    (url: string) => {
      // Only Instagram pages report PAGE_READY; others are done when loaded.
      if (instagramPathFromUrl(url)) {
        hideLoadingIn(LOADING_AFTER_LOAD_MS);
      } else {
        hideLoading();
      }
      if (filterTimer.current) {
        clearTimeout(filterTimer.current);
      }
      filterTimer.current = setTimeout(() => {
        setHealth(prev => {
          if (prev === 'starting') {
            updateDiagnostics(d => ({
              ...d,
              lastError: { code: 'FILTER_TIMEOUT', at: Date.now() },
            }));
            return 'noResponse';
          }
          return prev;
        });
      }, FILTER_TIMEOUT_MS);
    },
    [hideLoading, hideLoadingIn, updateDiagnostics],
  );

  const handleLoadError = useCallback(
    (code: number) => {
      setOffline(true);
      hideLoading();
      updateDiagnostics(prev => ({
        ...prev,
        lastError: { code: `LOAD_ERROR_${Math.abs(code)}`, at: Date.now() },
      }));
    },
    [hideLoading, updateDiagnostics],
  );

  const handleProcessTerminated = useCallback(() => {
    setHealth('starting');
    updateDiagnostics(prev => ({
      ...prev,
      webProcessRestarts: prev.webProcessRestarts + 1,
    }));
  }, [updateDiagnostics]);

  // ---- actions -------------------------------------------------------

  const openPath = useCallback(
    (path: string) => {
      setBlock(null);
      setScreen('browser');
      const pathname = path.split('?')[0];
      if (pathname.toLowerCase() !== currentPathRef.current.toLowerCase()) {
        showLoading(skeletonForRoute(routeKindForPath(pathname)));
      }
      browser.current?.navigate(path);
    },
    [showLoading],
  );
  openPathRef.current = openPath;

  // Like the app: swipe left on the feed for messages, right to go back.
  const swipeRef = useRef<(direction: 'left' | 'right') => void>(() => {});
  swipeRef.current = direction => {
    const { homeFeed } = settings.controls;
    if (screen !== 'browser' || block || homeFeed === 'off') {
      return;
    }
    const kind = routeKindForPath(currentPath);
    if (direction === 'left' && kind === 'home') {
      openPath(INSTAGRAM_INBOX_PATH);
    } else if (
      direction === 'right' &&
      currentPath.replace(/\/?$/, '/') === INSTAGRAM_INBOX_PATH
    ) {
      openPath(homePathFor(settings.controls));
    }
  };

  // Opening Reels waits for the render in which they are unblocked, so the
  // WebView is reconfigured before it navigates there.
  const openReelsWhenReady = useRef(false);
  useEffect(() => {
    if (reelsOpen && openReelsWhenReady.current) {
      openReelsWhenReady.current = false;
      openPath(INSTAGRAM_REELS_PATH);
    }
  }, [openPath, reelsOpen]);

  const startReels = useCallback(
    (minutes: number) => {
      const next = startReelsSession(reelsSession, minutes, Date.now());
      if (next) {
        openReelsWhenReady.current = true;
        saveReelsSession(next);
      }
    },
    [reelsSession, saveReelsSession],
  );

  const endReels = useCallback(() => {
    saveReelsSession(endReelsSession(reelsSession, Date.now()));
  }, [reelsSession, saveReelsSession]);

  // Time is up: stop at once, without waiting for the page to notice.
  // The guard is reconfigured in the same render and pauses all media.
  const wasReelsOpen = useRef(reelsOpen);
  useEffect(() => {
    if (wasReelsOpen.current && !reelsOpen) {
      const path = currentPathRef.current;
      const reason = blockReasonForPath(path, policyFor(settings.controls));
      if (reason) {
        handleBlocked({ reason, path, navigated: true });
      }
    }
    wasReelsOpen.current = reelsOpen;
  }, [handleBlocked, reelsOpen, settings.controls]);

  const openProfile = useCallback(
    (username: string) => {
      setSearchHistory(prev => {
        const next = addToSearchHistory(prev, username);
        writeJson(STORAGE_KEYS.searchHistory, next);
        return next;
      });
      openPath(profilePath(username));
    },
    [openPath],
  );

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    removeKeys([STORAGE_KEYS.searchHistory]);
  }, []);

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
      browser.current?.search(query, id);
    });
  }, []);

  const onTab = useCallback(
    (tab: TabId) => {
      const kind = routeKindForPath(currentPath);
      const onBrowser = screen === 'browser' && !block;
      // Tapping the tab you are already on scrolls to the top (iOS
      // convention); otherwise go to the tab's root page.
      const goTo = (root: string, belongs: boolean) => {
        if (screen !== 'browser' && belongs && !block) {
          setScreen('browser');
        } else if (onBrowser && currentPath === root.split('?')[0]) {
          browser.current?.scrollToTop();
        } else {
          openPath(root);
        }
      };
      switch (tab) {
        case 'feed':
          goTo(
            homePathFor(settings.controls),
            kind !== 'direct' && !isOwnProfile(currentPath, ownProfilePath),
          );
          break;
        case 'messages':
          goTo(INSTAGRAM_INBOX_PATH, kind === 'direct');
          break;
        case 'profile':
          if (ownProfilePath) {
            goTo(ownProfilePath, isOwnProfile(currentPath, ownProfilePath));
          }
          break;
        case 'reels':
          goTo(INSTAGRAM_REELS_PATH, isReelsPath(currentPath));
          break;
        case 'search':
          setScreen('search');
          break;
        case 'focus':
          setScreen('settings');
          break;
      }
    },
    [block, currentPath, openPath, ownProfilePath, screen, settings.controls],
  );

  const pauseMediaOf = useCallback((app: ServiceId) => {
    if (app === 'instagram') {
      browser.current?.pauseMedia();
    } else {
      webRefs.current[app]?.pauseMedia();
    }
  }, []);

  const selectService = useCallback(
    (id: ServiceId) => {
      // Nothing keeps playing in an app you left.
      if (id !== activeService) {
        pauseMediaOf(activeService);
      }
      setActiveService(id);
      setCompactBar(false);
      setOpened(prev => (prev.includes(id) ? prev : [...prev, id]));
      updateSettings({ lastService: id });
      // Reddit starts on Focus's own start (your communities) until you
      // have opened something there.
      setScreen(
        id === 'reddit' && !opened.includes('reddit') && !redditHomePath
          ? 'search'
          : 'browser',
      );
    },
    [activeService, opened, pauseMediaOf, redditHomePath, updateSettings],
  );

  /** Opening an app from the Focus home: daily limit first, then the pause. */
  const openApp = useCallback(
    (id: ServiceId) => {
      if (appLimitRef.current(id).state === 'reached') {
        setGate({ app: id, mode: 'limit' });
        return;
      }
      selectService(id);
      if (settingsRef.current.pauseSeconds > 0) {
        setGate({ app: id, mode: 'pause' });
      }
    },
    [selectService],
  );

  const leaveGate = useCallback(() => {
    if (gate) {
      pauseMediaOf(gate.app);
    }
    setGate(null);
    setScreen('settings');
  }, [gate, pauseMediaOf]);

  // Limit reached while the app is open (or lowered below today's time):
  // close it at once.
  const usingApp =
    settings.onboardingComplete && screen !== 'settings' && gate === null;
  useEffect(() => {
    if (!usingApp) {
      return;
    }
    const check = () => {
      if (appLimitRef.current(activeService).state === 'reached') {
        pauseMediaOf(activeService);
        setGate({ app: activeService, mode: 'limit' });
      }
    };
    check();
    const timer = setInterval(check, LIMIT_CHECK_MS);
    return () => clearInterval(timer);
  }, [usingApp, activeService, pauseMediaOf, settings.limits]);

  // Coming back after a while is opening the app again: same pause.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const activeServiceRef = useRef(activeService);
  activeServiceRef.current = activeService;
  useEffect(() => {
    let backgroundAt: number | null = null;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        backgroundAt = Date.now();
        return;
      }
      if (state !== 'active' || backgroundAt === null) {
        return;
      }
      const away = Date.now() - backgroundAt;
      backgroundAt = null;
      if (away < RESUME_PAUSE_AFTER_MS || screenRef.current === 'settings') {
        return;
      }
      const app = activeServiceRef.current;
      if (appLimitRef.current(app).state === 'reached') {
        setGate({ app, mode: 'limit' });
      } else if (settingsRef.current.pauseSeconds > 0) {
        setGate(prev => prev ?? { app, mode: 'pause' });
      }
    });
    return () => subscription.remove();
  }, []);

  /** Opens `path` in a web app, or scrolls up if it is already there. */
  const goWeb = useCallback(
    (app: WebAppId, path: string) => {
      const here = webPaths[app] === path.split('?')[0];
      if (screen === 'browser' && here) {
        webRefs.current[app]?.scrollToTop();
        return;
      }
      setScreen('browser');
      if (!here) {
        webRefs.current[app]?.navigate(path);
      }
    },
    [screen, webPaths],
  );

  const onWebTab = useCallback(
    (tab: TabId) => {
      switch (tab) {
        case 'ytHome':
          if (settings.youtube.home === 'search') {
            setScreen('search');
          } else {
            goWeb('youtube', youtubeHomePathFor(settings.youtube));
          }
          break;
        case 'ytYou':
        case 'rProfile':
          setScreen('library');
          break;
        case 'xHome':
          goWeb('x', X_HOME_PATH);
          break;
        case 'xNotifications':
          goWeb('x', X_NOTIFICATIONS_PATH);
          break;
        case 'xMessages':
          goWeb('x', X_MESSAGES_PATH);
          break;
        case 'rNotifications':
          goWeb('reddit', REDDIT_NOTIFICATIONS_PATH);
          break;
        case 'rHome':
          if (redditHomePath) {
            goWeb('reddit', redditHomePath);
          } else {
            setScreen('search');
          }
          break;
        case 'ytSearch':
        case 'xSearch':
          setScreen('search');
          break;
        case 'focus':
          setScreen('settings');
          break;
      }
    },
    [goWeb, redditHomePath, settings.youtube],
  );

  const leaveBlock = useCallback(() => {
    if (block?.navigated) {
      browser.current?.leaveBlocked();
    } else {
      setBlock(null);
    }
  }, [block]);

  const openInstagramApp = useCallback(() => {
    Linking.openURL('instagram://app').catch(() =>
      Linking.openURL(INSTAGRAM_ORIGIN).catch(() => {}),
    );
  }, []);

  const openBlockedNatively = useCallback(() => {
    if (block) {
      Linking.openURL(INSTAGRAM_ORIGIN + block.path).catch(() => {});
    }
    leaveBlock();
  }, [block, leaveBlock]);

  const clearWebsiteData = useCallback(() => {
    Alert.alert(
      'Instagram-Websitedaten löschen?',
      'Cookies, Cache und dein Login in Focus werden entfernt. Deine Focus-Einstellungen bleiben.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            setClearing(true);
            browser.current?.clearCaches();
            removeKeys([STORAGE_KEYS.lastRoute, STORAGE_KEYS.ownProfile]);
            setOwnProfilePath(null);

            let finished = false;
            const finish = (complete: boolean) => {
              if (finished) {
                return;
              }
              finished = true;
              Settings.clearWatch(watchId);
              clearTimeout(timeout);
              setClearing(false);
              browser.current?.replaceWith(
                INSTAGRAM_ORIGIN + homePathFor(settingsRef.current.controls),
              );
              Alert.alert(
                complete ? 'Gelöscht' : 'Teilweise gelöscht',
                complete
                  ? 'Instagram startet neu. Melde dich wieder an.'
                  : 'Der Cache wurde geleert, Cookies eventuell nicht. Starte Focus neu, um das Löschen abzuschließen.',
              );
            };
            const watchId = Settings.watchKeys([CLEAR_DONE_KEY], () =>
              finish(true),
            );
            const timeout = setTimeout(() => finish(false), 8000);
            Settings.set({ [CLEAR_REQUEST_KEY]: true });
          },
        },
      ],
    );
  }, []);

  const resetSettings = useCallback(() => {
    Alert.alert(
      'Focus zurücksetzen?',
      'Alle Focus-Einstellungen, der Suchverlauf und der gemerkte Ort werden zurückgesetzt. Dein Instagram-Login bleibt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: () => {
            const next = { ...DEFAULT_SETTINGS, onboardingComplete: true };
            setSettings(next);
            writeJson(STORAGE_KEYS.settings, next);
            setSearchHistory([]);
            removeKeys([STORAGE_KEYS.lastRoute, STORAGE_KEYS.searchHistory]);
          },
        },
      ],
    );
  }, []);

  const resetDiagnostics = useCallback(() => {
    updateDiagnostics(prev => ({
      ...EMPTY_DIAGNOSTICS,
      lastFilterReadyAt: prev.lastFilterReadyAt,
    }));
  }, [updateDiagnostics]);

  // ---- render --------------------------------------------------------

  if (!settings.onboardingComplete) {
    return (
      <>
        <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
        <OnboardingScreen
          onContinue={(controls: Controls) => {
            updateSettings({ onboardingComplete: true, controls });
            setStartUrl(INSTAGRAM_ORIGIN + homePathFor(controls));
            setScreen('browser');
          }}
        />
      </>
    );
  }

  // Like Instagram's app: no tab bar inside a chat, where the composer
  // sits at the bottom of the screen.
  const onInstagram = activeService === 'instagram';
  // Like the apps themselves: no tab bar where a composer sits at the
  // bottom (Instagram and X chats, writing a post on X).
  const showTabBar = !(
    screen === 'browser' &&
    ((onInstagram && !block && /^\/direct\/t\//i.test(currentPath)) ||
      (activeService === 'x' &&
        /^\/(?:messages\/.+|compose\/)/.test(webPaths.x)))
  );
  const tabSpace = tabBarSpace(insets.bottom);

  const appBadges: Partial<Record<ServiceId, string>> = {};
  for (const id of SERVICE_IDS) {
    const status = appLimit(id);
    if (status.state === 'reached') {
      appBadges[id] = 'Limit erreicht';
    } else if (status.state === 'ok') {
      appBadges[id] = `noch ${formatDuration(status.remainingSeconds)}`;
    }
  }

  const searchSetup = (app: WebAppId) => {
    switch (app) {
      case 'youtube':
        return {
          title: 'Suche',
          placeholder: 'YouTube durchsuchen',
          searchPath: youtubeSearchPath,
          suggest: fetchYouTubeSuggestions,
        };
      case 'x':
        return {
          title: 'Suche',
          placeholder: 'X durchsuchen oder @name',
          searchPath: xSearchPath,
          shortcuts: xShortcuts,
        };
      case 'reddit':
        return {
          title: 'Communities',
          placeholder: 'Community, u/name oder Suchbegriff',
          searchPath: redditSearchPath,
          shortcuts: redditShortcuts,
          saved: {
            title: subscriptions.length ? 'Beigetreten' : 'Zuletzt geöffnet',
            items: (subscriptions.length ? subscriptions : communities).map(
              name => ({
                key: name,
                title: `r/${name}`,
                path: `/r/${name}/`,
              }),
            ),
          },
        };
    }
  };

  const webTab = (app: WebAppId): TabId => {
    const path = webPaths[app];
    if (screen === 'settings') {
      return 'focus';
    }
    switch (app) {
      case 'youtube':
        if (screen === 'search') {
          return 'ytSearch';
        }
        return screen === 'library' ||
          /^\/(?:feed\/(?:you|library|history|playlists|channels)|playlist)/.test(
            path,
          )
          ? 'ytYou'
          : 'ytHome';
      case 'x':
        if (screen === 'search') {
          return 'xSearch';
        }
        return path.startsWith(X_NOTIFICATIONS_PATH)
          ? 'xNotifications'
          : path.startsWith(X_MESSAGES_PATH)
          ? 'xMessages'
          : 'xHome';
      case 'reddit':
        if (screen === 'search') {
          return 'rHome';
        }
        return screen === 'library' || /^\/(?:user\/me|settings)/.test(path)
          ? 'rProfile'
          : path.startsWith(REDDIT_NOTIFICATIONS_PATH)
          ? 'rNotifications'
          : 'rHome';
    }
  };

  const instagramTab: TabId =
    screen === 'search'
      ? 'search'
      : screen === 'settings'
      ? 'focus'
      : block
      ? 'feed'
      : isReelsPath(currentPath)
      ? 'reels'
      : routeKindForPath(currentPath) === 'direct'
      ? 'messages'
      : isOwnProfile(currentPath, ownProfilePath)
      ? 'profile'
      : 'feed';

  return (
    <View style={[styles.fill, { backgroundColor: theme.webBackground }]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Every app's WebView stays mounted; only the active one is shown. */}
      <View
        pointerEvents={onInstagram ? 'auto' : 'none'}
        style={[
          styles.browser,
          // Full height: the page scrolls underneath the floating tab bar.
          { top: insets.top },
          onInstagram ? null : styles.hidden,
        ]}
      >
        <BrowserView
          ref={browser}
          initialUrl={startUrl}
          service={INSTAGRAM_SERVICE_RULES}
          guardConfig={instagramGuardConfig}
          bottomInset={showTabBar ? tabSpace : 0}
          onRoute={handleRoute}
          onBlocked={handleBlocked}
          onMessage={handleMessage}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onLoadError={handleLoadError}
          onProcessTerminated={handleProcessTerminated}
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
            onBack={leaveBlock}
            onSearch={() => {
              leaveBlock();
              setScreen('search');
            }}
            onOpenNative={openBlockedNatively}
          />
        ) : null}
      </View>

      {WEB_APP_IDS.map(id =>
        opened.includes(id) ? (
          <View
            key={id}
            pointerEvents={activeService === id ? 'auto' : 'none'}
            style={[
              styles.browser,
              { top: insets.top },
              activeService === id ? null : styles.hidden,
            ]}
          >
            {id === 'reddit' ? (
              <RedditHeader
                canGoBack={
                  !/^\/(?:r\/[^/]+\/?)?$/.test(webPaths.reddit) &&
                  !webPaths.reddit.startsWith(REDDIT_NOTIFICATIONS_PATH)
                }
                onMenu={() => setScreen('search')}
                onBack={() => webRefs.current.reddit?.goBack()}
                onSearch={() => setScreen('search')}
                onCreate={() => webRefs.current.reddit?.navigate('/submit')}
              />
            ) : null}
            <ServiceBrowser
              ref={setWebRef[id]}
              initialUrl={webInitialUrls[id]}
              service={WEB_APP_RULES[id]}
              guardConfig={webGuardConfigs[id]}
              skeleton={id === 'youtube' ? 'videos' : 'generic'}
              bottomInset={activeService === id && !showTabBar ? 0 : tabSpace}
              onRoute={onWebRoute[id]}
              onSearch={() => setScreen('search')}
              onScrollState={setCompactBar}
              onAppMessage={id === 'reddit' ? onRedditMessage : undefined}
            />
          </View>
        ) : null,
      )}

      {screen === 'library' && !onInstagram && LIBRARY[activeService] ? (
        <LinkListScreen
          title={LIBRARY[activeService]!.title}
          items={LIBRARY[activeService]!.items}
          onOpen={path => {
            setScreen('browser');
            webRefs.current[activeService]?.navigate(path);
          }}
        />
      ) : null}

      {screen === 'search' && !onInstagram ? (
        <WebSearchScreen
          key={activeService}
          visible
          {...searchSetup(activeService)}
          recent={recentQueries[activeService]}
          onRemember={query =>
            setRecentQueries(prev => ({
              ...prev,
              [activeService]: [
                query,
                ...prev[activeService].filter(
                  item => item.toLowerCase() !== query.toLowerCase(),
                ),
              ].slice(0, 8),
            }))
          }
          onOpen={path => {
            setScreen('browser');
            webRefs.current[activeService]?.navigate(path);
          }}
        />
      ) : null}

      {screen === 'search' && onInstagram ? (
        <SearchScreen
          visible
          history={searchHistory}
          runSearch={runSearch}
          onOpenProfile={openProfile}
          onOpenPath={openPath}
          onClearHistory={clearSearchHistory}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          settings={settings}
          onChange={updateSettings}
          onOpenApp={openApp}
          appBadges={appBadges}
          health={health}
          diagnostics={diagnostics}
          clearingWebsiteData={clearing}
          onReloadInstagram={() => {
            selectService('instagram');
            browser.current?.reload();
          }}
          onOpenInstagramApp={openInstagramApp}
          onClearWebsiteData={clearWebsiteData}
          onResetSettings={resetSettings}
          onResetDiagnostics={resetDiagnostics}
          usageLog={usage.log}
          reels={reels}
          onStartReels={minutes => {
            selectService('instagram');
            startReels(minutes);
          }}
          onEndReels={endReels}
          onResetUsage={() =>
            Alert.alert('Nutzungszeit zurücksetzen?', undefined, [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Zurücksetzen',
                style: 'destructive',
                onPress: usage.reset,
              },
            ])
          }
        />
      ) : null}

      {showTabBar && !onInstagram ? (
        <TabBar
          tabs={WEB_APP_TABS[activeService]}
          active={webTab(activeService)}
          onPress={onWebTab}
          compact={compactBar && screen === 'browser'}
        />
      ) : null}
      {showTabBar && onInstagram ? (
        <TabBar
          tabs={INSTAGRAM_TABS}
          active={instagramTab}
          onPress={onTab}
          compact={compactBar && screen === 'browser' && !block}
          reelsCountdown={
            reels.state === 'active'
              ? formatCountdown(reels.remainingMs)
              : undefined
          }
          hiddenTabs={[
            ...(reelsOpen ? [] : (['reels'] as const)),
            ...(ownProfilePath === null ? (['profile'] as const) : []),
            ...(settings.controls.homeFeed === 'off'
              ? (['feed'] as const)
              : []),
          ]}
        />
      ) : null}

      {gate ? (
        <GateScreen
          app={gate.app}
          mode={gate.mode}
          pauseSeconds={settings.pauseSeconds}
          usedTodaySeconds={appUsage[gate.app].todaySeconds(Date.now())}
          limit={appLimit(gate.app)}
          onOpen={() => setGate(null)}
          onLeave={leaveGate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  browser: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Hidden apps stay mounted (no reload), just invisible and untouchable.
  hidden: {
    opacity: 0,
  },
});
