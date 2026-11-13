'use strict';

// Privacy policy facts the owner approved on 2026-11-13: the AI summary disclosure, in-app account
// deletion, the named service providers, and curly quotes in the copy.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers/page');

function bodyText(t) {
  const p = loadPage('privacy.html');
  t.after(p.close);
  return p.document.querySelector('article.legal').textContent.replace(/\s+/g, ' ');
}

test('privacy: discloses what an AI summary sends to Anthropic', (t) => {
  const text = bodyText(t);
  assert.match(text, /to write the short AI summary on a split/);
  assert.match(text, /An AI summary sends the names of the people in the split, its item names and the split’s title\./);
  assert.match(text, /The app asks for your permission before any of this is sent\./);
});

test('privacy: says where to delete an account in the app', (t) => {
  assert.match(bodyText(t), /under Profile → Delete account\./);
});

test('privacy: names every service provider', (t) => {
  const text = bodyText(t);
  for (const name of ['Amazon Web Services', 'Anthropic', 'Railway', 'Resend', 'PostHog', 'Sentry', 'Expo',
    'GitHub Pages', 'Cloudflare', 'Airtable']) {
    assert.ok(text.includes(name), `missing provider: ${name}`);
  }
});

test('privacy: copy uses curly apostrophes and quotes, and no em dashes', (t) => {
  const text = bodyText(t);
  assert.doesNotMatch(text, /['"]/);
  assert.doesNotMatch(text, /\u2014/);
  assert.match(text, /with your name replaced by “Deleted User”\./);
});
