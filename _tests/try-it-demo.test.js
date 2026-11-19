'use strict';

// The "Try it" demo (2026-11-18): a fixed receipt on the page itself. It makes no request and must add up.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers/page');

function demo(t) {
  const p = loadPage('index.html');
  t.after(p.close);
  const $ = (id) => p.document.getElementById(id);
  const items = [...p.document.querySelectorAll('#demo button.demo-item')];
  return { ...p, $, items };
}

const cents = (el) => Math.round(parseFloat(el.textContent.replace(/[^0-9.]/g, '')) * 100);

test('the receipt adds up: items, 10% tax and 20% tip make the total shown', (t) => {
  const { document } = demo(t);
  const prices = [...document.querySelectorAll('#demo .demo-pr')].map(cents);
  const sub = prices.reduce((a, b) => a + b, 0);
  assert.equal(prices.length, 6);
  assert.equal(document.querySelector('#demo .demo-meta').textContent, '$130.00 · 6 items');
  assert.equal(sub + sub / 10 + sub / 5, 13000);
});

test('every tappable price is a multiple of 10 cents and matches its data-cents', (t) => {
  const { items } = demo(t);
  assert.equal(items.length, 4);
  for (const b of items) {
    assert.equal(Number(b.dataset.cents) % 10, 0);
    assert.equal(cents(b.querySelector('.demo-pr')), Number(b.dataset.cents));
  }
});

test('nothing claimed: $0.00 and "I’m done" is disabled', (t) => {
  const { $ } = demo(t);
  assert.equal($('demo-total').textContent, '$0.00');
  assert.equal($('demo-done').disabled, true);
});

test('claiming items updates the total, then done shows what you owe, and start over resets', (t) => {
  const { $, items, fetchCalls } = demo(t);
  items[0].click(); // $18.00
  items[3].click(); // $9.00
  assert.equal(items[0].getAttribute('aria-pressed'), 'true');
  assert.equal($('demo-total').textContent, '$35.10');
  assert.equal($('demo-break').textContent, 'Items $27.00 + Tax $2.70 + Tip $5.40');
  items[3].click();
  assert.equal($('demo-total').textContent, '$23.40');
  $('demo-done').click();
  assert.equal($('demo').dataset.done, 'true');
  assert.equal($('demo-owe').textContent, '$23.40');
  $('demo-paid').click();
  assert.equal($('demo-finish').dataset.paid, 'true');
  assert.equal($('demo-finish-title').textContent, 'Paid. Sam can see it.');
  $('demo-again').click();
  assert.equal($('demo').dataset.done, 'false');
  assert.equal($('demo-finish').dataset.paid, 'false');
  assert.equal($('demo-owe').textContent, '$0.00');
  assert.equal($('demo-total').textContent, '$0.00');
  assert.equal(fetchCalls.length, 0);
});

test('claiming everything left gives the rest of the bill', (t) => {
  const { $, items } = demo(t);
  items.forEach((b) => b.click());
  assert.equal($('demo-total').textContent, '$81.90'); // $63.00 of the $100.00 in items
});

test('items other people claimed are not buttons', (t) => {
  const { document } = demo(t);
  const taken = [...document.querySelectorAll('#demo .demo-item.taken')];
  assert.equal(taken.length, 2);
  for (const el of taken) assert.notEqual(el.tagName, 'BUTTON');
});

// ── The payer's dashboard reacts to the claim page beside it (2026-11-19) ──
// Laid out as the app's dashboard: Collected counts what has been paid, the ring counts claimed items,
// the Unclaimed list and the "you cover" amount are what nobody has claimed yet.

const unclaimedNames = (document) => [...document.querySelectorAll('#dash .dash-urow[data-u]')]
  .filter((r) => !r.hidden).map((r) => r.querySelector('span').textContent);

test('dashboard starts as the app would show it: 2 of 6 claimed, $48.10 collected, $81.90 to cover', (t) => {
  const { $, document } = demo(t);
  assert.equal($('dash-count').textContent, '2/6');
  assert.equal($('dash-collected').textContent, '$48.10'); // Sam $16.90 + Jake $31.20, both paid
  assert.equal($('dash-paidback').textContent, '1 of 2 paid you back');
  assert.deepEqual(unclaimedNames(document), ['Margherita pizza', 'Pasta al limone', 'Caesar salad', 'Tiramisu']);
  assert.equal($('dash-utax').textContent, '$18.90'); // 30% of the $63.00 nobody claimed
  assert.equal($('dash-cover-btn').textContent, 'Close split \u00B7 you cover $81.90');
  assert.match($('dash-cover-note').textContent, /you cover the \$81\.90 \(tax and tip included\)/);
  assert.equal($('dash-alex-pill').hidden, true);
});

test('the dashboard\'s numbers add up to the bill', (t) => {
  const { document } = demo(t);
  const paid = [...document.querySelectorAll('#dash .dash-row')].slice(0, 2).map((r) => cents(r.querySelector('small b')));
  assert.deepEqual(paid, [1690, 3120]);
  const open = [...document.querySelectorAll('#dash .dash-urow[data-u] b')].map(cents).reduce((a, b) => a + b, 0);
  assert.equal(open, 6300);
  assert.equal(paid[0] + paid[1] + open + open * 0.3, 13000);
});

test('the unclaimed rows on the dashboard are the tappable items on the claim page, in order', (t) => {
  const { document, items } = demo(t);
  const rows = [...document.querySelectorAll('#dash .dash-urow[data-u]')];
  assert.equal(rows.length, items.length);
  rows.forEach((r, i) => {
    assert.equal(r.querySelector('span').textContent, items[i].querySelector('.demo-nm').textContent);
    assert.equal(cents(r.querySelector('b')), Number(items[i].dataset.cents));
  });
});

test('claiming on the left moves the dashboard: ring, unclaimed list, cover amount and Alex\'s row', (t) => {
  const { $, document, items } = demo(t);
  items[0].click(); // Margherita pizza, $18.00
  assert.equal($('dash-count').textContent, '3/6');
  assert.deepEqual(unclaimedNames(document), ['Pasta al limone', 'Caesar salad', 'Tiramisu']);
  assert.equal($('dash-cover-btn').textContent, 'Close split \u00B7 you cover $58.50');
  assert.equal($('dash-utax').textContent, '$13.50');
  assert.equal($('dash-alex-sub').textContent, '1 item');
  assert.equal($('dash-alex-amt').textContent, '$23.40');
  assert.equal($('dash-collected').textContent, '$48.10'); // claimed is not paid
});

test('Mark as paid on the left shows Paid on the dashboard and adds to Collected', (t) => {
  const { $, items } = demo(t);
  items[0].click();
  $('demo-done').click();
  assert.equal($('dash-alex-pill').hidden, true);
  $('demo-paid').click();
  assert.equal($('dash-alex-pill').hidden, false);
  assert.equal($('dash-collected').textContent, '$71.50');
  assert.equal($('dash-paidback').textContent, 'All 2 paid you back');
  $('demo-again').click();
  assert.equal($('dash-count').textContent, '2/6');
  assert.equal($('dash-collected').textContent, '$48.10');
  assert.equal($('dash-alex-pill').hidden, true);
});

test('claiming everything left: 6 of 6, nothing unclaimed, and paying collects the whole bill', (t) => {
  const { $, document, items } = demo(t);
  items.forEach((b) => b.click());
  assert.equal($('dash-count').textContent, '6/6');
  assert.deepEqual(unclaimedNames(document), []);
  assert.equal($('dash-unclaimed').hidden, true);
  assert.equal($('dash-bar').hidden, true);
  assert.equal($('dash-ring').getAttribute('stroke-dashoffset'), '0.00');
  $('demo-done').click();
  $('demo-paid').click();
  assert.equal($('dash-collected').textContent, '$130.00');
});

test('the friend\'s page sits in a browser, with the app\'s web address', (t) => {
  const { document } = demo(t);
  assert.equal(document.querySelector('#try-it .saf-url').textContent.trim(), 'app.trysplits.com');
});
