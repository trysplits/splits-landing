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
  $('demo-again').click();
  assert.equal($('demo').dataset.done, 'false');
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
