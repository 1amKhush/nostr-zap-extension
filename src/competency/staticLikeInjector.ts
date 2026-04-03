import { log } from "../lib/log";
import { extractTweetKey } from "../x/handleExtractor";

const STYLE_ID = "sob-competency-like-style";
const INJECTED_SELECTOR = "[data-sob-static-like='1']";
const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const STATUS_PATH_PATTERN = /^\/[a-z0-9_]{1,15}\/status\/(\d+)/i;

export class XSingleTweetLikeInjector {
  private observer: MutationObserver | null = null;

  start(): void {
    this.ensureStyles();
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

    log.info("Competency static Like injector started");
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private scan(root: ParentNode): void {
    const targetStatusId = this.getStatusIdFromPath(window.location.pathname);
    if (!targetStatusId) {
      return;
    }

    const tweets: HTMLElement[] = [];

    if (root instanceof Element && root.matches(TWEET_SELECTOR)) {
      tweets.push(root as HTMLElement);
    }

    if ("querySelectorAll" in root) {
      const discovered = root.querySelectorAll<HTMLElement>(TWEET_SELECTOR);
      discovered.forEach((tweet) => tweets.push(tweet));
    }

    for (const tweet of tweets) {
      const tweetId = extractTweetKey(tweet);
      if (!tweetId || tweetId !== targetStatusId) {
        continue;
      }

      this.injectStaticLikeButton(tweet);
    }
  }

  private injectStaticLikeButton(tweet: HTMLElement): void {
    const actionGroup = tweet.querySelector<HTMLElement>('div[role="group"]');
    if (!actionGroup) {
      return;
    }

    if (actionGroup.querySelector(INJECTED_SELECTOR)) {
      return;
    }

    const actionContainer = document.createElement("div");
    actionContainer.className = "sob-like-action";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sob-like-button";
    button.dataset.sobStaticLike = "1";
    button.setAttribute("aria-label", "Like (competency test static button)");
    button.setAttribute("aria-pressed", "false");
    button.title = "Competency test: static Like injection";

    const icon = document.createElement("span");
    icon.className = "sob-like-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "\u2665";

    const label = document.createElement("span");
    label.className = "sob-like-label";
    label.textContent = "Like";

    button.append(icon, label);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const nextPressed = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(nextPressed));
      button.classList.toggle("is-active", nextPressed);
    });

    actionContainer.appendChild(button);
    actionGroup.appendChild(actionContainer);
  }

  private getStatusIdFromPath(pathname: string): string | null {
    const match = pathname.match(STATUS_PATH_PATTERN);
    return match?.[1] ?? null;
  }

  private ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .sob-like-action {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
      }

      .sob-like-button {
        border: 0;
        background: transparent;
        color: rgb(249, 24, 128);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: 999px;
        font: inherit;
        padding: 6px 10px;
        transition: background-color 120ms ease;
        line-height: 1;
      }

      .sob-like-button:hover {
        background: rgba(249, 24, 128, 0.15);
      }

      .sob-like-button.is-active {
        background: rgba(249, 24, 128, 0.2);
      }

      .sob-like-icon {
        font-size: 13px;
      }

      .sob-like-label {
        font-size: 12px;
        font-weight: 600;
      }
    `;

    document.head.appendChild(style);
  }
}