# MVP Strategy and Architecture

## Goal

Deliver the competency-test-first implementation path that directly overlaps with Issue #64:

- Add a Zap affordance on tweet cards.
- Gate visibility using nostr.directory verified identity mapping.

## Why Firestore Query Instead of Scraping

nostr.directory frontend bundles contain Firebase/Firestore configuration and query patterns.

Reliable query path:

- Endpoint: `POST https://firestore.googleapis.com/v1/projects/nostrdirectory/databases/(default)/documents:runQuery`
- Collection: `twitter`
- Filter: `lcScreenName == handle`

This gives stable structured JSON and avoids brittle DOM scraping.

## Runtime Components

- `FirestoreHandleVerifier`
  - Normalizes handles (`@name` -> `name`)
  - Performs runQuery requests
  - Enforces verification criteria (`verified && isValid && nPubKey`)
  - Uses inflight dedupe + TTL cache + concurrency limiter
- `XVerifiedButtonInjector`
  - Watches timeline updates with `MutationObserver`
  - Extracts tweet author handles from resilient anchor patterns
  - Maintains tweet identity keys to avoid stale injected state
  - Injects or removes button idempotently
- `Button renderer`
  - Lightweight, accessible button with verified profile deep link to nostr.directory

## Risk Controls

- Public API instability:
  - Encapsulated in verifier module for future provider swap.
- X DOM churn:
  - Selector strategy uses multiple fallbacks and idempotent reinjection.
- Request volume:
  - Handle-level memoization and negative-result caching reduce traffic.

## Next Steps Beyond MVP

1. Replace profile-link click with real zap workflow.
2. Add integration tests for selector drift and verifier parsing.
3. Expand to YouTube after X path is stable.
