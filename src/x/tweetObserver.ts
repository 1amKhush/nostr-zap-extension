import { log } from "../lib/log";
import type { HandleVerifier } from "../verifier/types";
import { ensureButtonStyles, mountVerifiedButton, removeInjectedButton } from "./buttonRenderer";
import { extractTweetHandle, extractTweetKey } from "./handleExtractor";

const TWEET_SELECTOR = 'article[data-testid="tweet"]';

export class XVerifiedButtonInjector {
  private readonly verifier: HandleVerifier;
  private observer: MutationObserver | null = null;
  private readonly pendingRoots = new Set<ParentNode>();
  private scheduledFrame: number | null = null;

  constructor(verifier: HandleVerifier) {
    this.verifier = verifier;
  }

  start(): void {
    ensureButtonStyles();
    this.queueScan(document);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) {
            continue;
          }
          this.queueScan(node);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log.info("X injector started");
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;

    if (this.scheduledFrame !== null) {
      window.cancelAnimationFrame(this.scheduledFrame);
      this.scheduledFrame = null;
    }

    this.pendingRoots.clear();
  }

  private queueScan(root: ParentNode): void {
    this.pendingRoots.add(root);

    if (this.scheduledFrame !== null) {
      return;
    }

    this.scheduledFrame = window.requestAnimationFrame(() => {
      this.scheduledFrame = null;
      this.flushQueuedScans();
    });
  }

  private flushQueuedScans(): void {
    const roots = [...this.pendingRoots];
    this.pendingRoots.clear();

    for (const root of roots) {
      this.scan(root);
    }
  }

  private scan(root: ParentNode): void {
    const tweets = new Set<HTMLElement>();

    if (root instanceof Element && root.matches(TWEET_SELECTOR)) {
      tweets.add(root as HTMLElement);
    }

    if ("querySelectorAll" in root) {
      const discovered = root.querySelectorAll<HTMLElement>(TWEET_SELECTOR);
      discovered.forEach((tweet) => tweets.add(tweet));
    }

    for (const tweet of tweets) {
      this.processTweet(tweet);
    }
  }

  private processTweet(tweet: HTMLElement): void {
    this.refreshTweetIdentity(tweet);

    if (tweet.dataset.sobNpub) {
      const inserted = mountVerifiedButton(tweet, {
        handle: tweet.dataset.sobHandle ?? "",
        npub: tweet.dataset.sobNpub
      });
      tweet.dataset.sobState = inserted ? "verified" : "verified_pending_ui";
      return;
    }

    if (tweet.dataset.sobState === "processing" || tweet.dataset.sobState === "unverified") {
      return;
    }

    tweet.dataset.sobState = "processing";
    void this.resolveVerification(tweet);
  }

  private refreshTweetIdentity(tweet: HTMLElement): void {
    const tweetKey = extractTweetKey(tweet);
    if (!tweetKey) {
      return;
    }

    if (tweet.dataset.sobTweetKey === tweetKey) {
      return;
    }

    tweet.dataset.sobTweetKey = tweetKey;
    tweet.dataset.sobState = "new";
    delete tweet.dataset.sobHandle;
    delete tweet.dataset.sobNpub;
    removeInjectedButton(tweet);
  }

  private async resolveVerification(tweet: HTMLElement): Promise<void> {
    const expectedTweetKey = tweet.dataset.sobTweetKey;
    const handle = extractTweetHandle(tweet);
    if (!handle) {
      tweet.dataset.sobState = "awaiting_handle";
      return;
    }

    const result = await this.verifier.verify(handle);

    // X can recycle article nodes while an async lookup is running.
    if (tweet.dataset.sobTweetKey !== expectedTweetKey) {
      return;
    }

    if (!result.verified || !result.npub) {
      tweet.dataset.sobState = "unverified";
      return;
    }

    tweet.dataset.sobHandle = result.handle;
    tweet.dataset.sobNpub = result.npub;

    const inserted = mountVerifiedButton(tweet, {
      handle: result.handle,
      npub: result.npub
    });

    tweet.dataset.sobState = inserted ? "verified" : "verified_pending_ui";
  }
}
