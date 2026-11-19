'use strict';

// The FAQ has one source, faq.json. The visible FAQ and the JSON-LD FAQPage in index.html are
// generated from it (generate-faq.js), and must say exactly the same thing, in the same order,
// with no question that only search engines see. The app reads https://trysplits.com/faq.json live,
// so there is no app copy to keep in sync (editing steps: README.md).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadPage } = require('./helpers/page');
const { render, readFaq, FAQ_PATH, INDEX_PATH } = require('./generate-faq');

const bytes = fs.readFileSync(FAQ_PATH);
const faq = readFaq();
const expected = faq.questions.map(({ q, a }) => ({ q, a }));

function page(t) {
  const p = loadPage('index.html');
  t.after(p.close);
  return p;
}

/** Every object in the page's JSON-LD blocks, arrays flattened. */
function jsonLdNodes(document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
    const data = JSON.parse(s.textContent);
    return Array.isArray(data) ? data : [data];
  });
}

/** Every value of "@type" anywhere under `node`. */
function types(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => types(n, out));
  else if (node && typeof node === 'object') {
    if (node['@type']) out.push(node['@type']);
    Object.values(node).forEach((v) => types(v, out));
  }
  return out;
}

// ── the source file ───────────────────────────────────────────────────

test('faq.json: version 1, 2-space indent, trailing newline, UTF-8 without a BOM', () => {
  const source = bytes.toString('utf8');
  assert.equal(faq.version, 1);
  assert.notEqual(bytes[0], 0xef, 'no BOM');
  assert.equal(source, `${JSON.stringify(JSON.parse(source), null, 2)}\n`);
  assert.deepEqual(Object.keys(JSON.parse(source)), ['version', 'questions']);
  for (const entry of faq.questions) assert.deepEqual(Object.keys(entry), ['q', 'a']);
});

// The app (splits-mobile services/faqService.ts, validateFaq) ignores a file outside these limits and keeps
// its last copy, so an edit past them would never reach the app.
test('faq.json fits what the app accepts: 1 to 100 entries, q and a at most 2,000 characters, no repeated question', () => {
  assert.ok(faq.questions.length >= 1 && faq.questions.length <= 100, `${faq.questions.length} entries`);
  for (const [i, { q, a }] of faq.questions.entries()) {
    assert.ok(q.length <= 2000, `questions[${i}].q is ${q.length} characters`);
    assert.ok(a.length <= 2000, `questions[${i}].a is ${a.length} characters`);
  }
  // Same rule as the app: questions compared trimmed and case-insensitively.
  const seen = new Set();
  for (const [i, { q }] of faq.questions.entries()) {
    const key = q.trim().toLowerCase();
    assert.ok(!seen.has(key), `questions[${i}] repeats an earlier question: ${q}`);
    seen.add(key);
  }
});

test('faq.json: plain text, curly apostrophes and quotes, no em dashes', () => {
  for (const [i, { q, a }] of faq.questions.entries()) {
    for (const s of [q, a]) {
      assert.doesNotMatch(s, /[<>&*_`\\]|\s{2,}|\n/, `questions[${i}] is not plain text: ${s}`);
      assert.doesNotMatch(s, /['"]/, `questions[${i}] has a straight quote: ${s}`);
      assert.ok(!s.includes('—'), `questions[${i}] has an em dash: ${s}`);
    }
  }
});

// ── what the page shows and what search engines read ─────────────────

test('the visible FAQ matches faq.json exactly: same count, order and text', (t) => {
  const { document } = page(t);
  const items = [...document.querySelectorAll('#faq-list .faq-item')];
  const shown = items.map((item) => ({
    q: item.querySelector('.faq-q > span').textContent,
    a: item.querySelector('.faq-a-inner').textContent,
  }));
  assert.deepEqual(shown, expected);
});

test('the JSON-LD has one FAQPage, and its mainEntity matches faq.json exactly', (t) => {
  const { document } = page(t);
  const pages = jsonLdNodes(document).filter((n) => n['@type'] === 'FAQPage');
  assert.equal(pages.length, 1, 'exactly one FAQPage');
  const entities = pages[0].mainEntity.map((e) => {
    assert.equal(e['@type'], 'Question');
    assert.equal(e.acceptedAnswer['@type'], 'Answer');
    return { q: e.name, a: e.acceptedAnswer.text };
  });
  assert.deepEqual(entities, expected);
});

test('no JSON-LD-only questions: every Question in the JSON-LD is in the FAQPage', (t) => {
  const { document } = page(t);
  const nodes = jsonLdNodes(document);
  const all = types(nodes).filter((x) => x === 'Question').length;
  assert.equal(all, faq.questions.length);
});

test('index.html is what the generator builds from faq.json (re-run `npm run generate:faq`)', () => {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.equal(render(faq, html), html, 'index.html is stale: run `npm run generate:faq` in _tests and commit it');
});

// ── accessibility and behaviour kept ─────────────────────────────────

test('the FAQ keeps its heading, and each question is a button with aria-expanded="false"', (t) => {
  const { document } = page(t);
  assert.equal(document.querySelector('#faq .h2').textContent, 'Questions?');
  const buttons = [...document.querySelectorAll('#faq-list .faq-item > .faq-q')];
  assert.equal(buttons.length, faq.questions.length);
  for (const b of buttons) {
    assert.equal(b.tagName, 'BUTTON');
    assert.equal(b.getAttribute('aria-expanded'), 'false');
    assert.equal(b.querySelector('svg.chev').getAttribute('aria-hidden'), 'true');
  }
});

test('the FAQ toggle opens one answer at a time and keeps aria-expanded in step', (t) => {
  const { document } = page(t);
  const items = [...document.querySelectorAll('#faq-list .faq-item')];
  const btn = (i) => items[i].querySelector('.faq-q');
  const state = () => items.map((it) => [it.classList.contains('open'), it.querySelector('.faq-q').getAttribute('aria-expanded')]);

  btn(0).click();
  assert.deepEqual(state()[0], [true, 'true']);
  btn(items.length - 1).click();
  assert.deepEqual(state()[0], [false, 'false']);
  assert.deepEqual(state()[items.length - 1], [true, 'true']);
  assert.equal(state().filter(([open]) => open).length, 1);
  btn(items.length - 1).click();
  assert.equal(state().filter(([open]) => open).length, 0);
});

// ── landing lines approved with the FAQ (2026-11-14) ─────────────────

test('JSON-LD featureList: "Pay back with Venmo, Cash App or Zelle"', (t) => {
  const { document } = page(t);
  const app = jsonLdNodes(document).find((n) => n['@type'] === 'SoftwareApplication');
  assert.ok(app.featureList.includes('Pay back with Venmo, Cash App or Zelle'), app.featureList.join(' | '));
  assert.ok(!app.featureList.some((f) => /one-tap settle/i.test(f)));
});

test('settle up feature copy: Venmo or Cash App in a tap, Zelle details, Splits never moves money', (t) => {
  const { document } = page(t);
  const settle = [...document.querySelectorAll('.fx-item')].find(
    (el) => el.querySelector('.fx-title').textContent === 'Settle up in one tap',
  );
  assert.equal(
    settle.querySelector('.fx-desc').textContent,
    'Pay with Venmo or Cash App in a tap, or use your friend’s Zelle details. Splits never moves money itself.',
  );
});

test('no "under 5 seconds" scanning claim anywhere on the page', (t) => {
  const { document } = page(t);
  assert.ok(!document.documentElement.outerHTML.includes('under 5 seconds'));
});

// ── landing lines brought in line with the FAQ (owner, 2026-11-14) ──

const feature = (document, heading) =>
  [...document.querySelectorAll('.fx-item')].find((el) => el.querySelector('.fx-title').textContent === heading);

test('Know where you stand copy: balances with each friend, no "real time" claim', (t) => {
  const { document } = page(t);
  assert.equal(
    feature(document, 'Know where you stand').querySelector('.fx-desc').textContent,
    'See your balance with each friend at a glance. Who owes you and who you owe, across every split and quick expense. No more “hey, did I ever pay you back?”',
  );
});

test('settle image alt: no "exact amount pre-filled"', (t) => {
  const { document } = page(t);
  assert.equal(
    document.querySelector('#fx img[src$="settle.webp"]:not([src$="smart-settle.webp"])').getAttribute('alt'),
    'Settle up screen with Venmo, Cash App and Zelle options',
  );
});

test('Why Splits card: friends see their share, curly apostrophe in the title', (t) => {
  const { document } = page(t);
  const cards = [...document.querySelectorAll('.why-card')];
  const card = cards.find((el) => /need the app\.$/.test(el.querySelector('.why-title').textContent));
  assert.equal(card.querySelector('.why-title').textContent, 'Your friends don’t need the app.');
  assert.equal(
    card.querySelector('.why-body').textContent,
    'Share a link. Your friends open it in any browser and see their share. On a receipt, they tap what they had first. No download, no account, no friction.',
  );
});

test('JSON-LD: ledger feature and Organization description match the FAQ', (t) => {
  const { document } = page(t);
  const nodes = jsonLdNodes(document);
  const app = nodes.find((n) => n['@type'] === 'SoftwareApplication');
  assert.ok(app.featureList.includes('Relationship ledger: one running balance with each friend'), app.featureList.join(' | '));
  assert.ok(!app.featureList.some((f) => /always-current/.test(f)));
  assert.equal(
    nodes.find((n) => n['@type'] === 'Organization').description,
    'Splits helps you and your people settle money fairly and without the awkwardness. AI receipt scanning, one running balance with each friend, and pay back with Venmo, Cash App or Zelle.',
  );
});

test('balances are never described as real time; live claims still are', () => {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.ok(!/updated in real time/i.test(html));
  assert.ok(html.includes('Real-time claim tracking dashboard'));
  assert.ok(html.includes('See claims as they happen.'));
});

// ── Features section (2026-11-18): labels, Smart Settle and reminders, worded as the FAQ words them ──

test('labels and Smart Settle copy matches the FAQ', (t) => {
  const { document } = page(t);
  assert.equal(
    feature(document, 'Keep a trip or a home together').querySelector('.fx-desc').textContent,
    'Labels group splits that belong together, like a trip or a shared home. See what everyone owes for that group in one place.',
  );
  assert.equal(
    feature(document, 'Fewer payments with Smart Settle').querySelector('.fx-desc').textContent,
    'Inside a label, Smart Settle cuts down the number of payments. If Ben owes you and you owe Clara the same amount, Ben pays Clara directly. The label’s owner turns it on, and anyone whose money moved can undo it within 24 hours, as long as the new payment hasn’t been made.',
  );
});

test('picking a feature shows its screen, and only that feature is pressed', (t) => {
  const { document } = page(t);
  const items = [...document.querySelectorAll('#fx .fx-item')];
  const screens = [...document.querySelectorAll('#fx .fx-screens img')];
  assert.equal(items.length, 4);
  assert.equal(screens.length, items.length);
  assert.deepEqual(screens.map((s) => s.classList.contains('on')), [true, false, false, false]);
  items[3].click();
  assert.deepEqual(items.map((b) => b.getAttribute('aria-pressed')), ['false', 'false', 'false', 'true']);
  assert.deepEqual(screens.map((s) => s.classList.contains('on')), [false, false, false, true]);
  assert.match(screens[3].getAttribute('src'), /smart-settle\.webp$/);
});

test('every feature screen is a file in the repo and has alt text', (t) => {
  const { document } = page(t);
  const root = require('node:path').resolve(__dirname, '..');
  for (const img of document.querySelectorAll('#fx .fx-screens img')) {
    const file = require('node:path').join(root, img.getAttribute('src'));
    assert.ok(require('node:fs').existsSync(file), img.getAttribute('src'));
    assert.ok(img.getAttribute('alt').length > 20);
  }
});
