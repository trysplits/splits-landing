'use strict';

// L1: the "Notify me" forms must report a failed signup instead of showing success.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, respondWith, networkError, settle } = require('./helpers/page');

const WORKER_URL = 'https://splits-waitlist.antonio-d78.workers.dev';
const FAILED = 'Couldn’t sign you up. Try again.';
const INVALID = 'Please enter a valid email address.';

const FORMS = [
  { name: 'hero', form: 'hero-form', success: 'hero-success', error: 'hero-form-error', source: 'hero' },
  { name: 'final CTA', form: 'cta-form', success: 'cta-success', error: 'cta-form-error', source: 'footer-cta' },
];

async function submit(p, ids, email) {
  const form = p.document.getElementById(ids.form);
  form.querySelector('input[type="email"]').value = email;
  form.dispatchEvent(new p.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  return {
    form,
    group: form.closest('.waitlist-form-group'),
    button: form.querySelector('button[type="submit"]'),
    success: p.document.getElementById(ids.success),
    error: p.document.getElementById(ids.error),
  };
}

function assertFailureShown(els) {
  assert.equal(els.error.textContent.trim(), FAILED);
  assert.equal(els.error.getAttribute('role'), 'alert');
  assert.ok(els.error.classList.contains('show'), 'error is shown');
  assert.ok(!els.group.classList.contains('hidden'), 'form stays visible');
  assert.ok(!els.form.classList.contains('hidden'), 'form stays visible');
  assert.ok(!els.success.classList.contains('show'), 'success is not shown');
  assert.equal(els.button.disabled, false, 'button is re-enabled');
  assert.equal(els.button.textContent.trim(), 'Notify me');
}

for (const ids of FORMS) {
  const failures = [
    ['a 502 (Airtable down)', respondWith(502)],
    ['a 400 (rejected email)', respondWith(400)],
    ['a network error', networkError()],
  ];
  for (const [label, stub] of failures) {
    test(`${ids.name} form: ${label} shows the error and keeps the form`, async (t) => {
      const p = loadPage('index.html', { fetch: stub });
      t.after(p.close);
      const els = await submit(p, ids, 'sam@example.com');
      assert.equal(p.fetchCalls.length, 1);
      assertFailureShown(els);
    });
  }

  test(`${ids.name} form: a 2xx hides the form and shows success`, async (t) => {
    const p = loadPage('index.html', { fetch: respondWith(200) });
    t.after(p.close);
    const els = await submit(p, ids, ' sam@example.com ');
    assert.equal(p.fetchCalls.length, 1);
    assert.equal(p.fetchCalls[0].url, WORKER_URL);
    assert.deepEqual(JSON.parse(p.fetchCalls[0].init.body), { email: 'sam@example.com', source: ids.source });
    assert.ok(els.group.classList.contains('hidden'), 'form is hidden');
    assert.ok(els.success.classList.contains('show'), 'success is shown');
    assert.ok(!els.error.classList.contains('show'), 'no error');
  });

  test(`${ids.name} form: after a failure, a retry that succeeds shows success`, async (t) => {
    let status = 502;
    const p = loadPage('index.html', { fetch: async () => respondWith(status)() });
    t.after(p.close);
    assertFailureShown(await submit(p, ids, 'sam@example.com'));
    status = 200;
    const els = await submit(p, ids, 'sam@example.com');
    assert.equal(p.fetchCalls.length, 2);
    assert.ok(els.success.classList.contains('show'));
    assert.ok(!els.error.classList.contains('show'));
  });

  test(`${ids.name} form: an invalid email after a failure shows the validation message, not the failure`, async (t) => {
    const p = loadPage('index.html', { fetch: respondWith(502) });
    t.after(p.close);
    await submit(p, ids, 'sam@example.com');
    const els = await submit(p, ids, 'not-an-email');
    assert.equal(p.fetchCalls.length, 1, 'an invalid email is not sent');
    assert.equal(els.error.textContent.trim(), INVALID);
    assert.ok(els.error.classList.contains('show'));
  });
}
