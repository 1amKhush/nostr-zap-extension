# Competency Test Delivery (Issue #64 Subset)

This document captures the complete competency-test implementation package requested for Nostr Components.

## Delivered Requirements

1. Browser extension that statically injects a Like button on individual tweet pages.
2. Proposed pubkey crawling strategy.
3. Defined pubkey discovery approach using bio crawling and Bitcoin/Nostr filtering.
4. Demonstration artifact with ~10 real profiles.

## 1) Static Like Injection on Individual Tweet Page

Implemented in `src/competency/staticLikeInjector.ts`:

- Runs as part of the extension content script boot path.
- Activates only on status routes (`/:handle/status/:id`).
- Locates the primary status tweet by matching tweet id from URL.
- Injects a static Like button in the action bar (`div[role="group"]`).
- Button behavior is intentionally static for competency scope: click toggles local pressed state only.

This satisfies the requirement to prove DOM injection capability quickly and reliably on a target tweet URL.

## 2) Pubkey Crawling Strategy

### Data Sources (priority order)

1. `nostr.directory` Firestore mapping (`twitter` collection): fastest authoritative bootstrap.
2. NIP-05 discovery: parse `name@domain` from bios and resolve via `/.well-known/nostr.json?name=`.
3. Bio fallback parsing: detect inline `npub1...` keys and Lightning addresses.

### Discovery Pipeline

1. Collect candidate handles from tweet context and profile exploration.
2. Crawl profile bios (or snapshot equivalent from nostr.directory user payload).
3. Extract identity signals:
   - `npub` regex
   - NIP-05 identifiers (`name@domain`)
   - Lightning hints (`lud16` style addresses or common lightning domains)
4. Filter to Bitcoin/Nostr-relevant profiles using keyword heuristics.
5. Resolve to final pubkey with confidence ranking.

### Confidence Scoring

- High confidence:
  - Verified nostr.directory mapping + valid npub
  - Matching NIP-05 resolution result
- Medium confidence:
  - Inline npub in bio/post text plus Nostr keywords
- Low confidence:
  - Only keyword hints without resolvable pubkey

Only high/medium confidence identities should unlock Zap UI in production.

## 3) Bitcoin/Nostr User Filtering

Heuristic signals used in the demo pipeline:

- Nostr: `nostr`, `npub`, `nip05`, `relay`, `zap`
- Bitcoin: `bitcoin`, `btc`, `sats`, `lightning`, `bitcoiner`, `cashu`, `pleb`

Profiles are ranked by signal score and follower count (tie-breaker), then deduped by handle.

## 4) Real Profile Demonstration (~10)

Run:

```bash
npm run competency:profiles
```

Artifacts generated:

- `docs/competency-test/profiles-demo.json`
- `docs/competency-test/profiles-demo.md`

These are produced from live `nostr.directory` data and include handle, npub, detected signals, and bio snippet.