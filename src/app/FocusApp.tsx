import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
  instagramPathFromUrl,
  isSafeRouteToPersist,
} from '../filtering/engine/RouteGuard';
import { Controls, homePathFor, policyFor } from '../controls/controls';
import { SearchUser, WebMessage } from '../filtering/engine/messages';
import {
  INSTAGRAM_INBOX_PATH,
  INSTAGRAM_ORIGIN,
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
import { TabBar, TabId } from '../ui/TabBar';
import { TAB_BAR_HEIGHT, useTheme } from '../ui/theme';

/** Keys shared with AppDelegate.swift (NSUserDefaults). */
const CLEAR_REQUEST_KEY = 'FocusClearWebsiteDataRequest';
const CLEAR_DONE_KEY = 'FocusClearWebsiteDataDoneAt';

const FILTER_TIMEOUT_MS = 5000;
const SEARCH_TIMEOUT_MS = 6000;
/** Longest a loading skeleton may stay up, whatever happens. */
const LOADING_MAX_MS = 8000;
/** After the document itself loaded, the page gets this long to settle. */
const LOADING_AFTER_LOAD_MS = 3000;
/** PAGE_READY messages this soon after a new load began are leftovers. */
const LOADING_STALE_MS = 400;

type Screen = 'browser' | 'search' | 'settings';

type Loaded = {
  settings: FocusSettings;
  initialUrl: string;
  diagnostics: Diagnostics;
  searchHistory: string[];
  ownProfilePath: string | null;
};

/** Whether `path` is the signed-in user's profile or one of its tabs. */
function isOwnProfile(path: string, ownPath: string | null): boolean {
  return (
    ownPath !== null && path.toLowerCase().startsWith(ownPath.toLowerCase())
  );
}

async function loadState(): Promise<Loaded> {
  const [rawSettings, rawRoute, rawDiagnostics, rawHistory, rawProfile] =
    await Promise.all([
      readJson(STORAGE_KEYS.settings),
      readJson(STORAGE_KEYS.lastRoute),
      readJson(STORAGE_KEYS.diagnostics),
      readJson(STORAGE_KEYS.searchHistory),
      readJson(STORAGE_KEYS.ownProfile),
    ]);
  const settings = parseSettings(rawSettings);
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
    initial.settings.openInstagramOnLaunch ? 'browser' : 'settings',
  );
  const initialPath = instagramPathFromUrl(initial.initialUrl) ?? '/';
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const [block, setBlock] = useState<BlockState | null>(null);
  const [health, setHealth] = useState<FilterHealth>('starting');
  const [offline, setOffline] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState<SkeletonVariant | null>(
    skeletonForRoute(routeKindForPath(initialPath)),
  );

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

  const hideLoading = useCallback(() => {
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
    (url: string) => {
      setHealth(prev => (prev === 'active' ? prev : 'starting'));
      const path = instagramPathFromUrl(url);
      showLoading(path ? skeletonForRoute(routeKindForPath(path)) : 'generic');
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

  const activeTab: TabId =
    screen === 'search'
      ? 'search'
      : screen === 'settings'
      ? 'focus'
      : block
      ? 'feed'
      : routeKindForPath(currentPath) === 'direct'
      ? 'messages'
      : isOwnProfile(currentPath, ownProfilePath)
      ? 'profile'
      : 'feed';

  return (
    <View style={[styles.fill, { backgroundColor: theme.webBackground }]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* The WebView stays mounted for the app's whole lifetime. */}
      <View
        style={[
          styles.browser,
          { top: insets.top, bottom: TAB_BAR_HEIGHT + insets.bottom },
        ]}
      >
        <BrowserView
          ref={browser}
          initialUrl={startUrl}
          controls={settings.controls}
          grayscale={settings.grayscale}
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
            onBack={leaveBlock}
            onSearch={() => {
              leaveBlock();
              setScreen('search');
            }}
            onOpenNative={openBlockedNatively}
          />
        ) : null}
      </View>

      {screen === 'search' ? (
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
          health={health}
          diagnostics={diagnostics}
          clearingWebsiteData={clearing}
          onReload={() => {
            setScreen('browser');
            browser.current?.reload();
          }}
          onOpenInstagramApp={openInstagramApp}
          onClearWebsiteData={clearWebsiteData}
          onResetSettings={resetSettings}
          onResetDiagnostics={resetDiagnostics}
        />
      ) : null}

      <View style={styles.tabBar}>
        <TabBar
          active={activeTab}
          onPress={onTab}
          hiddenTabs={[
            ...(ownProfilePath === null ? (['profile'] as const) : []),
            ...(settings.controls.homeFeed === 'off'
              ? (['feed'] as const)
              : []),
          ]}
        />
      </View>
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
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
