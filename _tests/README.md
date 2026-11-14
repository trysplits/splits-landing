# _tests

Tests and build scripts for the landing pages. This folder starts with `_`, so GitHub Pages (Jekyll) does not
publish it.

```bash
cd _tests
npm ci      # once
npm test
```

## Editing the FAQ

`faq.json` at the repo root is the single source of the FAQ. It feeds the visible FAQ on trysplits.com, the
JSON-LD `FAQPage` that search engines read, and the Help screen in the Splits app.

1. Edit `faq.json` (repo root). Keep plain text: curly apostrophes and quotes, no em dashes, no markup. Keep
   1 to 100 entries, each question and answer at most 2,000 characters, and no two questions the same (compared
   ignoring case and outer spaces), or the app ignores the file.
2. Regenerate the page: `cd _tests && npm run generate:faq`. This rewrites the two marked FAQ blocks in
   `index.html`.
3. Run the tests: `npm test`. `faq.test.js` fails if `index.html` no longer matches `faq.json`.
4. Commit `faq.json` and `index.html` together, and merge to main.

The app reads `https://trysplits.com/faq.json` live, so no app release is needed. Once the site deploys, the
app picks the edit up the next time someone opens Help. The file is served with a 10-minute cache, so allow up
to 10 minutes. The app keeps a bundled snapshot (`splits-mobile/constants/faq.json`) only as an offline fallback,
and it doesn't need to match.
