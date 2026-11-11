'use strict';

// L2: the closed mobile menu must not be in the tab order (at any width); the open one must.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, isTabbable } = require('./helpers/page');

function setup(t) {
  const p = loadPage('index.html');
  t.after(p.close);
  const menu = p.document.getElementById('mobile-menu');
  const btn = p.document.getElementById('menu-btn');
  const focusables = [...menu.querySelectorAll('a[href], button')];
  return { p, menu, btn, focusables };
}

test('mobile menu has the four section links and the App Store badge', (t) => {
  const { focusables } = setup(t);
  assert.equal(focusables.length, 5);
});

test('closed mobile menu: none of its links can be reached with Tab', (t) => {
  const { p, menu, focusables } = setup(t);
  assert.ok(!menu.classList.contains('open'));
  for (const el of focusables) assert.equal(isTabbable(el), false, `${el.outerHTML.slice(0, 60)} is tabbable`);
});

test('open mobile menu: its links are in the tab order and it is not aria-hidden', (t) => {
  const { p, menu, btn, focusables } = setup(t);
  btn.click();
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.ok(menu.classList.contains('open'));
  assert.equal(menu.hasAttribute('aria-hidden'), false, 'open menu must not carry aria-hidden');
  assert.equal(menu.hasAttribute('inert'), false);
  for (const el of focusables) assert.equal(isTabbable(el), true, `${el.outerHTML.slice(0, 60)} is not tabbable`);
});

test('closing the menu again (button, Escape, link) takes its links out of the tab order', (t) => {
  const { p, menu, btn, focusables } = setup(t);
  const closers = [
    () => btn.click(),
    () => p.document.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Escape' })),
    () => focusables[0].click(),
  ];
  for (const close of closers) {
    btn.click();
    assert.ok(menu.classList.contains('open'));
    close();
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    for (const el of focusables) assert.equal(isTabbable(el), false);
  }
});

test('Escape from inside the open menu returns focus to the menu button', (t) => {
  const { p, btn, focusables } = setup(t);
  btn.click();
  focusables[1].focus();
  assert.equal(p.document.activeElement, focusables[1]);
  p.document.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(p.document.activeElement, btn);
});
