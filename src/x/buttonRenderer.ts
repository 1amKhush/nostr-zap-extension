const STYLE_ID = "sob-zap-style";
const BUTTON_SELECTOR = "[data-sob-zap-handle]";

export interface VerifiedIdentity {
  handle: string;
  npub: string;
}

export function ensureButtonStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .sob-zap-action {
      display: inline-flex;
      align-items: center;
      margin-left: 8px;
    }

    .sob-zap-button {
      border: 0;
      background: transparent;
      color: rgb(29, 155, 240);
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

    .sob-zap-button:hover {
      background: rgba(29, 155, 240, 0.15);
    }

    .sob-zap-icon {
      font-size: 14px;
      transform: translateY(-0.5px);
    }

    .sob-zap-label {
      font-size: 12px;
      font-weight: 600;
    }

    @media (max-width: 640px) {
      .sob-zap-label {
        display: none;
      }

      .sob-zap-button {
        padding: 6px;
      }
    }
  `;

  document.head.appendChild(style);
}

export function mountVerifiedButton(tweet: HTMLElement, identity: VerifiedIdentity): boolean {
  const actionGroup = tweet.querySelector<HTMLElement>('div[role="group"]');
  if (!actionGroup) {
    return false;
  }

  const existingButton = actionGroup.querySelector<HTMLElement>(BUTTON_SELECTOR);
  if (existingButton?.dataset.sobZapHandle === identity.handle) {
    return true;
  }

  if (existingButton) {
    existingButton.closest(".sob-zap-action")?.remove();
  }

  const container = document.createElement("div");
  container.className = "sob-zap-action";

  const button = document.createElement("button");
  button.className = "sob-zap-button";
  button.type = "button";
  button.dataset.sobZapHandle = identity.handle;
  button.setAttribute("aria-label", `Open verified Nostr profile for @${identity.handle}`);
  button.title = `@${identity.handle} verified on nostr.directory`;

  const icon = document.createElement("span");
  icon.className = "sob-zap-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⚡";

  const label = document.createElement("span");
  label.className = "sob-zap-label";
  label.textContent = "Zap";

  button.append(icon, label);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.open(`https://nostr.directory/p/${encodeURIComponent(identity.npub)}`, "_blank", "noopener,noreferrer");
  });

  container.appendChild(button);
  actionGroup.appendChild(container);

  return true;
}

export function removeInjectedButton(tweet: HTMLElement): void {
  tweet.querySelector(BUTTON_SELECTOR)?.closest(".sob-zap-action")?.remove();
}
