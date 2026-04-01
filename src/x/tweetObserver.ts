import { log } from "../lib/log";
import type { HandleVerifier } from "../verifier/types";
import { ensureButtonStyles, mountVerifiedButton, removeInjectedButton } from "./buttonRenderer";
import { extractTweetHandle, extractTweetKey } from "./handleExtractor";

const TWEET_SELECTOR = 'article[data-testid="tweet"]';

export class XVerifiedButtonInjector {
  private readonly verifier: HandleVerifier;
  private observer: MutationObserver | null = null;

  constructor(verifier: HandleVerifier) {
    this.verifier = verifier;
  }

  start(): void {
    ensureButtonStyles();
    this.scan(document);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) {
            continue;
          }
          this.scan(node);
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
  }

  private scan(root: ParentNode): void {
    const tweets: HTMLElement[] = [];

    if (root instanceof Element && root.matches(TWEET_SELECTOR)) {
      tweets.push(root as HTMLElement);
    }

    if ("querySelectorAll" in root) {
      const discovered = root.querySelectorAll<HTMLElement>(TWEET_SELECTOR);
      discovered.forEach((tweet) => tweets.push(tweet));
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
    const handle = extractTweetHandle(tweet);
    if (!handle) {
      tweet.dataset.sobState = "awaiting_handle";
      return;
    }

    const result = await this.verifier.verify(handle);
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
