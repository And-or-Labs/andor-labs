import { hasAnalyticsConsent } from "./consent";
import { BOOKING_URL } from "../data/site";

type BookingIntent = "fdm" | "mediacontext";
type SiteEvent = "booking_started" | "newsletter_subscribed";
type EventDetails = { intent?: BookingIntent; placement?: string };
type EventProperties = Record<string, string>;
type PostHogClient = {
  __loaded?: boolean;
  capture?: (event: string, properties: Record<string, unknown>, options?: {
    transport: "sendBeacon";
    send_instantly: true;
  }) => unknown;
  captureException?: (error: unknown, properties?: Record<string, unknown>) => unknown;
  set_config?: (config: Record<string, unknown>) => void;
  has_opted_out_capturing?: () => boolean;
};

declare global {
  interface Window {
    posthog?: PostHogClient | unknown[];
  }
}

const booking = new URL(BOOKING_URL);
const placements = new Set([
  "home-bar", "fdm-bar", "fdm-hero", "fdm-offer", "fdm-next",
  "mediacontext-bar", "mediacontext-hero", "mediacontext-next",
  "homepage", "blog-index", "blog-post", "record", "footer", "unknown",
]);
const pending = new Set<number>();

function clearPending() {
  pending.forEach(timer => window.clearTimeout(timer));
  pending.clear();
}

export function trackSiteEvent(event: "newsletter_subscribed", details?: { placement?: string }): void;
export function trackSiteEvent(event: "booking_started", details: { intent: BookingIntent; placement?: string }): void;
export function trackSiteEvent(event: SiteEvent, details: EventDetails = {}): void {
  if (!hasAnalyticsConsent()) return;
  if (event !== "booking_started" && event !== "newsletter_subscribed") return;
  if (event === "booking_started" && details.intent !== "fdm" && details.intent !== "mediacontext") return;

  const properties: EventProperties = {
    placement: details.placement && placements.has(details.placement) ? details.placement : "unknown",
    page_path: window.location.pathname,
    device_class: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop",
    // Query strings and fragments can contain visitor-supplied data.
    $current_url: `${window.location.origin}${window.location.pathname}`,
  };
  if (event === "booking_started" && details.intent) properties.intent = details.intent;

  const capture = (attempt: number) => {
    if (!hasAnalyticsConsent()) return;
    const client = window.posthog;
    // The tag manager's array stub would retain events until the SDK loads.
    if (client && !Array.isArray(client) && typeof client.capture === "function") {
      try {
        if (client.has_opted_out_capturing?.()) return;
        client.capture(event, properties, { transport: "sendBeacon", send_instantly: true });
      } catch {
        // Optional measurement must never interrupt the visitor's action.
      }
      return;
    }
    if (attempt >= 4) return;
    const timer = window.setTimeout(() => {
      pending.delete(timer);
      capture(attempt + 1);
    }, 250);
    pending.add(timer);
  };
  capture(0);
}

function trackBookingStart(event: MouseEvent) {
  if (event.defaultPrevented || (event.type === "click" ? event.button !== 0 : event.button !== 1)) return;
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link) return;
  let destination: URL;
  try { destination = new URL(link.href); } catch { return; }
  if (destination.origin !== booking.origin || destination.pathname.replace(/\/$/, "") !== booking.pathname) return;
  const intent = destination.searchParams.get("utm_campaign");
  if (intent !== "fdm" && intent !== "mediacontext") return;
  trackSiteEvent("booking_started", {
    intent,
    placement: destination.searchParams.get("utm_content") ?? undefined,
  });
}

document.addEventListener("click", trackBookingStart);
document.addEventListener("auxclick", trackBookingStart);
document.addEventListener("cookieyes_consent_update", () => {
  if (!hasAnalyticsConsent()) clearPending();
});
window.addEventListener("pagehide", clearPending);

/* ---------- PostHog (loaded by GTM) ----------
   GTM owns the SDK and its init. Once it is up we switch on the free
   features the project settings leave off: exception autocapture (Error
   Tracking) and dead-click capture. Replay, heatmaps and web vitals are
   already enabled server side. */
function ph(): PostHogClient | null {
  const c = window.posthog;
  return c && !Array.isArray(c) && c.__loaded ? c : null;
}

let extrasOn = false;
function enableExtras(tries = 0) {
  const c = ph();
  if (!c) {
    if (tries < 40) window.setTimeout(() => enableExtras(tries + 1), 500);
    return;
  }
  if (extrasOn) return;
  extrasOn = true;
  try { c.set_config?.({ capture_exceptions: true, capture_dead_clicks: true }); } catch { /* optional */ }
}
enableExtras();

/** Operational telemetry (no visitor data in the properties). Respects the
    SDK's own opt-out; waits up to ~10s for GTM to load PostHog. */
export function trackOps(event: string, props: Record<string, string | number | boolean | null>, attempt = 0): void {
  const c = ph();
  if (!c) {
    if (attempt < 20) window.setTimeout(() => trackOps(event, props, attempt + 1), 500);
    return;
  }
  try {
    if (c.has_opted_out_capturing?.()) return;
    c.capture?.(event, { ...props, $current_url: `${location.origin}${location.pathname}` });
  } catch { /* optional */ }
}

export function trackError(error: unknown, props: Record<string, string | number | boolean | null>): void {
  const c = ph();
  try {
    if (!c || c.has_opted_out_capturing?.()) return;
    c.captureException?.(error, props);
  } catch { /* optional */ }
}
