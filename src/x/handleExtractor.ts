const HANDLE_SEGMENT_PATTERN = /^[a-z0-9_]{1,15}$/i;

const RESERVED_SEGMENTS = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "bookmarks",
  "compose",
  "search",
  "settings",
  "tos",
  "privacy",
  "i",
  "intent",
  "share"
]);

export function extractTweetHandle(node: ParentNode): string | null {
  const selectors = [
    '[data-testid="User-Name"] a[href]',
    'a[href*="/status/"]',
    'a[role="link"][href^="/"]'
  ];

  for (const selector of selectors) {
    const anchors = node.querySelectorAll<HTMLAnchorElement>(selector);
    for (const anchor of Array.from(anchors)) {
      const maybeHandle = parseHandleFromHref(anchor.getAttribute("href"));
      if (maybeHandle) {
        return maybeHandle;
      }
    }
  }

  return null;
}

export function extractTweetKey(node: ParentNode): string | null {
  const statusAnchor = node.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  if (!statusAnchor) {
    return null;
  }

  const href = statusAnchor.getAttribute("href");
  if (!href) {
    return null;
  }

  const url = safelyParseUrl(href);
  if (!url) {
    return null;
  }

  const match = url.pathname.match(/\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

function parseHandleFromHref(href: string | null): string | null {
  if (!href) {
    return null;
  }

  const url = safelyParseUrl(href);
  if (!url) {
    return null;
  }

  if (!isAllowedHost(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const firstSegment = segments[0];
  if (!firstSegment) {
    return null;
  }

  const first = firstSegment.toLowerCase();
  if (RESERVED_SEGMENTS.has(first)) {
    return null;
  }

  if (!HANDLE_SEGMENT_PATTERN.test(first)) {
    return null;
  }

  const secondSegment = segments[1]?.toLowerCase();
  if (secondSegment && secondSegment !== "status") {
    return null;
  }

  return first;
}

function safelyParseUrl(href: string): URL | null {
  try {
    return new URL(href, window.location.origin);
  } catch {
    return null;
  }
}

function isAllowedHost(hostname: string): boolean {
  return hostname === "x.com" || hostname === "www.x.com" || hostname === "twitter.com" || hostname === "www.twitter.com";
}
