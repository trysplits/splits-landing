'use strict';

// Builds the FAQ in index.html from faq.json, the single source of the FAQ text.
//
//   cd _tests && npm run generate:faq
//
// It rewrites two marked blocks in index.html and leaves everything else alone:
//   - the visible FAQ list, between <!-- faq:html:start --> and <!-- faq:html:end -->;
//   - the JSON-LD FAQPage, between <!-- faq:jsonld:start --> and <!-- faq:jsonld:end -->.
// Commit the regenerated index.html with the faq.json change. _tests/faq.test.js fails when the
// two drift apart, so a faq.json edit without a re-run can't pass.
//
// The splits-mobile app reads https://trysplits.com/faq.json live (services/faqService.ts), so a merged
// edit reaches the app without an app release. Editing steps: README.md.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FAQ_PATH = path.join(ROOT, 'faq.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

const NOTE = 'generated from faq.json by _tests/generate-faq.js; edit faq.json, not this block';
const HTML_START = `<!-- faq:html:start (${NOTE}) -->`;
const HTML_END = '<!-- faq:html:end -->';
const JSONLD_START = `<!-- faq:jsonld:start (${NOTE}) -->`;
const JSONLD_END = '<!-- faq:jsonld:end -->';

/** Reads and checks faq.json. Returns the parsed list. */
function readFaq(file = FAQ_PATH) {
  return parseFaq(fs.readFileSync(file, 'utf8'));
}

function parseFaq(source) {
  const faq = JSON.parse(source);
  if (faq.version !== 1) throw new Error(`faq.json: unsupported version ${faq.version}`);
  if (!Array.isArray(faq.questions) || faq.questions.length === 0) throw new Error('faq.json: no questions');
  faq.questions.forEach((entry, i) => {
    for (const key of ['q', 'a']) {
      const v = entry[key];
      if (typeof v !== 'string' || v.trim() === '' || v !== v.trim()) {
        throw new Error(`faq.json: questions[${i}].${key} must be non-empty text without outer spaces`);
      }
    }
  });
  return faq;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderHtml(faq) {
  const items = faq.questions.map(
    ({ q, a }) =>
      `      <div class="faq-item"><button class="faq-q" aria-expanded="false"><span>${escapeHtml(q)}</span>` +
      '<svg class="ic chev" aria-hidden="true" focusable="false"><use href="#i-chevron-down"/></svg></button>\n' +
      `        <div class="faq-a"><div class="faq-a-inner">${escapeHtml(a)}</div></div></div>`,
  );
  return `${HTML_START}\n${items.join('\n')}\n      ${HTML_END}`;
}

function renderJsonLd(faq) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.questions.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  // "<" is escaped so no text can close the <script> element early.
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `${JSONLD_START}\n<script type="application/ld+json">\n${json}\n</script>\n${JSONLD_END}`;
}

function replaceBlock(html, start, end, block) {
  const startTag = start.slice(0, start.indexOf(' ('));
  const from = html.indexOf(startTag);
  const to = html.indexOf(end);
  if (from === -1 || to === -1 || to < from) throw new Error(`index.html: markers ${startTag} … ${end} not found`);
  if (html.indexOf(startTag, from + 1) !== -1) throw new Error(`index.html: ${startTag} appears twice`);
  return html.slice(0, from) + block + html.slice(to + end.length);
}

/** index.html with both FAQ blocks rebuilt from `faq`. Pure: reads and writes nothing. */
function render(faq, html) {
  let out = replaceBlock(html, JSONLD_START, JSONLD_END, renderJsonLd(faq));
  out = replaceBlock(out, HTML_START, HTML_END, renderHtml(faq));
  return out;
}

if (require.main === module) {
  const before = fs.readFileSync(INDEX_PATH, 'utf8');
  const after = render(readFaq(), before);
  if (after === before) {
    console.log('index.html is already up to date with faq.json');
  } else {
    fs.writeFileSync(INDEX_PATH, after);
    console.log('index.html: FAQ and JSON-LD FAQPage rebuilt from faq.json');
  }
}

module.exports = { render, readFaq, parseFaq, FAQ_PATH, INDEX_PATH };
