# SoB Nostr Verified Zap Extension (MVP)

This workspace contains a production-quality MVP for the SoB 2026 Nostr Components competency test overlap with Issue #64:

- Runs as a Manifest V3 browser extension.
- Injects a Zap button on X.com / Twitter tweet cards.
- Injects a static Like button on individual tweet pages (`/:handle/status/:id`) for competency validation.
- Shows the button only when the tweet author is verified on nostr.directory.
- Uses live public Firestore lookup against nostr.directory data (no brittle HTML scraping).

## How Verification Works

The verifier queries:

- Firestore project: `nostrdirectory`
- Collection: `twitter`
- Filter: `lcScreenName == <lowercased_handle>`
- Required fields for eligibility:
  - `verified == true`
  - `isValid == true`
  - `nPubKey` exists

## Local Development

```bash
npm install
npm run typecheck
npm run build
npm run competency:profiles
```

Build output is written to `dist/`.

## Load In Browser

1. Build once using `npm run build`.
2. Open browser extension page.
3. Enable developer mode.
4. Load unpacked extension from the `dist/` folder.
5. Open `https://x.com` and scroll timeline.

## Debugging

Set any one of these flags to enable debug logging:

- URL query flag: `?sob_debug=1`
- URL hash flag: `#sob_debug`
- Local storage flag: `localStorage.setItem('sob_debug', '1')`

## Current MVP Scope

Included:

- Static Like button injection for individual tweet pages (competency requirement).
- Verified-only Zap button injection.
- Firestore-backed identity verification.
- Handle-level dedupe cache, TTL caching, and concurrent request limiting.
- Profile crawl demonstration generator for ~10 real Bitcoin/Nostr profiles.

Deferred (outside MVP):

- Real zap execution flow.
- YouTube integration.
- Relay-side URL-zap wiring.

## Competency Test Artifacts

- Implementation details: `docs/competency-test.md`
- Generated profile demo JSON: `docs/competency-test/profiles-demo.json`
- Generated profile demo markdown: `docs/competency-test/profiles-demo.md`
