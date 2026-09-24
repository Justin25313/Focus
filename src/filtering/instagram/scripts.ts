import {
  GUARDED_HOSTS,
  INSTAGRAM_ORIGIN,
  INSTAGRAM_ROUTE_RULES,
  INSTAGRAM_RULE_VERSION,
  RoutePolicy,
  STRICT_POLICY,
} from './routes';

/** Public app id Instagram's own web client sends with API requests. */
const INSTAGRAM_WEB_APP_ID = '936619743392459';

export type GuardConfig = {
  version: string;
  origin: string;
  guardedHosts: string[];
  rules: typeof INSTAGRAM_ROUTE_RULES;
  policy: RoutePolicy;
  /** Link targets that open the native Focus search instead. */
  searchPaths: string[];
  /** Entry points hidden via early CSS (matched on href only, never on text). */
  hiddenLinkSelectors: string[];
  webAppId: string;
};

export function buildGuardConfig(
  policy: RoutePolicy = STRICT_POLICY,
): GuardConfig {
  const hidden: string[] = [];
  if (policy.reels) {
    hidden.push(
      'a[href="/reels/"]',
      'a[href^="/reels/"]',
      'a[href$="/reels/"]',
      'a[href^="https://www.instagram.com/reels/"]',
    );
  }
  return {
    version: INSTAGRAM_RULE_VERSION,
    origin: INSTAGRAM_ORIGIN,
    guardedHosts: [...GUARDED_HOSTS],
    rules: INSTAGRAM_ROUTE_RULES,
    policy,
    searchPaths: policy.explore ? ['/explore/'] : [],
    hiddenLinkSelectors: hidden,
    webAppId: INSTAGRAM_WEB_APP_ID,
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
  var SAFE_PATH = /^\/[A-Za-z0-9._\-\/]*$/;
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

  function reasonFor(path) {
    for (var i = 0; i < rules.length; i++) {
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
    if (config.hiddenLinkSelectors.length) {
      css += config.hiddenLinkSelectors.join(',') + '{display:none!important;}';
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

  function check() {
    if (!isGuardedHost()) {
      return;
    }
    ensureStyle(false);
    var path = location.pathname || '/';
    var reason = reasonFor(path);
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
        compiled.push({ re: new RegExp(rule.pattern, 'i'), effect: rule.effect, reason: rule.reason });
      } catch (e) {
        post({ type: 'FILTER_ERROR', code: 'BAD_RULE' });
      }
    }
    rules = compiled;
    ensureStyle(true);
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
    var reason = reasonFor(url.pathname);
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

  function navigate(path) {
    if (typeof path !== 'string' || !SAFE_PATH.test(path)) {
      return;
    }
    if (!isGuardedHost()) {
      location.assign(config.origin + path);
      return;
    }
    if (reasonFor(path)) {
      return;
    }
    var anchor = document.querySelector('a[href="' + path + '"]');
    if (anchor) {
      anchor.click();
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

  configure(config);
  post({ type: 'FILTER_READY', version: config.version });

  document.addEventListener('DOMContentLoaded', function () {
    lastRoutePath = null;
    safeCheck();
    post({ type: 'FILTER_READY', version: config.version });
  });

  setInterval(safeCheck, 1000);
})`;

export function buildGuardScript(
  config: GuardConfig = buildGuardConfig(),
): string {
  return `${GUARD_SOURCE}(${JSON.stringify(config)});\ntrue;`;
}

const CALLABLE_PATH = /^\/[A-Za-z0-9._\-/]*$/;

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

export const SCROLL_TO_TOP_SCRIPT =
  '(function(){if(window.__focusGuard){window.__focusGuard.scrollToTop();}})();true;';

export function searchScript(query: string, requestId: number): string {
  return `(function(){if(window.__focusGuard){window.__focusGuard.search(${JSON.stringify(
    query.slice(0, 64),
  )},${Math.trunc(requestId)});}})();true;`;
}
