/**
 * Turning a work email into the site to audit.
 *
 * The whole one-field header rests on this: scott@wearefilament.com means we
 * already know what to crawl, and asking for the URL as well would double the
 * friction on the highest-traffic surface of the site for information we can
 * usually infer.
 *
 * Usually. Free-mail addresses carry no company, and guessing is worse than
 * asking — auditing gmail.com because somebody signed up from a personal
 * address is a comic failure in front of a prospect. Those get a `need-url`
 * answer instead, and the hero's ONE FIELD becomes the second question rather
 * than a second field appearing beside it (see askForSite in Hero.astro).
 *
 * This used to say "a URL prompt in the modal". The modal was removed weeks
 * before the prompt was built, and for that whole time the sentence was the
 * only thing claiming anybody asked the question — nothing did, and every
 * visitor on a gmail address hit a wall.
 */

/**
 * Deliberately permissive, and copied in spirit from functions/api/subscribe.ts
 * for the same reason given there: strict RFC 5322 matching rejects addresses
 * that genuinely deliver, and the only thing that proves an address is real is
 * mail arriving at it. This catches typos and bots.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Consumer mail, plus the disposable services that show up on any public form.
 *
 * Not exhaustive and never will be — the list exists to catch the common cases
 * so the modal can ask a sensible question, not to be a spam filter. An unknown
 * free-mail provider falls through to being treated as a company domain, which
 * fails visibly (a crawl of a mail host returns nothing useful) rather than
 * silently.
 */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tuta.io",
  "zoho.com", "gmx.com", "gmx.de", "mail.com", "yandex.com", "yandex.ru",
  "fastmail.com", "hey.com", "duck.com", "qq.com", "163.com", "126.com",
  // Disposable
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "yopmail.com",
  "temp-mail.org", "throwaway.email", "sharklasers.com", "trashmail.com",
]);

export interface DerivedTarget {
  /** Normalised address, safe to send to Loops. */
  email: string;
  /** Host to crawl, or null when the address cannot name a company. */
  host: string | null;
  /** True when we bounced off a free-mail provider and must ask for the URL. */
  needsUrl: boolean;
}

/** Lowercase, trim, and strip a trailing dot from the domain. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/**
 * Reduce a mail domain to the site most likely to be the company's front door.
 *
 * Mail subdomains are common and almost never the marketing site:
 * `mail.acme.com`, `smtp.acme.com`, `email.acme.io`. Strip those specifically
 * rather than blindly reducing to the last two labels, which would turn
 * `acme.co.uk` into `co.uk` and `team.acme.github.io` into `github.io`.
 *
 * Anything not on the strip list is left alone. A genuine `eng.acme.com`
 * address is more likely to be a real site than a mistake, and crawling the
 * wrong subdomain is recoverable — the modal shows what it read and lets the
 * visitor correct it.
 */
const MAIL_SUBDOMAINS = new Set(["mail", "email", "smtp", "mx", "mailer", "e", "m"]);

export function hostFromDomain(domain: string): string {
  const labels = domain.split(".").filter(Boolean);
  if (labels.length > 2 && MAIL_SUBDOMAINS.has(labels[0])) return labels.slice(1).join(".");
  return labels.join(".");
}

/**
 * The one call the endpoint makes.
 *
 * Plus-addressing (`vj+audit@acme.com`) is preserved in `email` because it is
 * part of the address the person chose and Loops should store it as given; it
 * has no bearing on the domain either way.
 */
export function deriveTarget(raw: string): DerivedTarget | null {
  const email = normalizeEmail(raw);
  if (!email) return null;

  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (FREE_MAIL.has(domain)) return { email, host: null, needsUrl: true };

  const host = hostFromDomain(domain);
  // A bare TLD or something that lost all its labels is not crawlable.
  if (!host.includes(".")) return { email, host: null, needsUrl: true };

  return { email, host, needsUrl: false };
}

/**
 * Clean a URL the visitor typed into the modal after a free-mail bounce.
 *
 * They will paste anything: a bare domain, a full URL with a path, something
 * with a trailing slash, something with www. Take the host and nothing else.
 */
export function hostFromUserUrl(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let host: string;
  try {
    host = new URL(s.includes("://") ? s : `https://${s}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!host.includes(".") || host.length > 253) return null;
  return host;
}
