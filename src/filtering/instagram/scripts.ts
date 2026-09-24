import {
  Controls,
  DEFAULT_CONTROLS,
  HomeFeed,
  policyFor,
} from '../../controls/controls';
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
  /** Hide Instagram's bottom tab bar; Focus shows its own. */
  hideInstagramNav: boolean;
  homeFeed: HomeFeed;
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
    version: INSTAGRAM_RULE_VERSION,
    origin: INSTAGRAM_ORIGIN,
    guardedHosts: [...GUARDED_HOSTS],
    rules: INSTAGRAM_ROUTE_RULES,
    policy,
    searchPaths: policy.explore ? ['/explore/'] : [],
    hiddenLinkSelectors: hidden,
    hideInstagramNav: true,
    homeFeed: controls.homeFeed,
    followingPath: INSTAGRAM_FOLLOWING_PATH,
    inboxPath: INSTAGRAM_INBOX_PATH,
    grayscale,
    sponsoredLabels: controls.hideSponsored ? SPONSORED_LABELS : [],
    suggestedLabels: controls.hideSuggested ? SUGGESTED_LABELS : [],
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
  var NAV_PROBES = 'a[href="/"], a[href="/explore/"], a[href="/direct/inbox/"]';
  var PROFILE_PATH = /^\/([A-Za-z0-9._]{1,30})\/$/;
  var NOT_PROFILES = ['explore', 'reels', 'reel', 'direct', 'accounts', 'p', 'stories', 'tv'];
  var ownProfilePath = null;
  var ROUTE_ATTR = 'data-focus-route';
  var HIDDEN_ATTR = 'data-focus-hidden';
  var SCAN_ATTR = 'data-focus-scan';
  var MAX_SCANS = 5;
  var lastRedirectAt = 0;
  var BACK_ATTR = 'data-focus-hide-back';
  var PTR_ID = 'focus-ptr';
  var PTR_SPACER_ATTR = 'data-focus-ptr-spacer';
  var PTR_THRESHOLD = 70;
  var ptrState = 'idle';
  var ptrPath = null;
  var ptrTimer = null;
  var ptrPull = 0;
  var touching = false;
  var SETTLE_QUIET_MS = 250;
  var SETTLE_MAX_MS = 4000;
  var settlePath = null;
  var settleDeadline = 0;
  var settleTimer = null;
  var domWorkScheduled = false;
  var lastDomWork = 0;
  var DOM_WORK_MIN_GAP_MS = 120;
  var SAFE_PATH = /^\/[A-Za-z0-9._\-\/]*(\?variant=[a-z]+)?$/;
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
    // No scrollbars anywhere, like the native app (inner scrollers too).
    css += '*{scrollbar-width:none!important;}*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}';
    if (config.hiddenLinkSelectors.length) {
      css += config.hiddenLinkSelectors.join(',') + '{display:none!important;}';
    }
    if (config.hideInstagramNav) {
      css += '[' + NAV_ATTR + ']{display:none!important;}';
    }
    css += '[' + HIDDEN_ATTR + ']{display:none!important;}';
    css +=
      '#' + PTR_ID + '{position:fixed;left:50%;width:28px;height:28px;margin-left:-14px;' +
      'z-index:2147483646;pointer-events:none;opacity:0;}' +
      '#' + PTR_ID + '.spin svg{animation:focus-ptr-spin .9s steps(8) infinite;}' +
      '@keyframes focus-ptr-spin{to{transform:rotate(360deg);}}' +
      '[' + PTR_SPACER_ATTR + ']{transition:height .2s ease;overflow:hidden;}';
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

  function tidyInstagramNav() {
    var probes = document.querySelectorAll(NAV_PROBES);
    for (var i = 0; i < probes.length; i++) {
      if (probes[i].closest('[' + NAV_ATTR + ']')) {
        continue;
      }
      var bar = bottomBarFor(probes[i]);
      if (bar) {
        reportOwnProfile(bar);
        if (config.hideInstagramNav) {
          bar.setAttribute(NAV_ATTR, '');
        }
      }
    }
  }

  function hasContent() {
    return document.querySelector('main, [role="main"], article, form, nav') !== null;
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
    var wait = Math.max(0, Math.min(SETTLE_QUIET_MS, settleDeadline - Date.now()));
    settleTimer = setTimeout(fireSettled, wait);
  }

  // A page counts as settled once the DOM has been quiet for a moment
  // and real content exists (or after SETTLE_MAX_MS at the latest).
  function markSettling() {
    settlePath = location.pathname || '/';
    settleDeadline = Date.now() + SETTLE_MAX_MS;
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
    if (replace) {
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
    tidyInstagramNav();
    hideFollowingBackLink();
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
    if (reason === 'feed') {
      // "Messages only": home is never shown, go straight to the inbox.
      redirectOnce(config.inboxPath, false);
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
    if (reasonFor(path.split('?')[0])) {
      return;
    }
    var anchor = document.querySelector('a[href="' + path + '"]');
    if (anchor) {
      anchor.click();
      markSettling();
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
    function () {
      touching = true;
    },
    touchOptions
  );
  w.addEventListener('touchend', onTouchEnd, touchOptions);
  w.addEventListener('touchcancel', onTouchEnd, touchOptions);
  w.addEventListener('scroll', onScrollForPtr, { passive: true });

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

const CALLABLE_PATH = /^\/[A-Za-z0-9._\-/]*(\?variant=[a-z]+)?$/;

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
