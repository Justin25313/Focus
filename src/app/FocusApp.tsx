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
import { isSafeRouteToPersist } from '../filtering/engine/RouteGuard';
import { SearchUser, WebMessage } from '../filtering/engine/messages';
import {
  INSTAGRAM_HOME_PATH,
  INSTAGRAM_INBOX_PATH,
  INSTAGRAM_ORIGIN,
  routeKindForPath,
} from '../filtering/instagram/routes';
import { profilePath } from '../filtering/instagram/search';
import { BlockedOverlay } from '../screens/BlockedOverlay';
import { BlockState, BrowserHandle, BrowserView } from '../screens/BrowserView';
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
import { TabBar, TabId } from '../ui/TabBar';
import { TAB_BAR_HEIGHT, useTheme } from '../ui/theme';

/** Keys shared with AppDelegate.swift (NSUserDefaults). */
const CLEAR_REQUEST_KEY = 'FocusClearWebsiteDataRequest';
const CLEAR_DONE_KEY = 'FocusClearWebsiteDataDoneAt';

const FILTER_TIMEOUT_MS = 5000;
const SEARCH_TIMEOUT_MS = 6000;

type Screen = 'browser' | 'search' | 'settings';

type Loaded = {
  settings: FocusSettings;
  initialUrl: string;
  diagnostics: Diagnostics;
  searchHistory: string[];
};

async function loadState(): Promise<Loaded> {
  const [rawSettings, rawRoute, rawDiagnostics, rawHistory] = await Promise.all(
    [
      readJson(STORAGE_KEYS.settings),
      readJson(STORAGE_KEYS.lastRoute),
      readJson(STORAGE_KEYS.diagnostics),
      readJson(STORAGE_KEYS.searchHistory),
    ],
  );
  const settings = parseSettings(rawSettings);
  const restore =
    settings.keepLastLocation &&
    typeof rawRoute === 'string' &&
    isSafeRouteToPersist(rawRoute);
  return {
    settings,
    initialUrl: INSTAGRAM_ORIGIN + (restore ? rawRoute : INSTAGRAM_HOME_PATH),
    diagnostics: parseDiagnostics(rawDiagnostics),
    searchHistory: parseSearchHistory(rawHistory),
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
  const [screen, setScreen] = useState<Screen>(
    initial.settings.openInstagramOnLaunch ? 'browser' : 'settings',
  );
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [block, setBlock] = useState<BlockState | null>(null);
  const [health, setHealth] = useState<FilterHealth>('starting');
  const [offline, setOffline] = useState(false);
  const [clearing, setClearing] = useState(false);

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
    if (!settingsRef.current.keepLastLocation || !isSafeRouteToPersist(path)) {
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

  const handleBlocked = useCallback(
    (state: BlockState) => {
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
    [updateDiagnostics],
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
    [handleBlocked, handleRoute, updateDiagnostics],
  );

  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLoadStart = useCallback(() => {
    setHealth(prev => (prev === 'active' ? prev : 'starting'));
  }, []);
  const handleLoadEnd = useCallback(() => {
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
  }, [updateDiagnostics]);

  const handleLoadError = useCallback(
    (code: number) => {
      setOffline(true);
      updateDiagnostics(prev => ({
        ...prev,
        lastError: { code: `LOAD_ERROR_${Math.abs(code)}`, at: Date.now() },
      }));
    },
    [updateDiagnostics],
  );

  const handleProcessTerminated = useCallback(() => {
    setHealth('starting');
    updateDiagnostics(prev => ({
      ...prev,
      webProcessRestarts: prev.webProcessRestarts + 1,
    }));
  }, [updateDiagnostics]);

  // ---- actions -------------------------------------------------------

  const openPath = useCallback((path: string) => {
    setBlock(null);
    setScreen('browser');
    browser.current?.navigate(path);
  }, []);

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
      const inDirect = routeKindForPath(currentPath) === 'direct';
      switch (tab) {
        case 'feed':
          if (screen === 'browser' && !block) {
            if (inDirect) {
              openPath(INSTAGRAM_HOME_PATH);
            } else {
              browser.current?.scrollToTop();
            }
          }
          setScreen('browser');
          break;
        case 'messages':
          setScreen('browser');
          if (!inDirect || screen === 'browser') {
            openPath(INSTAGRAM_INBOX_PATH);
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
    [block, currentPath, openPath, screen],
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
            removeKeys([STORAGE_KEYS.lastRoute]);

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
                INSTAGRAM_ORIGIN + INSTAGRAM_HOME_PATH,
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
          onContinue={() => {
            updateSettings({ onboardingComplete: true });
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
      : routeKindForPath(currentPath) === 'direct' && !block
      ? 'messages'
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
          initialUrl={initial.initialUrl}
          onRoute={handleRoute}
          onBlocked={handleBlocked}
          onMessage={handleMessage}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onLoadError={handleLoadError}
          onProcessTerminated={handleProcessTerminated}
        />
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
        <TabBar active={activeTab} onPress={onTab} />
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
