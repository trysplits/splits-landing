'use strict';

// Loads one of the landing pages into jsdom, runs its inline scripts and returns the window.
//
// fetch is always stubbed: the pages post to the real Cloudflare Worker, and a test must never
// reach it. Pass `fetch` to choose the response; every call is recorded in `fetchCalls`.

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = new Set(['index.html', 'download.html', 'support.html', 'privacy.html', 'terms.html']);

/** A fetch stub that answers every request with the given HTTP status. */
function respondWith(status) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) });
}

/** A fetch stub that fails like a dropped connection. */
function networkError() {
  return async () => {
    throw new TypeError('Failed to fetch');
  };
}

/**
 * @param {string} page            file name at the repo root, e.g. 'index.html'
 * @param {object} [opts]
 * @param {Function} [opts.fetch]  the stub to install (default: every request answers 200)
 * @param {boolean} [opts.reducedMotion=true]  what `prefers-reduced-motion: reduce` reports;
 *                                 true keeps the looping demo from scheduling timers
 * @param {string} [opts.userAgent]
 * @returns {{ window: Window, document: Document, fetchCalls: Array<{url: string, init: object}>, close: Function }}
 */
function loadPage(page, opts = {}) {
  if (!PAGES.has(page)) throw new Error(`Unknown page: ${page}`);
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const stub = opts.fetch || respondWith(200);
  const reducedMotion = opts.reducedMotion !== false;
  const fetchCalls = [];
  const errors = [];

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(e));

  const dom = new JSDOM(html, {
    url: `https://trysplits.com/${page === 'index.html' ? '' : page.replace(/\.html$/, '')}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    userAgent: opts.userAgent,
    virtualConsole,
    beforeParse(window) {
      window.fetch = (url, init) => {
        fetchCalls.push({ url: String(url), init });
        return stub(url, init);
      };
      window.matchMedia = (query) => ({
        matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reducedMotion : false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
    },
  });

  // Script errors don't throw out of the JSDOM constructor; surface them here instead.
  const scriptErrors = errors.filter((e) => e.type !== 'not implemented');
  if (scriptErrors.length) {
    dom.window.close();
    throw new Error(`${page} threw while loading: ${scriptErrors.map((e) => e.message).join('; ')}`);
  }

  return {
    window: dom.window,
    document: dom.window.document,
    fetchCalls,
    close: () => dom.window.close(),
  };
}

/** Lets pending promise callbacks and zero-delay timers run (e.g. an awaited fetch). */
async function settle(times = 5) {
  for (let i = 0; i < times; i++) await new Promise((r) => setImmediate(r));
}

/**
 * Whether Tab would reach `el` (as far as jsdom can tell). An element is out of the tab order
 * when it, or an ancestor, is `inert`, `hidden`, `display:none` or `visibility:hidden`, or when
 * it has a negative tabindex.
 */
function isTabbable(el) {
  const win = el.ownerDocument.defaultView;
  const focusable =
    (el.matches('a[href], area[href], button, input, select, textarea, summary, [tabindex]') ||
      el.isContentEditable) &&
    !el.disabled;
  if (!focusable) return false;
  const tabindex = el.getAttribute('tabindex');
  if (tabindex !== null && Number(tabindex) < 0) return false;
  if (win.getComputedStyle(el).visibility === 'hidden') return false;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hasAttribute('inert') || n.hidden) return false;
    if (win.getComputedStyle(n).display === 'none') return false;
  }
  return true;
}

module.exports = { loadPage, respondWith, networkError, settle, isTabbable };
