'use strict';

// L3 (one primary call to action), L5 (copy) and L6 (sentence case), as decided 2026-11-11.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers/page');

function page(t, name) {
  const p = loadPage(name);
  t.after(p.close);
  return p;
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/** Every declaration in the page's <style> for a selector, flattened to "prop:value" strings. */
function rulesFor(doc, selector) {
  const out = [];
  for (const sheet of doc.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.selectorText && rule.selectorText.split(',').map((s) => s.trim()).includes(selector)) {
        for (const prop of rule.style) out.push(`${prop}:${rule.style.getPropertyValue(prop).trim()}`);
      }
    }
  }
  return out;
}

// ── L3 ────────────────────────────────────────────────────────────────

for (const [label, formId, sectionSel] of [
  ['hero', 'hero-form', '#top'],
  ['final CTA', 'cta-form', '#cta'],
]) {
  test(`${label}: "Notify me" is a secondary (outline) button`, (t) => {
    const { document } = page(t, 'index.html');
    const btn = document.querySelector(`#${formId} button[type="submit"]`);
    assert.equal(text(btn), 'Notify me');
    assert.ok(btn.classList.contains('btn-secondary'), `class is "${btn.className}"`);
    assert.ok(!btn.classList.contains('btn-primary'));
  });

  test(`${label}: the App Store badge is the only primary call to action`, (t) => {
    const { document } = page(t, 'index.html');
    const section = document.querySelector(sectionSel);
    assert.equal(section.querySelectorAll('.btn-primary').length, 0);
    assert.equal(section.querySelectorAll('.app-store-badge').length, 1);
  });
}

test('.btn-secondary: green border and text, transparent fill (tokens only)', (t) => {
  const { document } = page(t, 'index.html');
  const decls = rulesFor(document, '.btn-secondary');
  assert.ok(decls.includes('background:transparent'), decls.join('; '));
  assert.ok(decls.includes('color:var(--green)'), decls.join('; '));
  assert.ok(
    decls.some((d) => /^border(-color)?:.*var\(--green\)/.test(d)),
    `no green border in: ${decls.join('; ')}`,
  );
});

// ── L5 ────────────────────────────────────────────────────────────────

test('index: the line under the hero badge says only "Android app coming soon"', (t) => {
  const { document } = page(t, 'index.html');
  const fine = [...document.querySelectorAll('#top .fine')].map(text);
  assert.deepEqual(fine, ['Android app coming soon']);
  assert.ok(!document.body.textContent.includes('Available on the App Store'));
});

test('download: "Android app coming soon"', (t) => {
  const { document } = page(t, 'download.html');
  assert.equal(text(document.querySelector('.android-note')), 'Android app coming soon');
});

test('support: "We usually reply within a day." on the page and in the meta description', (t) => {
  const { document } = page(t, 'support.html');
  assert.equal(text(document.querySelector('.legal .updated')), 'We usually reply within a day.');
  const meta = document.querySelector('meta[name="description"]').getAttribute('content');
  assert.match(meta, /We usually reply within a day\./);
  assert.doesNotMatch(meta, /24.48/);
  assert.ok(!document.documentElement.outerHTML.includes('24–48'));
});

// ── L6 ────────────────────────────────────────────────────────────────

test('index: feature headings are in sentence case', (t) => {
  const { document } = page(t, 'index.html');
  const headings = [...document.querySelectorAll('.feature-showcase-copy .h3')].map(text);
  assert.deepEqual(headings, [
    'AI receipt scanning',
    'Know where you stand',
    'Settle up in one tap',
    'No app? No problem.',
  ]);
});

test('index: the two flow labels are "Receipt split" and "Quick expenses"', (t) => {
  const { document } = page(t, 'index.html');
  assert.equal(text(document.querySelector('.flow-label .eyebrow')), 'Receipt split');
  assert.equal(text(document.querySelector('.flow-divider')), 'Quick expenses');
});
