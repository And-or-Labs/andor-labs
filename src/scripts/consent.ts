import type { TransitionBeforeSwapEvent } from "astro:transitions/client";

type CookieConsent = {
  categories?: Record<string, boolean>;
  isUserActionCompleted?: boolean;
};

declare global {
  interface Window {
    getCkyConsent?: () => CookieConsent;
    revisitCkyConsent?: () => void;
  }
}

const ROOTS = [
  [".cky-consent-container", "andor-cookie-banner"],
  [".cky-btn-revisit-wrapper", "andor-cookie-revisit"],
  [".cky-overlay", "andor-cookie-overlay"],
] as const;

let banner: HTMLElement | null = null;
let bannerObserver: MutationObserver | null = null;
let bannerSize: ResizeObserver | null = null;
let bodyObserver: MutationObserver | null = null;
let frame = 0;
let preferencesOpen = false;
let preferenceTrigger: HTMLElement | null = null;

/** A missing or unreadable consent decision never grants analytics consent. */
export function hasAnalyticsConsent(): boolean {
  try {
    return window.getCkyConsent?.().categories?.analytics === true;
  } catch {
    return false;
  }
}

function measureBanner() {
  frame = 0;
  const currentBanner = banner;
  const visible = currentBanner !== null && currentBanner.isConnected && getComputedStyle(currentBanner).display !== "none";
  const height = currentBanner && visible ? Math.ceil(currentBanner.getBoundingClientRect().height) : 0;
  document.documentElement.style.setProperty("--consent-height", `${height}px`);

  const expanded = !!visible && !!banner?.classList.contains("cky-consent-bar-expand");
  if (expanded && !preferencesOpen) {
    preferenceTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    banner?.querySelector<HTMLButtonElement>(".cky-btn-close")?.focus({ preventScroll: true });
  } else if (!expanded && preferencesOpen) {
    const target = preferenceTrigger?.checkVisibility()
      ? preferenceTrigger
      : document.querySelector<HTMLButtonElement>(".cky-btn-revisit");
    target?.focus({ preventScroll: true });
    preferenceTrigger = null;
  }
  preferencesOpen = expanded;
}

function scheduleMeasure() {
  if (!frame) frame = requestAnimationFrame(measureBanner);
}

function observeBanner() {
  const next = document.querySelector<HTMLElement>(".cky-consent-container");
  if (next !== banner) {
    bannerObserver?.disconnect();
    bannerSize?.disconnect();
    banner = next;
    if (banner) {
      bannerObserver = new MutationObserver(scheduleMeasure);
      bannerObserver.observe(banner, { attributes: true, childList: true, subtree: true });
      bannerSize = new ResizeObserver(scheduleMeasure);
      bannerSize.observe(banner);
    }
  }
  scheduleMeasure();
}

function observeBody() {
  bodyObserver?.disconnect();
  bodyObserver = new MutationObserver(observeBanner);
  // CookieYes arrives asynchronously through the existing tag manager.
  bodyObserver.observe(document.body, { childList: true });
  observeBanner();
}

document.addEventListener("astro:before-swap", event => {
  const { newDocument } = event as TransitionBeforeSwapEvent;
  for (const [selector, name] of ROOTS) {
    const root = document.querySelector<HTMLElement>(`body > ${selector}`);
    if (!root) continue;
    root.dataset.astroTransitionPersist = name;
    newDocument.querySelectorAll(`body > ${selector}`).forEach(node => node.remove());
    newDocument.body.append(root.cloneNode(false));
  }

  // The vendor inserts its stylesheet at runtime, outside Astro's source tree.
  const style = document.getElementById("cky-style");
  if (style) {
    style.dataset.astroTransitionPersist = "andor-cookie-style";
    newDocument.getElementById("cky-style")?.remove();
    newDocument.head.append(style.cloneNode(false));
  }
  newDocument.documentElement.style.setProperty(
    "--consent-height",
    document.documentElement.style.getPropertyValue("--consent-height") || "0px",
  );
});

document.addEventListener("astro:after-swap", observeBody);
document.addEventListener("cookieyes_banner_load", observeBanner);
document.addEventListener("cookieyes_banner_loaded", observeBanner);
document.addEventListener("cookieyes_consent_update", scheduleMeasure);
window.addEventListener("resize", scheduleMeasure, { passive: true });

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && preferencesOpen) {
    banner?.querySelector<HTMLButtonElement>(".cky-btn-close")?.click();
    event.preventDefault();
    event.stopImmediatePropagation();
  } else if (/^[1-9]$/.test(event.key)
    && (event.target as Element).closest?.(".cky-consent-container, .cky-btn-revisit-wrapper")) {
    event.stopPropagation();
  }
}, true);

if (document.body) observeBody();
else document.addEventListener("DOMContentLoaded", observeBody, { once: true });
