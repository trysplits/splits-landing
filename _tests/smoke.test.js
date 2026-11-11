'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers/page');

const TITLES = {
  'index.html': /Splits/,
  'download.html': /^Download the Splits app$/,
  'support.html': /^Splits Support$/,
};

for (const [page, title] of Object.entries(TITLES)) {
  test(`${page} loads and runs its scripts without errors`, (t) => {
    const p = loadPage(page);
    t.after(p.close);
    assert.match(p.document.title, title);
    assert.equal(p.fetchCalls.length, 0, 'no request is sent just by loading the page');
  });
}

test('index.html runs its inline scripts (reveal fallback marks sections visible)', (t) => {
  const p = loadPage('index.html');
  t.after(p.close);
  const reveals = p.document.querySelectorAll('.reveal');
  assert.ok(reveals.length > 0);
  assert.equal(p.document.querySelectorAll('.reveal:not(.in)').length, 0);
});
