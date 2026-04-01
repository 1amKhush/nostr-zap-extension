import { AsyncLimiter } from "../lib/asyncLimiter";
import { log } from "../lib/log";
import { TtlCache } from "../lib/ttlCache";
import type { HandleVerifier, VerificationResult } from "./types";

const FIRESTORE_RUN_QUERY_URL =
  "https://firestore.googleapis.com/v1/projects/nostrdirectory/databases/(default)/documents:runQuery";

const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/i;

interface FirestoreValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  timestampValue?: string;
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreValue>;
}

interface FirestoreRunQueryRow {
  document?: FirestoreDocument;
}

interface FirestoreVerifierOptions {
  requestTimeoutMs?: number;
  maxConcurrentRequests?: number;
  maxCacheEntries?: number;
  positiveTtlMs?: number;
  negativeTtlMs?: number;
}

export class FirestoreHandleVerifier implements HandleVerifier {
  private readonly requestTimeoutMs: number;
  private readonly positiveTtlMs: number;
  private readonly negativeTtlMs: number;
  private readonly cache: TtlCache<string, VerificationResult>;
  private readonly inflight = new Map<string, Promise<VerificationResult>>();
  private readonly limiter: AsyncLimiter;

  constructor(options: FirestoreVerifierOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 4500;
    this.positiveTtlMs = options.positiveTtlMs ?? 30 * 60 * 1000;
    this.negativeTtlMs = options.negativeTtlMs ?? 8 * 60 * 1000;
    this.cache = new TtlCache(options.maxCacheEntries ?? 5000);
    this.limiter = new AsyncLimiter(options.maxConcurrentRequests ?? 4);
  }

  async verify(rawHandle: string): Promise<VerificationResult> {
    const normalized = normalizeHandle(rawHandle);
    if (!normalized) {
      return {
        handle: rawHandle.trim().toLowerCase(),
        verified: false,
        checkedAt: Date.now(),
        reason: "invalid_handle"
      };
    }

    const cached = this.cache.get(normalized);
    if (cached) {
      return cached;
    }

    const inflight = this.inflight.get(normalized);
    if (inflight) {
      return inflight;
    }

    const requestPromise = this.limiter
      .run(() => this.fetchVerification(normalized))
      .finally(() => {
        this.inflight.delete(normalized);
      });

    this.inflight.set(normalized, requestPromise);
    return requestPromise;
  }

  private async fetchVerification(handle: string): Promise<VerificationResult> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const response = await fetch(FIRESTORE_RUN_QUERY_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildQueryPayload(handle)),
        signal: controller.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Firestore lookup failed with status ${response.status}`);
      }

      const rows = (await response.json()) as FirestoreRunQueryRow[];
      const result = toVerificationResult(handle, rows);
      this.cache.set(handle, result, result.verified ? this.positiveTtlMs : this.negativeTtlMs);
      return result;
    } catch (error) {
      const failedResult: VerificationResult = {
        handle,
        verified: false,
        checkedAt: Date.now(),
        reason: "lookup_error"
      };
      this.cache.set(handle, failedResult, 30 * 1000);
      log.warn("Verifier lookup failed", { handle, error });
      return failedResult;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}

function normalizeHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const noPrefix = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const lowered = noPrefix.toLowerCase();

  if (!HANDLE_PATTERN.test(lowered)) {
    return null;
  }

  return lowered;
}

function buildQueryPayload(handle: string): object {
  return {
    structuredQuery: {
      from: [{ collectionId: "twitter" }],
      select: {
        fields: [
          { fieldPath: "screenName" },
          { fieldPath: "lcScreenName" },
          { fieldPath: "nPubKey" },
          { fieldPath: "verified" },
          { fieldPath: "isValid" }
        ]
      },
      where: {
        fieldFilter: {
          field: { fieldPath: "lcScreenName" },
          op: "EQUAL",
          value: { stringValue: handle }
        }
      },
      limit: 1
    }
  };
}

function toVerificationResult(handle: string, rows: FirestoreRunQueryRow[]): VerificationResult {
  const document = rows.find((row) => row.document?.fields)?.document;
  if (!document?.fields) {
    return {
      handle,
      verified: false,
      checkedAt: Date.now(),
      reason: "not_found"
    };
  }

  const fields = document.fields;
  const screenName = getStringField(fields, "screenName");
  const lcScreenName = getStringField(fields, "lcScreenName");
  const npub = getStringField(fields, "nPubKey");
  const verified = getBoolField(fields, "verified") === true;
  const isValid = getBoolField(fields, "isValid") === true;

  const handleMatches = (lcScreenName ?? screenName?.toLowerCase()) === handle;
  const isVerified = Boolean(handleMatches && verified && isValid && npub);

  if (isVerified && npub) {
    return {
      handle,
      verified: true,
      npub,
      checkedAt: Date.now(),
      reason: "verified"
    };
  }

  return {
    handle,
    verified: false,
    checkedAt: Date.now(),
    reason: "unverified"
  };
}

function getStringField(fields: Record<string, FirestoreValue>, key: string): string | undefined {
  return fields[key]?.stringValue;
}

function getBoolField(fields: Record<string, FirestoreValue>, key: string): boolean | undefined {
  return fields[key]?.booleanValue;
}
