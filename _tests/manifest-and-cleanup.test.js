'use strict';

// L7 (web manifest) and N11 (dead code).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadPage } = require('./helpers/page');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('site.webmanifest uses the current background, theme colour and tagline', () => {
  const m = JSON.parse(read('site.webmanifest'));
  assert.equal(m.background_color, '#F5F4EF');
  assert.equal(m.theme_color, '#F5F4EF');
  assert.equal(m.description, 'Settle money with your people.');
});

test('site.webmanifest theme colour matches the pages\' theme-color meta', (t) => {
  const m = JSON.parse(read('site.webmanifest'));
  for (const page of ['index.html', 'download.html', 'support.html']) {
    const p = loadPage(page);
    t.after(p.close);
    const meta = p.document.querySelector('meta[name="theme-color"]');
    assert.equal(meta.getAttribute('content'), m.theme_color, page);
  }
});

test('index: no leftover "scrolled" nav class code (no CSS uses it)', (t) => {
  const p = loadPage('index.html');
  t.after(p.close);
  assert.ok(!read('index.html').includes('scrolled'));
  p.window.scrollY = 100;
  p.document.dispatchEvent(new p.window.Event('scroll'));
  assert.ok(!p.document.getElementById('nav').classList.contains('scrolled'));
});

test('download: no unused isAndroid', () => {
  assert.ok(!read('download.html').includes('isAndroid'));
});
