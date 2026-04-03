import { log } from "../lib/log";
import { extractTweetKey } from "../x/handleExtractor";

const STYLE_ID = "sob-competency-like-style";
const INJECTED_SELECTOR = "[data-sob-static-like='1']";
const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const STATUS_PATH_PATTERN = /^\/[a-z0-9_]{1,15}\/status\/(\d+)/i;

export class XSingleTweetLikeInjector {
  private observer: MutationObserver | null = null;
  private scheduledFrame: number | null = null;
  private lastPathname: string | null = null;
  private cachedStatusId: string | null = null;

  start(): void {
    this.ensureStyles();
    this.scheduleScan();

    this.observer = new MutationObserver(() => {
      this.scheduleScan();
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

    if (this.scheduledFrame !== null) {
      window.cancelAnimationFrame(this.scheduledFrame);
      this.scheduledFrame = null;
    }
  }

  private scheduleScan(): void {
    if (this.scheduledFrame !== null) {
      return;
    }

    this.scheduledFrame = window.requestAnimationFrame(() => {
      this.scheduledFrame = null;
      this.scan();
    });
  }

  private scan(): void {
    const targetStatusId = this.getActiveStatusId();
    if (!targetStatusId) {
      return;
    }

    const statusAnchors = document.querySelectorAll<HTMLAnchorElement>(`a[href*="/status/${targetStatusId}"]`);
    for (const anchor of Array.from(statusAnchors)) {
      const tweet = anchor.closest<HTMLElement>(TWEET_SELECTOR);
      if (!tweet || extractTweetKey(tweet) !== targetStatusId) {
        continue;
      }

      if (this.injectStaticLikeButton(tweet)) {
        return;
      }
    }
  }

  private getActiveStatusId(): string | null {
    const pathname = window.location.pathname;
    if (pathname !== this.lastPathname) {
      this.lastPathname = pathname;
      this.cachedStatusId = this.getStatusIdFromPath(pathname);
    }

    return this.cachedStatusId;
  }

  private injectStaticLikeButton(tweet: HTMLElement): boolean {
    const actionGroup = tweet.querySelector<HTMLElement>('div[role="group"]');
    if (!actionGroup) {
      return false;
    }

    if (actionGroup.querySelector(INJECTED_SELECTOR)) {
      return true;
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
    return true;
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