import {
  Controls,
  DEFAULT_CONTROLS,
  HomeFeed,
  policyFor,
} from '../../controls/controls';
import { BlockReason, RouteRule, ServiceRules } from '../engine/types';
import {
  DEFAULT_YOUTUBE_CONTROLS,
  YouTubeControls,
  youtubePolicyFor,
} from '../../controls/youtube';
import { DEFAULT_X_CONTROLS, XControls, xPolicyFor } from '../../controls/x';
import { X_HOME_PATH, X_ORIGIN, X_SERVICE_RULES } from '../x/routes';
import { REDDIT_ORIGIN, REDDIT_SERVICE_RULES } from '../reddit/routes';
import {
  YOUTUBE_ORIGIN,
  YOUTUBE_SERVICE_RULES,
  YOUTUBE_SUBSCRIPTIONS_PATH,
} from '../youtube/routes';
import {
  GUARDED_HOSTS,
  INSTAGRAM_FOLLOWING_PATH,
  INSTAGRAM_INBOX_PATH,
  INSTAGRAM_ORIGIN,
  INSTAGRAM_ROUTE_RULES,
  INSTAGRAM_RULE_VERSION,
  RoutePolicy,
} from './routes';

/** Public app id Instagram's own web client sends with API requests. */
const INSTAGRAM_WEB_APP_ID = '936619743392459';

/**
 * Post labels, matched only as the exact, complete text of a small leaf
 * element near the top of a post. A post is only hidden on an exact
 * match: showing an ad now and then beats hiding a friend's post.
 */
const SPONSORED_LABELS = ['sponsored', 'gesponsert', 'anzeige', 'werbung'];
const SUGGESTED_LABELS = [
  'suggested for you',
  'suggested posts',
  'für dich vorgeschlagen',
  'vorgeschlagen für dich',
  'vorschläge für dich',
  'vorgeschlagene beiträge',
];

export type GuardService = 'instagram' | 'youtube' | 'x' | 'reddit';

/**
 * Keep one tab of a tab list selected on a page (X: "Following" instead
 * of "For you"). While another tab is selected, `hideWhilePending` stays
 * hidden (fail closed) and the wanted tab is clicked.
 */
export type PinTab = {
  path: string;
  index: number;
  /** Tabs to remove, e.g. "For you". */
  hideIndexes: number[];
  /** Remove every other tab (and extras like "+") from the list. */
  onlyTab: boolean;
  hideWhilePending: string;
};

export type GuardConfig = {
  service: GuardService;
  version: string;
  origin: string;
  guardedHosts: string[];
  rules: readonly RouteRule[];
  policy: RoutePolicy;
  /** Blocked routes that silently go elsewhere instead of a block screen. */
  redirects: Partial<Record<BlockReason, string>>;
  /** Elements hidden via CSS (structure/href based, never text). */
  hiddenSelectors: string[];
  /** A page counts as rendered once one of these exists. */
  contentSelector: string;
  pullToRefresh: boolean;
  /** Link targets that open the native Focus search instead. */
  searchPaths: string[];
  /** Entry points hidden via early CSS (matched on href only, never on text). */
  hiddenLinkSelectors: string[];
  /** Hide the app's own bottom tab bar; Focus shows its own. */
  hideAppNav: boolean;
  /** Links that identify the app's bottom bar (by href, never text). */
  navProbes: string;
  /** Links that identify the site's own top header, hidden when set. */
  topBarProbes: string;
  /** Report horizontal swipes (Instagram: feed ↔ messages). */
  swipeNav: boolean;
  /**
   * Navigate inside the single-page app (history + popstate) instead of
   * reloading the whole page, verified by fresh content; reload if not.
   */
  spaNavigate: boolean;
  /** Reddit: read the signed-in user's subscribed communities. */
  fetchSubscriptions: boolean;
  pinTab: PinTab | null;
  homeFeed: HomeFeed | 'none';
  followingPath: string;
  inboxPath: string;
  grayscale: boolean;
  sponsoredLabels: string[];
  suggestedLabels: string[];
  webAppId: string;
};

export function buildGuardConfig(
  controls: Controls = DEFAULT_CONTROLS,
  grayscale = false,
): GuardConfig {
  const policy = policyFor(controls);
  const hidden: string[] = [];
  if (policy.reels) {
    hidden.push(
      'a[href="/reels/"]',
      'a[href^="/reels/"]',
      'a[href$="/reels/"]',
      'a[href^="https://www.instagram.com/reels/"]',
    );
  }
  if (policy.saved) {
    hidden.push('a[href$="/saved/"]');
  }
  return {
    service: 'instagram',
    version: INSTAGRAM_RULE_VERSION,
    origin: INSTAGRAM_ORIGIN,
    guardedHosts: [...GUARDED_HOSTS],
    rules: INSTAGRAM_ROUTE_RULES,
    policy,
    redirects: { feed: INSTAGRAM_INBOX_PATH },
    hiddenSelectors: [],
    // Real content, not Instagram's loading shell.
    contentSelector:
      'main article, main img, main a[href], form, [role="dialog"]',
    pullToRefresh: true,
    searchPaths: policy.explore ? ['/explore/'] : [],
    hiddenLinkSelectors: hidden,
    hideAppNav: true,
    navProbes: 'a[href="/"], a[href="/explore/"], a[href="/direct/inbox/"]',
    topBarProbes: '',
    swipeNav: true,
    spaNavigate: true,
    fetchSubscriptions: false,
    pinTab: null,
    homeFeed: controls.homeFeed,
    followingPath: INSTAGRAM_FOLLOWING_PATH,
    inboxPath: INSTAGRAM_INBOX_PATH,
    grayscale,
    sponsoredLabels: controls.hideSponsored ? SPONSORED_LABELS : [],
    suggestedLabels: controls.hideSuggested ? SUGGESTED_LABELS : [],
    webAppId: INSTAGRAM_WEB_APP_ID,
  };
}

/** Base for apps without Instagram's extras. */
function basicConfig(
  service: GuardService,
  origin: string,
  rules: ServiceRules,
  policy: RoutePolicy,
  grayscale: boolean,
): GuardConfig {
  return {
    service,
    version: INSTAGRAM_RULE_VERSION,
    origin,
    guardedHosts: [...rules.guardedHosts],
    rules: rules.rules,
    policy,
    redirects: {},
    hiddenSelectors: [],
    contentSelector: 'main, [role="main"], body > div',
    pullToRefresh: false,
    searchPaths: [],
    hiddenLinkSelectors: [],
    hideAppNav: false,
    navProbes: '',
    topBarProbes: '',
    swipeNav: false,
    spaNavigate: false,
    fetchSubscriptions: false,
    pinTab: null,
    homeFeed: 'none',
    followingPath: '/',
    inboxPath: '/',
    grayscale,
    sponsoredLabels: [],
    suggestedLabels: [],
    webAppId: '',
  };
}

/**
 * YouTube (m.youtube.com). Selectors are YouTube's own custom elements,
 * the same ones established Shorts filter lists rely on.
 */
export function buildYouTubeGuardConfig(
  controls: YouTubeControls = DEFAULT_YOUTUBE_CONTROLS,
  grayscale = false,
): GuardConfig {
  const config = basicConfig(
    'youtube',
    YOUTUBE_ORIGIN,
    YOUTUBE_SERVICE_RULES,
    youtubePolicyFor(controls),
    grayscale,
  );
  // Focus has its own tab bar and search.
  const hidden = [
    'ytm-pivot-bar-renderer',
    'ytm-mobile-topbar-renderer button[aria-label*="earch"]',
    'ytm-mobile-topbar-renderer button[aria-label*="uche"]',
  ];
  if (controls.blockShorts) {
    hidden.push(
      'ytm-reel-shelf-renderer',
      'ytm-shorts-lockup-view-model',
      'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
      'ytm-video-with-context-renderer:has(ytm-thumbnail-overlay-time-status-renderer[data-style="SHORTS"])',
      'ytm-compact-video-renderer:has(ytm-thumbnail-overlay-time-status-renderer[data-style="SHORTS"])',
      'ytm-chip-cloud-chip-renderer:has([aria-label="Shorts"])',
      'yt-tab-shape[tab-title="Shorts"]',
      'a[href^="/shorts"]',
    );
  }
  if (controls.hideRelated) {
    hidden.push(
      'ytm-watch-next-secondary-results-renderer',
      'ytm-item-section-renderer[section-identifier="related-items"]',
      'ytm-compact-autoplay-renderer',
    );
  }
  if (controls.hideComments) {
    hidden.push(
      'ytm-comments-entry-point-header-renderer',
      'ytm-comment-section-renderer',
      'ytm-item-section-renderer[section-identifier="comment-item-section"]',
    );
  }
  return {
    ...config,
    redirects:
      controls.home === 'subscriptions'
        ? { ytHome: YOUTUBE_SUBSCRIPTIONS_PATH }
        : {},
    hiddenSelectors: hidden,
    contentSelector:
      'ytm-browse, ytm-watch, ytm-search, ytm-rich-grid-renderer, ytm-section-list-renderer',
  };
}

/**
 * X (x.com). The home timeline keeps "Following" selected; Erkunden and
 * trends are blocked; X's own bottom bar makes way for Focus's.
 */
export function buildXGuardConfig(
  controls: XControls = DEFAULT_X_CONTROLS,
  grayscale = false,
): GuardConfig {
  const config = basicConfig(
    'x',
    X_ORIGIN,
    X_SERVICE_RULES,
    xPolicyFor(),
    grayscale,
  );
  return {
    ...config,
    hideAppNav: true,
    navProbes:
      'a[href="/home"], a[href="/explore"], a[href="/notifications"], a[href="/messages"]',
    searchPaths: ['/explore'],
    hiddenLinkSelectors: [
      'a[href="/explore"]',
      'a[href^="/i/trends"]',
      'a[href^="/i/premium"]',
      'a[href^="/i/verified"]',
    ],
    hiddenSelectors: [
      '[data-testid="sidebarColumn"]',
      '[data-testid="BottomBar"]',
      // X's bottom bar, also while the app is still loading (then it is
      // not fixed yet, so the probe-based search does not find it).
      'nav[role="navigation"]:has(a[href="/home"]):has(a[href="/notifications"])',
    ],
    pinTab: controls.followingOnly
      ? {
          path: X_HOME_PATH,
          index: 1,
          hideIndexes: [0],
          // Topic tabs (News, Business, …) are algorithmic feeds as well.
          onlyTab: true,
          hideWhilePending: 'section[role="region"]',
        }
      : null,
    contentSelector: '[data-testid="primaryColumn"], main, form',
  };
}

/**
 * Reddit (www.reddit.com, "shreddit"). Home, Popular and All are blocked
 * by route; promoted posts are Reddit's own custom elements.
 */
export function buildRedditGuardConfig(
  grayscale = false,
  /** Your communities' combined feed; "/" goes there instead. */
  homePath: string | null = null,
): GuardConfig {
  const config = basicConfig(
    'reddit',
    REDDIT_ORIGIN,
    REDDIT_SERVICE_RULES,
    { rHome: true, rPopular: true },
    grayscale,
  );
  return {
    ...config,
    hiddenLinkSelectors: [
      'a[href^="/r/popular"]',
      'a[href^="/r/all"]',
      'a[href^="/explore"]',
      'a[href^="https://www.reddit.com/r/popular"]',
      'a[href^="https://www.reddit.com/r/all"]',
    ],
    redirects: homePath ? { rHome: homePath } : {},
    fetchSubscriptions: true,
    // Focus shows an app-style header instead of the web one.
    hideAppNav: true,
    topBarProbes:
      'a[href="/"], a[href^="/submit"], a[href="/notifications"], a[href^="https://www.reddit.com/submit"]',
    hiddenSelectors: [
      'shreddit-ad-post',
      'shreddit-comments-page-ad',
      'shreddit-sidebar-ad',
      'reddit-header-large',
      'reddit-header-small',
    ],
    contentSelector: 'shreddit-app, main, shreddit-feed, shreddit-post',
  };
}

/**
 * The in-page guard. Runs at document start in the main frame only.
 *
 * Responsibilities:
 *  - detect SPA route changes (pushState/replaceState/popstate + a cheap poll)
 *  - report routes and blocked routes to the app over the narrow bridge
 *  - hide and pause the page while it sits on a blocked route (fail closed)
 *  - stop clicks on blocked links before Instagram's router sees them
 *  - hide Reels entry points via href-based CSS
 *  - hide Instagram's own bottom tab bar (Focus has a native one) and
 *    report the signed-in user's profile path found in it
 *  - tell the app when a page has settled, so its loading skeleton can go
 *  - apply the home feed mode (Following feed, hidden feed, no feed)
 *  - hide posts labelled as sponsored or suggested (exact label match only)
 *  - grayscale
 *  - pull-to-refresh with the spinner below Instagram's header, as in the app
 *
 * DOM work is driven by one batched MutationObserver, so changes apply
 * before the next paint instead of popping in later.
 *
 * Kept as plain ES5-style JavaScript; it is evaluated inside WKWebView.
 */
const GUARD_SOURCE = String.raw`
(function (config) {
  'use strict';
  var w = window;
  if (w.__focusGuard) {
    w.__focusGuard.configure(config);
    return;
  }

  var STYLE_ID = 'focus-guard-style';
  var BLOCKED_ATTR = 'data-focus-blocked';
  var NAV_ATTR = 'data-focus-ig-nav';
  var PROFILE_PATH = /^\/([A-Za-z0-9._]{1,30})\/$/;
  var NOT_PROFILES = ['explore', 'reels', 'reel', 'direct', 'accounts', 'p', 'stories', 'tv'];
  var ownProfilePath = null;
  var ROUTE_ATTR = 'data-focus-route';
  var HIDDEN_ATTR = 'data-focus-hidden';
  var SCAN_ATTR = 'data-focus-scan';
  var MAX_SCANS = 5;
  var lastRedirectAt = 0;
  var BACK_ATTR = 'data-focus-hide-back';
  var PIN_ATTR = 'data-focus-pin-pending';
  var PIN_HIDE_ATTR = 'data-focus-pin-hide';
  var lastPinClick = 0;
  var PTR_ID = 'focus-ptr';
  var PTR_SPACER_ATTR = 'data-focus-ptr-spacer';
  var PTR_THRESHOLD = 70;
  var ptrState = 'idle';
  var ptrPath = null;
  var ptrTimer = null;
  var ptrPull = 0;
  var touching = false;
  var SETTLE_QUIET_MS = 250;
  var SETTLE_MAX_MS = 2500;
  // Once real content is there, the page counts as ready shortly after,
  // even if the site keeps changing the DOM (Instagram always does).
  var CONTENT_GRACE_MS = 300;
  var contentSeenAt = 0;
  var OLD_ATTR = 'data-focus-old';
  var SPA_VERIFY_MS = 1500;
  var settlePath = null;
  var settleDeadline = 0;
  var settleTimer = null;
  var domWorkScheduled = false;
  var lastDomWork = 0;
  var DOM_WORK_MIN_GAP_MS = 120;
  var SAFE_PATH = /^\/[A-Za-z0-9._\-\/@+]*(\?[A-Za-z0-9_=&%.+\-]*)?$/;
  var rules = [];
  var lastRoutePath = null;
  var lastAllowedPath = null;
  var blocked = false;
  var mediaTimer = null;

  function post(message) {
    try {
      var bridge = w.ReactNativeWebView;
      if (bridge && typeof bridge.postMessage === 'function') {
        bridge.postMessage(JSON.stringify(message));
      }
    } catch (e) {}
  }

  function isGuardedHost() {
    return config.guardedHosts.indexOf(location.hostname) !== -1;
  }

  function reasonFor(path, host) {
    var currentHost = host || location.hostname;
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].host && rules[i].host !== currentHost) {
        continue;
      }
      if (rules[i].re.test(path)) {
        if (rules[i].effect === 'allow') {
          return null;
        }
        return config.policy[rules[i].reason] === false ? null : rules[i].reason;
      }
    }
    return null;
  }

  function cssText() {
    var css = 'html[' + BLOCKED_ATTR + '] body{visibility:hidden!important;}';
    // No scrollbars anywhere, like the native app (inner scrollers too).
    css += '*{scrollbar-width:none!important;}*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}';
    if (config.hiddenLinkSelectors.length) {
      css += config.hiddenLinkSelectors.join(',') + '{display:none!important;}';
    }
    if (config.hideAppNav) {
      css += '[' + NAV_ATTR + ']{display:none!important;}';
    }
    if (config.hiddenSelectors.length) {
      css += config.hiddenSelectors.join(',') + '{display:none!important;}';
    }
    css += '[' + HIDDEN_ATTR + ']{display:none!important;}';
    css +=
      '#' + PTR_ID + '{position:fixed;left:50%;width:28px;height:28px;margin-left:-14px;' +
      'z-index:2147483646;pointer-events:none;opacity:0;}' +
      '#' + PTR_ID + '.spin svg{animation:focus-ptr-spin .9s steps(8) infinite;}' +
      '@keyframes focus-ptr-spin{to{transform:rotate(360deg);}}' +
      '[' + PTR_SPACER_ATTR + ']{transition:height .2s ease;overflow:hidden;}';
    if (config.pinTab) {
      css +=
        'html[' + PIN_ATTR + '] ' + config.pinTab.hideWhilePending +
        '{visibility:hidden!important;}' +
        '[' + PIN_HIDE_ATTR + ']{display:none!important;}';
    }
    if (config.homeFeed === 'following') {
      // The Following feed's back arrow leads to the "For you" feed.
      css += '[' + BACK_ATTR + ']{visibility:hidden!important;pointer-events:none!important;}';
    }
    if (config.homeFeed === 'hidden') {
      css +=
        'html[' + ROUTE_ATTR + '="home"] main article{display:none!important;}' +
        'html[' + ROUTE_ATTR + '="home"] main::after{content:"Feed ausgeblendet – Stories oben, Nachrichten über Focus.";' +
        'display:block;text-align:center;padding:48px 32px;color:#8e8e8e;' +
        'font:15px/1.4 -apple-system,system-ui,sans-serif;}';
    }
    if (config.grayscale) {
      // On the root element a filter does not break position:fixed.
      css += 'html{filter:grayscale(1)!important;}';
    }
    return css;
  }

  function ensureStyle(force) {
    var root = document.documentElement;
    if (!root) {
      return;
    }
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || root).appendChild(el);
      force = true;
    }
    if (force) {
      el.textContent = cssText();
    }
  }

  function pauseMedia() {
    var media = document.querySelectorAll('video, audio');
    for (var i = 0; i < media.length; i++) {
      try {
        if (!media[i].paused) {
          media[i].pause();
        }
      } catch (e) {}
    }
  }

  function setBlocked(on) {
    blocked = on;
    var root = document.documentElement;
    if (root) {
      if (on) {
        root.setAttribute(BLOCKED_ATTR, '');
      } else {
        root.removeAttribute(BLOCKED_ATTR);
      }
    }
    if (on) {
      pauseMedia();
      if (!mediaTimer) {
        mediaTimer = setInterval(pauseMedia, 400);
      }
    } else if (mediaTimer) {
      clearInterval(mediaTimer);
      mediaTimer = null;
    }
  }

  // Instagram's bottom bar: a fixed element in the lower half of the
  // viewport that contains the home, search or inbox link. Found by
  // structure and href, never by (localised) text.
  function bottomBarFor(anchor) {
    var el = anchor.parentElement;
    for (var depth = 0; el && el !== document.body && depth < 10; depth++) {
      var position = w.getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        var rect = el.getBoundingClientRect();
        var viewport = w.innerHeight || document.documentElement.clientHeight;
        if (rect.height > 0 && rect.height < 140 && rect.top > viewport / 2) {
          return el;
        }
        return null;
      }
      el = el.parentElement;
    }
    return null;
  }

  function reportOwnProfile(bar) {
    var links = bar.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var match = PROFILE_PATH.exec(links[i].getAttribute('href') || '');
      if (
        match &&
        NOT_PROFILES.indexOf(match[1].toLowerCase()) === -1 &&
        links[i].querySelector('img')
      ) {
        if (match[0] !== ownProfilePath) {
          ownProfilePath = match[0];
          post({ type: 'OWN_PROFILE', path: ownProfilePath });
        }
        return;
      }
    }
  }

  // ---- pull to refresh -------------------------------------------

  function canRefresh(path) {
    if (!config.pullToRefresh) {
      return false;
    }
    if (path === '/' || path === config.inboxPath) {
      return true;
    }
    var match = PROFILE_PATH.exec(path);
    return !!match && NOT_PROFILES.indexOf(match[1].toLowerCase()) === -1;
  }

  // Bottom edge of Instagram's fixed/sticky top bar, or 0.
  function headerBottom() {
    if (typeof document.elementFromPoint !== 'function') {
      return 0;
    }
    var el = document.elementFromPoint((w.innerWidth || 0) / 2, 4);
    for (var depth = 0; el && el !== document.body && depth < 12; depth++) {
      var position = w.getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        var rect = el.getBoundingClientRect();
        return rect.top <= 2 && rect.height < 160 ? rect.bottom : 0;
      }
      el = el.parentElement;
    }
    return 0;
  }

  function spinnerSvg() {
    var lines = '';
    for (var i = 0; i < 8; i++) {
      lines +=
        '<line x1="14" y1="3.5" x2="14" y2="8.5" opacity="' + (1 - i * 0.11).toFixed(2) +
        '" transform="rotate(' + i * -45 + ' 14 14)"/>';
    }
    return (
      '<svg viewBox="0 0 28 28" width="28" height="28"><g stroke="#8e8e8e" ' +
      'stroke-width="2.6" stroke-linecap="round">' + lines + '</g></svg>'
    );
  }

  function ptrElement() {
    var el = document.getElementById(PTR_ID);
    if (!el && document.body) {
      el = document.createElement('div');
      el.id = PTR_ID;
      el.innerHTML = spinnerSvg();
      document.body.appendChild(el);
    }
    return el;
  }

  function resetPtr() {
    ptrState = 'idle';
    ptrPull = 0;
    var el = document.getElementById(PTR_ID);
    if (el) {
      el.style.opacity = '0';
      el.className = '';
    }
  }

  function onScrollForPtr() {
    if (ptrState === 'refreshing') {
      return;
    }
    var y = w.scrollY || w.pageYOffset || 0;
    if (y >= 0 || !touching || !canRefresh(location.pathname)) {
      if (ptrState === 'pulling' && !touching) {
        resetPtr();
      }
      return;
    }
    var el = ptrElement();
    if (!el) {
      return;
    }
    ptrState = 'pulling';
    ptrPull = -y;
    el.style.top = headerBottom() + Math.max(4, ptrPull / 2 - 14) + 'px';
    el.style.opacity = String(Math.min(1, ptrPull / PTR_THRESHOLD));
    el.firstChild.style.transform = 'rotate(' + Math.round(ptrPull * 3) + 'deg)';
  }

  // Ends a refresh that did not replace the page (offline, navigation).
  function finishRefresh() {
    if (ptrTimer) {
      clearTimeout(ptrTimer);
      ptrTimer = null;
    }
    var spacers = document.querySelectorAll('[' + PTR_SPACER_ATTR + ']');
    for (var i = 0; i < spacers.length; i++) {
      spacers[i].parentNode.removeChild(spacers[i]);
    }
    ptrPath = null;
    resetPtr();
  }

  function startRefresh() {
    ptrState = 'refreshing';
    ptrPath = location.pathname;
    ptrTimer = setTimeout(finishRefresh, 8000);
    var el = ptrElement();
    var top = headerBottom();
    // Keep a gap below the header while refreshing, like the app.
    var main = document.querySelector('main');
    if (main && main.parentNode) {
      var spacer = document.createElement('div');
      spacer.setAttribute(PTR_SPACER_ATTR, '');
      spacer.style.height = '0px';
      main.parentNode.insertBefore(spacer, main);
      setTimeout(function () {
        spacer.style.height = '52px';
      }, 0);
    }
    if (el) {
      el.className = 'spin';
      el.firstChild.style.transform = '';
      el.style.top = top + 12 + 'px';
      el.style.opacity = '1';
    }
    setTimeout(function () {
      // Indirection only so tests can observe the reload.
      (w.__focusReloadForTests || location.reload.bind(location))();
    }, 450);
  }

  function onTouchEnd() {
    touching = false;
    if (ptrState !== 'pulling') {
      return;
    }
    if (ptrPull >= PTR_THRESHOLD) {
      startRefresh();
    } else {
      resetPtr();
    }
  }

  // ---- compact tab bar while scrolling down ------------------------

  var SCROLL_STEP = 10;
  var SCROLL_TOP_ZONE = 60;
  var lastScrollY = 0;
  var compact = false;

  function setCompact(next) {
    if (next !== compact) {
      compact = next;
      post({ type: 'SCROLL_STATE', compact: next });
    }
  }

  // Page scroll, or an inner scroller that fills the screen (X, Reddit).
  function onScrollForBar(event) {
    var target = event && event.target;
    var y;
    if (
      !target ||
      target === w ||
      target === document ||
      target === document.documentElement ||
      target === document.body
    ) {
      y = w.scrollY || 0;
    } else if (target.clientHeight > (w.innerHeight || 0) * 0.6) {
      y = target.scrollTop || 0;
    } else {
      return;
    }
    if (y < SCROLL_TOP_ZONE) {
      setCompact(false);
    } else if (y - lastScrollY > SCROLL_STEP) {
      setCompact(true);
    } else if (lastScrollY - y > SCROLL_STEP) {
      setCompact(false);
    }
    if (Math.abs(y - lastScrollY) > SCROLL_STEP || y < SCROLL_TOP_ZONE) {
      lastScrollY = y;
    }
  }

  // ---- horizontal swipe (Instagram: feed <-> messages) ---------------

  var SWIPE_MIN_X = 80;
  var SWIPE_MAX_Y = 45;
  var SWIPE_MAX_MS = 600;
  var EDGE = 24;
  var swipe = null;

  // Swipes that start in something that scrolls or slides sideways
  // (story tray, carousels) belong to that element.
  function inHorizontalScroller(el) {
    for (var depth = 0; el && el !== document.body && depth < 25; depth++) {
      if (el.nodeType === 1) {
        if (el.scrollWidth > el.clientWidth + 4) {
          var overflow = w.getComputedStyle(el).overflowX;
          if (overflow === 'auto' || overflow === 'scroll') {
            return true;
          }
        }
        if (el.tagName === 'UL' && el.children.length > 1 && el.closest('article')) {
          return true;
        }
      }
      el = el.parentNode;
    }
    return false;
  }

  function onSwipeStart(event) {
    swipe = null;
    if (!config.swipeNav || !event.touches || event.touches.length !== 1) {
      return;
    }
    var t = event.touches[0];
    var width = w.innerWidth || 0;
    if (t.clientX < EDGE || t.clientX > width - EDGE || inHorizontalScroller(event.target)) {
      return;
    }
    swipe = { x: t.clientX, y: t.clientY, at: Date.now() };
  }

  function onSwipeEnd(event) {
    var start = swipe;
    swipe = null;
    if (!start || !event.changedTouches || !event.changedTouches.length) {
      return;
    }
    var t = event.changedTouches[0];
    var dx = t.clientX - start.x;
    var dy = t.clientY - start.y;
    if (
      Math.abs(dx) >= SWIPE_MIN_X &&
      Math.abs(dy) <= SWIPE_MAX_Y &&
      Date.now() - start.at <= SWIPE_MAX_MS
    ) {
      post({ type: 'SWIPE', direction: dx < 0 ? 'left' : 'right' });
    }
  }

  // The Following feed's header starts with a back arrow to "For you".
  // Find whatever is tappable at the header's left edge and hide it
  // (keeping its space, so the title does not jump).
  function hideFollowingBackLink() {
    if (
      config.homeFeed !== 'following' ||
      location.pathname !== '/' ||
      typeof document.elementFromPoint !== 'function'
    ) {
      return;
    }
    var bottom = headerBottom();
    var el = document.elementFromPoint(28, bottom ? bottom / 2 : 24);
    for (var depth = 0; el && el !== document.body && depth < 8; depth++) {
      if (el.hasAttribute && el.hasAttribute(BACK_ATTR)) {
        return;
      }
      if (el.matches && el.matches('a, button, [role="button"], [role="link"]')) {
        var rect = el.getBoundingClientRect();
        if (rect.left < 60 && rect.width < 90 && rect.height < 80) {
          el.setAttribute(BACK_ATTR, '');
        }
        return;
      }
      el = el.parentElement;
    }
  }

  // The site's own header: a sticky/fixed element at the top that holds
  // one of the probe links. Hidden where Focus shows its own header.
  function topBarFor(anchor) {
    var el = anchor.parentElement;
    for (var depth = 0; el && el !== document.body && depth < 12; depth++) {
      var position = w.getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        var rect = el.getBoundingClientRect();
        return rect.height > 0 && rect.height < 140 && rect.top < 40 ? el : null;
      }
      el = el.parentElement;
    }
    return null;
  }

  function tidyTopBar() {
    if (!config.topBarProbes) {
      return;
    }
    var probes = document.querySelectorAll(config.topBarProbes);
    for (var i = 0; i < probes.length; i++) {
      if (!probes[i].closest('[' + NAV_ATTR + ']')) {
        var bar = topBarFor(probes[i]);
        if (bar) {
          bar.setAttribute(NAV_ATTR, '');
        }
      }
    }
  }

  function tidyAppNav() {
    tidyTopBar();
    if (!config.navProbes) {
      return;
    }
    var probes = document.querySelectorAll(config.navProbes);
    for (var i = 0; i < probes.length; i++) {
      if (probes[i].closest('[' + NAV_ATTR + ']')) {
        continue;
      }
      var bar = bottomBarFor(probes[i]);
      if (bar) {
        if (config.service === 'instagram') {
          reportOwnProfile(bar);
        }
        if (config.hideAppNav) {
          bar.setAttribute(NAV_ATTR, '');
        }
      }
    }
  }

  function pinTab() {
    var pin = config.pinTab;
    var root = document.documentElement;
    if (!root) {
      return;
    }
    if (!pin || location.pathname !== pin.path) {
      root.removeAttribute(PIN_ATTR);
      return;
    }
    var lists = document.querySelectorAll('[role="tablist"]');
    var tabs = null;
    for (var i = 0; i < lists.length && !tabs; i++) {
      var found = lists[i].querySelectorAll('[role="tab"]');
      if (found.length > pin.index) {
        tabs = found;
      }
    }
    if (!tabs) {
      root.setAttribute(PIN_ATTR, '');
      return;
    }
    var wanted = tabs[pin.index];
    if (pin.onlyTab) {
      // Remove every other tab and extra (e.g. "+") in the tab list.
      var list = wanted.closest('[role="tablist"]');
      var items = list ? list.querySelectorAll('[role="presentation"], [role="tab"], a, button') : [];
      for (var k = 0; k < items.length; k++) {
        if (!items[k].contains(wanted) && !wanted.contains(items[k])) {
          items[k].setAttribute(PIN_HIDE_ATTR, '');
        }
      }
    }
    for (var j = 0; j < pin.hideIndexes.length; j++) {
      var tab = tabs[pin.hideIndexes[j]];
      if (tab && tab !== wanted) {
        (tab.closest('[role="presentation"]') || tab).setAttribute(PIN_HIDE_ATTR, '');
      }
    }
    // Another allowed tab (not a hidden one) may stay selected.
    var selected = null;
    for (var s2 = 0; s2 < tabs.length; s2++) {
      if (tabs[s2].getAttribute('aria-selected') === 'true') {
        selected = s2;
      }
    }
    if (selected === pin.index || (selected !== null && !pin.onlyTab && pin.hideIndexes.indexOf(selected) === -1)) {
      root.removeAttribute(PIN_ATTR);
      return;
    }
    root.setAttribute(PIN_ATTR, '');
    if (Date.now() - lastPinClick > 1000) {
      lastPinClick = Date.now();
      wanted.click();
    }
  }

  function hasContent() {
    return document.querySelector(config.contentSelector) !== null;
  }

  function fireSettled() {
    settleTimer = null;
    if (settlePath === null) {
      return;
    }
    if (!hasContent() && Date.now() < settleDeadline) {
      settleTimer = setTimeout(fireSettled, 150);
      return;
    }
    settlePath = null;
    post({ type: 'PAGE_READY', path: location.pathname || '/' });
  }

  function armSettle() {
    if (settleTimer) {
      clearTimeout(settleTimer);
    }
    var now = Date.now();
    var wait = Math.min(SETTLE_QUIET_MS, settleDeadline - now);
    if (hasContent()) {
      if (!contentSeenAt) {
        contentSeenAt = now;
      }
      wait = Math.min(wait, contentSeenAt + CONTENT_GRACE_MS - now);
    }
    settleTimer = setTimeout(fireSettled, Math.max(0, wait));
  }

  // A page counts as settled once the DOM has been quiet for a moment
  // and real content exists (or after SETTLE_MAX_MS at the latest).
  function markSettling() {
    settlePath = location.pathname || '/';
    settleDeadline = Date.now() + SETTLE_MAX_MS;
    contentSeenAt = 0;
    armSettle();
  }

  // Batched: at most one DOM pass per frame, and no more than every
  // DOM_WORK_MIN_GAP_MS while Instagram keeps mutating (e.g. scrolling).
  function onDomChanged() {
    if (domWorkScheduled) {
      return;
    }
    domWorkScheduled = true;
    var gap = Date.now() - lastDomWork;
    setTimeout(function () {
      domWorkScheduled = false;
      lastDomWork = Date.now();
      safeCheck();
      if (settlePath !== null) {
        armSettle();
      }
    }, Math.max(16, DOM_WORK_MIN_GAP_MS - gap));
  }

  function hasLabel(article, labels) {
    var nodes = article.querySelectorAll('span, a, div, h2');
    var limit = Math.min(nodes.length, 60);
    for (var i = 0; i < limit; i++) {
      if (nodes[i].childElementCount === 0) {
        var text = (nodes[i].textContent || '').trim().toLowerCase();
        if (text && text.length <= 40 && labels.indexOf(text) !== -1) {
          return true;
        }
      }
    }
    return false;
  }

  function filterPosts() {
    if (!config.sponsoredLabels.length && !config.suggestedLabels.length) {
      return;
    }
    var articles = document.querySelectorAll('article:not([' + HIDDEN_ATTR + '])');
    for (var i = 0; i < articles.length; i++) {
      var article = articles[i];
      var scans = Number(article.getAttribute(SCAN_ATTR) || 0);
      if (scans >= MAX_SCANS) {
        continue;
      }
      article.setAttribute(SCAN_ATTR, String(scans + 1));
      var kind = hasLabel(article, config.sponsoredLabels)
        ? 'sponsored'
        : hasLabel(article, config.suggestedLabels)
        ? 'suggested'
        : null;
      if (kind) {
        article.setAttribute(HIDDEN_ATTR, kind);
        post({ type: 'CONTENT_HIDDEN', kind: kind });
      }
    }
  }

  // Undo hiding that the current config no longer asks for, and rescan.
  function resetPostFilter() {
    var hidden = document.querySelectorAll('[' + HIDDEN_ATTR + ']');
    for (var i = 0; i < hidden.length; i++) {
      var kind = hidden[i].getAttribute(HIDDEN_ATTR);
      var labels = kind === 'sponsored' ? config.sponsoredLabels : config.suggestedLabels;
      if (!labels.length) {
        hidden[i].removeAttribute(HIDDEN_ATTR);
      }
    }
    var scanned = document.querySelectorAll('[' + SCAN_ATTR + ']');
    for (var j = 0; j < scanned.length; j++) {
      scanned[j].removeAttribute(SCAN_ATTR);
    }
  }

  function redirectOnce(target, replace) {
    if (Date.now() - lastRedirectAt < 3000) {
      return;
    }
    lastRedirectAt = Date.now();
    if (replace && config.spaNavigate) {
      spaGo(target, true);
    } else if (replace) {
      // Indirection only so tests can observe full-page redirects.
      (w.__focusReplaceForTests || location.replace.bind(location))(target);
    } else {
      navigate(target);
    }
  }

  function check() {
    if (!isGuardedHost()) {
      return;
    }
    ensureStyle(false);
    tidyAppNav();
    pinTab();
    if (config.service === 'instagram') {
      hideFollowingBackLink();
    }
    var path = location.pathname || '/';
    if (ptrState === 'refreshing' && path !== ptrPath) {
      finishRefresh();
    }
    var root = document.documentElement;
    if (root) {
      if (path === '/') {
        root.setAttribute(ROUTE_ATTR, 'home');
      } else {
        root.removeAttribute(ROUTE_ATTR);
      }
    }
    var reason = reasonFor(path);
    var redirect = reason ? config.redirects[reason] : null;
    if (redirect) {
      // E.g. "Messages only" (Instagram home → inbox) or YouTube home →
      // subscriptions: go there quietly instead of showing a block screen.
      redirectOnce(redirect, false);
      lastRoutePath = path;
      return;
    }
    if (
      !reason &&
      path === '/' &&
      config.homeFeed === 'following' &&
      !/[?&]variant=/.test(location.search)
    ) {
      redirectOnce(config.followingPath, true);
    }
    filterPosts();
    if (reason) {
      if (!blocked || lastRoutePath !== path) {
        setBlocked(true);
        post({ type: 'BLOCKED_ROUTE', path: path, reason: reason, navigated: true });
      }
    } else {
      if (blocked) {
        setBlocked(false);
      }
      lastAllowedPath = path;
      if (lastRoutePath !== path) {
        post({ type: 'ROUTE_CHANGED', path: path });
        markSettling();
        // The app shows the full tab bar on every new page.
        compact = false;
        lastScrollY = 0;
      }
    }
    lastRoutePath = path;
  }

  function safeCheck() {
    try {
      check();
    } catch (e) {
      post({ type: 'FILTER_ERROR', code: 'CHECK_FAILED' });
    }
  }

  function configure(next) {
    config = next;
    var compiled = [];
    for (var i = 0; i < next.rules.length; i++) {
      var rule = next.rules[i];
      try {
        compiled.push({
          re: new RegExp(rule.pattern, 'i'),
          host: rule.host,
          effect: rule.effect,
          reason: rule.reason
        });
      } catch (e) {
        post({ type: 'FILTER_ERROR', code: 'BAD_RULE' });
      }
    }
    rules = compiled;
    ensureStyle(true);
    resetPostFilter();
    lastRoutePath = null;
    safeCheck();
  }

  function wrapHistory(name) {
    var original = history[name];
    if (typeof original !== 'function') {
      return;
    }
    history[name] = function () {
      var result = original.apply(this, arguments);
      safeCheck();
      return result;
    };
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }
  }

  function onClick(event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor || !isGuardedHost()) {
      return;
    }
    var url;
    try {
      url = new URL(anchor.getAttribute('href'), location.href);
    } catch (e) {
      return;
    }
    if (config.guardedHosts.indexOf(url.hostname) === -1) {
      return;
    }
    if (config.searchPaths.indexOf(url.pathname) !== -1) {
      stop(event);
      post({ type: 'OPEN_SEARCH' });
      return;
    }
    var reason = reasonFor(url.pathname, url.hostname);
    if (reason) {
      stop(event);
      post({ type: 'BLOCKED_ROUTE', path: url.pathname, reason: reason, navigated: false });
    }
  }

  function leaveBlocked() {
    var fallback = lastAllowedPath || '/';
    if (lastAllowedPath && history.length > 1) {
      history.back();
      setTimeout(function () {
        if (reasonFor(location.pathname)) {
          location.replace(fallback);
        }
      }, 800);
    } else {
      location.replace(fallback);
    }
  }

  function hasFreshContent() {
    var nodes = document.querySelectorAll(config.contentSelector);
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].hasAttribute(OLD_ATTR)) {
        return true;
      }
    }
    return false;
  }

  // Client-side navigation like the site's own back/forward: change the
  // URL, let its router render. If nothing new shows up, load normally.
  function spaGo(path, replace) {
    var old = document.querySelectorAll(config.contentSelector);
    for (var i = 0; i < old.length; i++) {
      old[i].setAttribute(OLD_ATTR, '');
    }
    var full = function () {
      (w.__focusReplaceForTests || location.replace.bind(location))(path);
    };
    try {
      history[replace ? 'replaceState' : 'pushState'](null, '', path);
      w.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    } catch (e) {
      full();
      return;
    }
    markSettling();
    var started = Date.now();
    var verify = function () {
      if (location.pathname + location.search !== path) {
        return; // The user went on already.
      }
      if (hasFreshContent()) {
        return;
      }
      if (Date.now() - started >= SPA_VERIFY_MS) {
        full();
        return;
      }
      setTimeout(verify, 100);
    };
    setTimeout(verify, 100);
  }

  // Reddit: the joined communities, read with the user's own session.
  function fetchSubscriptions() {
    fetch('/subreddits/mine/subscriber.json?limit=100&raw_json=1', {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        var children = data && data.data && data.data.children;
        if (!children || !children.length) {
          return;
        }
        var names = [];
        for (var i = 0; i < children.length && names.length < 100; i++) {
          var name = children[i] && children[i].data && children[i].data.display_name;
          if (typeof name === 'string' && /^[A-Za-z0-9_]{2,21}$/.test(name) && !/^u_/.test(name)) {
            names.push(name);
          }
        }
        post({ type: 'SUBSCRIPTIONS', names: names });
      })
      .catch(function () {});
  }

  function navigate(path) {
    if (typeof path !== 'string' || !SAFE_PATH.test(path)) {
      return;
    }
    if (!isGuardedHost()) {
      location.assign(config.origin + path);
      return;
    }
    if (reasonFor(path.split('?')[0])) {
      return;
    }
    var anchor = document.querySelector('a[href="' + path + '"]');
    if (anchor) {
      anchor.click();
      markSettling();
    } else if (config.spaNavigate) {
      spaGo(path, false);
    } else {
      location.assign(path);
    }
  }

  function search(query, requestId) {
    var q = encodeURIComponent(String(query).slice(0, 64));
    var urls = [
      '/api/v1/web/search/topsearch/?context=user&query=' + q,
      '/web/search/topsearch/?context=user&query=' + q
    ];
    function done(ok, users) {
      post({ type: 'SEARCH_RESULTS', requestId: requestId, ok: ok, users: users });
    }
    function attempt(i) {
      if (i >= urls.length) {
        done(false, []);
        return;
      }
      fetch(urls[i], {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-IG-App-ID': config.webAppId,
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('http');
          }
          return response.json();
        })
        .then(function (data) {
          var list = (data && data.users) || [];
          var users = [];
          for (var j = 0; j < list.length && users.length < 20; j++) {
            var u = list[j] && (list[j].user || list[j]);
            if (u && typeof u.username === 'string') {
              users.push({
                username: u.username,
                fullName: typeof u.full_name === 'string' ? u.full_name : '',
                verified: u.is_verified === true
              });
            }
          }
          done(true, users);
        })
        .catch(function () {
          attempt(i + 1);
        });
    }
    attempt(0);
  }

  function scrollToTop() {
    try {
      w.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      w.scrollTo(0, 0);
    }
  }

  Object.defineProperty(w, '__focusGuard', {
    value: Object.freeze({
      configure: configure,
      leaveBlocked: leaveBlocked,
      navigate: navigate,
      search: search,
      scrollToTop: scrollToTop
    }),
    writable: false,
    configurable: false
  });

  var touchOptions = { passive: true, capture: true };
  w.addEventListener(
    'touchstart',
    function (event) {
      touching = true;
      onSwipeStart(event);
    },
    touchOptions
  );
  w.addEventListener('touchend', onTouchEnd, touchOptions);
  w.addEventListener('touchend', onSwipeEnd, touchOptions);
  w.addEventListener('scroll', onScrollForBar, { passive: true, capture: true });
  w.addEventListener('touchcancel', onTouchEnd, touchOptions);
  w.addEventListener('scroll', onScrollForPtr, { passive: true });

  if (config.fetchSubscriptions && isGuardedHost()) {
    setTimeout(fetchSubscriptions, 1500);
  }

  wrapHistory('pushState');
  wrapHistory('replaceState');
  w.addEventListener('popstate', safeCheck);
  w.addEventListener('click', onClick, true);
  document.addEventListener(
    'play',
    function (event) {
      if (blocked && event.target && event.target.pause) {
        event.target.pause();
      }
    },
    true
  );

  try {
    new MutationObserver(onDomChanged).observe(document.documentElement || document, {
      childList: true,
      subtree: true
    });
  } catch (e) {
    post({ type: 'FILTER_ERROR', code: 'NO_OBSERVER' });
  }

  configure(config);
  post({ type: 'FILTER_READY', version: config.version });

  document.addEventListener('DOMContentLoaded', function () {
    lastRoutePath = null;
    safeCheck();
    post({ type: 'FILTER_READY', version: config.version });
  });

  setInterval(safeCheck, 1000);
})`;

/** Applies a new config to an already running guard. */
export function configureScript(config: GuardConfig): string {
  return `(function(){if(window.__focusGuard){window.__focusGuard.configure(${JSON.stringify(
    config,
  )});}})();true;`;
}

export function buildGuardScript(
  config: GuardConfig = buildGuardConfig(),
): string {
  return `${GUARD_SOURCE}(${JSON.stringify(config)});\ntrue;`;
}

const CALLABLE_PATH = /^\/[A-Za-z0-9._\-/@+]*(\?[A-Za-z0-9_=&%.+-]*)?$/;

/** Script that navigates inside Instagram, preferring SPA navigation. */
export function navigateScript(path: string): string | null {
  if (!CALLABLE_PATH.test(path)) {
    return null;
  }
  const p = JSON.stringify(path);
  const absolute = JSON.stringify(INSTAGRAM_ORIGIN + path);
  return `(function(){if(window.__focusGuard){window.__focusGuard.navigate(${p});}else{location.assign(${absolute});}})();true;`;
}

export const LEAVE_BLOCKED_SCRIPT =
  "(function(){if(window.__focusGuard){window.__focusGuard.leaveBlocked();}else{location.replace('/');}})();true;";

export const PAUSE_MEDIA_SCRIPT =
  "(function(){var m=document.querySelectorAll('video,audio');for(var i=0;i<m.length;i++){try{m[i].pause();}catch(e){}}})();true;";

export const SCROLL_TO_TOP_SCRIPT =
  '(function(){if(window.__focusGuard){window.__focusGuard.scrollToTop();}})();true;';

export function searchScript(query: string, requestId: number): string {
  return `(function(){if(window.__focusGuard){window.__focusGuard.search(${JSON.stringify(
    query.slice(0, 64),
  )},${Math.trunc(requestId)});}})();true;`;
}
