import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FIRESTORE_RUN_QUERY_URL =
  "https://firestore.googleapis.com/v1/projects/nostrdirectory/databases/(default)/documents:runQuery";

const MAX_QUERY_ROWS = 400;
const OUTPUT_COUNT = 10;

const NOSTR_KEYWORDS = ["nostr", "npub", "nip-05", "nip05", "relay", "zap", "zaps"];
const BITCOIN_KEYWORDS = ["bitcoin", "btc", "sats", "lightning", "bitcoiner", "ln", "cashu", "ecash", "pleb"];
const NPUB_PATTERN = /\bnpub1[023456789acdefghjklmnpqrstuvwxyz]{20,120}\b/gi;
const NIP05_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const LIGHTNING_HINTS = ["getalby", "ln.tips", "zbd.gg", "walletofsatoshi", "lightning"];

async function main() {
  const rows = await fetchVerifiedRows();
  const candidates = rows
    .map(parseCandidate)
    .filter((item) => item !== null)
    .map((item) => scoreCandidate(item))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return b.followers - a.followers;
    });

  const uniqueByHandle = [];
  const seenHandles = new Set();

  for (const item of candidates) {
    if (seenHandles.has(item.handle)) {
      continue;
    }
    seenHandles.add(item.handle);
    uniqueByHandle.push(item);
    if (uniqueByHandle.length >= OUTPUT_COUNT) {
      break;
    }
  }

  if (uniqueByHandle.length < OUTPUT_COUNT) {
    throw new Error(
      `Only found ${uniqueByHandle.length} candidates. Increase query size or adjust filters.`
    );
  }

  writeArtifacts(uniqueByHandle);
  console.log(`Generated competency profile demo with ${uniqueByHandle.length} profiles.`);
}

async function fetchVerifiedRows() {
  const payload = {
    structuredQuery: {
      from: [{ collectionId: "twitter" }],
      select: {
        fields: [
          { fieldPath: "screenName" },
          { fieldPath: "userName" },
          { fieldPath: "nPubKey" },
          { fieldPath: "pubkey" },
          { fieldPath: "verified" },
          { fieldPath: "isValid" },
          { fieldPath: "user" },
          { fieldPath: "text" },
          { fieldPath: "extended_tweet" }
        ]
      },
      where: {
        fieldFilter: {
          field: { fieldPath: "verified" },
          op: "EQUAL",
          value: { booleanValue: true }
        }
      },
      limit: MAX_QUERY_ROWS
    }
  };

  const response = await fetch(FIRESTORE_RUN_QUERY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Firestore query failed with status ${response.status}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Unexpected Firestore response payload");
  }

  return rows;
}

function parseCandidate(row) {
  const fields = row?.document?.fields;
  if (!fields) {
    return null;
  }

  const handle = getString(fields, "screenName");
  const userName = getString(fields, "userName") ?? "";
  const npub = getString(fields, "nPubKey") ?? getString(fields, "pubkey");
  const verified = getBool(fields, "verified") === true;
  const isValid = getBool(fields, "isValid") === true;

  if (!verified || !isValid || !handle || !npub) {
    return null;
  }

  const bio = getNestedString(fields, ["user", "description"]) ?? "";
  const followers = Number.parseInt(getNestedString(fields, ["user", "followers_count"]) ?? "0", 10) || 0;
  const text =
    getString(fields, "text") ??
    getNestedString(fields, ["extended_tweet", "full_text"]) ??
    "";

  return {
    handle,
    userName,
    npub,
    bio,
    text,
    followers
  };
}

function scoreCandidate(candidate) {
  const mergedText = `${candidate.bio}\n${candidate.text}`.toLowerCase();
  const matchedNostr = NOSTR_KEYWORDS.filter((word) => mergedText.includes(word));
  const matchedBitcoin = BITCOIN_KEYWORDS.filter((word) => mergedText.includes(word));

  const npubMentions = extractMatches(NPUB_PATTERN, `${candidate.bio}\n${candidate.text}`);
  const nip05Candidates = extractMatches(NIP05_PATTERN, `${candidate.bio}\n${candidate.text}`);

  const lightningAddresses = nip05Candidates.filter((identifier) => {
    const normalized = identifier.toLowerCase();
    return LIGHTNING_HINTS.some((hint) => normalized.includes(hint));
  });

  let score = 0;
  if (matchedNostr.length > 0) {
    score += 2;
  }
  if (matchedBitcoin.length > 0) {
    score += 2;
  }
  if (npubMentions.length > 0) {
    score += 2;
  }
  if (nip05Candidates.length > 0) {
    score += 1;
  }
  if (lightningAddresses.length > 0) {
    score += 1;
  }

  return {
    ...candidate,
    score,
    signals: {
      matchedNostr,
      matchedBitcoin,
      npubMentions,
      nip05Candidates,
      lightningAddresses
    }
  };
}

function writeArtifacts(profiles) {
  const root = resolve(process.cwd());
  const outputDir = resolve(root, "docs/competency-test");
  mkdirSync(outputDir, { recursive: true });

  const generatedAt = new Date().toISOString();

  const jsonOutput = {
    generatedAt,
    source: "nostr.directory Firestore (twitter collection)",
    query: "verified == true, then filter locally: isValid == true, npub exists",
    selection: "Top scored Bitcoin/Nostr profiles by bio/tweet signal heuristics",
    profiles: profiles.map((profile) => ({
      handle: profile.handle,
      userName: profile.userName,
      npub: profile.npub,
      followers: profile.followers,
      profileUrl: `https://x.com/${profile.handle}`,
      signals: profile.signals,
      bioSnippet: truncate(profile.bio, 220)
    }))
  };

  writeFileSync(resolve(outputDir, "profiles-demo.json"), `${JSON.stringify(jsonOutput, null, 2)}\n`, "utf8");

  const rows = profiles
    .map((profile, index) => {
      const signalParts = [
        ...profile.signals.matchedNostr,
        ...profile.signals.matchedBitcoin,
        ...(profile.signals.npubMentions.length > 0 ? ["npub"] : []),
        ...(profile.signals.nip05Candidates.length > 0 ? ["nip05"] : []),
        ...(profile.signals.lightningAddresses.length > 0 ? ["lightning"] : [])
      ];
      const uniqueSignals = [...new Set(signalParts)].join(", ");
      const oneLineBio = profile.bio.replace(/\s+/g, " ").trim();
      const safeBio = truncate(oneLineBio.replace(/\|/g, "\\|"), 120);

      return `| ${index + 1} | @${profile.handle} | ${profile.npub} | ${uniqueSignals || "-"} | ${safeBio} |`;
    })
    .join("\n");

  const markdown = `# Competency Test: Real Profile Demonstration\n\nGenerated at: ${generatedAt}\n\nSource: nostr.directory Firestore snapshot of X-linked identities.\n\n| # | X Handle | npub | Detected Signals | Bio Snippet |\n| --- | --- | --- | --- | --- |\n${rows}\n`;

  writeFileSync(resolve(outputDir, "profiles-demo.md"), markdown, "utf8");
}

function extractMatches(pattern, value) {
  const matches = value.match(pattern) ?? [];
  return [...new Set(matches.map((item) => item.toLowerCase()))];
}

function getString(fields, key) {
  return fields[key]?.stringValue;
}

function getBool(fields, key) {
  return fields[key]?.booleanValue;
}

function getNestedString(fields, path) {
  let cursor = fields;

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    const node = cursor?.[segment];

    if (!node) {
      return undefined;
    }

    const isLeaf = index === path.length - 1;
    if (isLeaf) {
      return node.stringValue ?? node.integerValue;
    }

    cursor = node.mapValue?.fields;
  }

  return undefined;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

main().catch((error) => {
  console.error("Failed to generate competency profile demo:", error);
  process.exitCode = 1;
});