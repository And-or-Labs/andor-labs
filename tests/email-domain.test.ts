/**
 * Domain derivation is what buys the header its single field, so its edge cases
 * are product decisions rather than trivia. Getting a free-mail address wrong
 * means auditing gmail.com in front of a prospect.
 */
import { describe, expect, it } from "vitest";
import {
  deriveTarget,
  hostFromDomain,
  hostFromUserUrl,
  normalizeEmail,
} from "../functions/_lib/email-domain";

describe("normalising the address", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Scott@WeAreFilament.com ")).toBe("scott@wearefilament.com");
  });

  it("drops a trailing dot, which a fully-qualified domain may carry", () => {
    expect(normalizeEmail("vj@acme.com.")).toBe("vj@acme.com");
  });

  it("rejects what is obviously not an address", () => {
    for (const bad of ["", "vj", "vj@", "@acme.com", "vj acme.com", "vj@acme"]) {
      expect(normalizeEmail(bad), bad).toBeNull();
    }
  });

  it("rejects an address past the 254-char limit", () => {
    expect(normalizeEmail(`${"a".repeat(250)}@acme.com`)).toBeNull();
  });

  it("keeps plus-addressing, which is the address the person chose", () => {
    expect(normalizeEmail("vj+audit@acme.com")).toBe("vj+audit@acme.com");
  });
});

describe("reducing a mail domain to a site", () => {
  it("leaves a plain company domain alone", () => {
    expect(hostFromDomain("wearefilament.com")).toBe("wearefilament.com");
  });

  it("strips mail subdomains, which are never the marketing site", () => {
    expect(hostFromDomain("mail.acme.com")).toBe("acme.com");
    expect(hostFromDomain("email.acme.io")).toBe("acme.io");
    expect(hostFromDomain("smtp.acme.com")).toBe("acme.com");
  });

  it("does NOT blindly reduce to two labels — that breaks multi-part TLDs", () => {
    // The naive "last two labels" approach turns this into co.uk.
    expect(hostFromDomain("acme.co.uk")).toBe("acme.co.uk");
    expect(hostFromDomain("acme.com.au")).toBe("acme.com.au");
  });

  it("leaves a non-mail subdomain alone, since it is probably a real site", () => {
    expect(hostFromDomain("eng.acme.com")).toBe("eng.acme.com");
  });
});

describe("deriving the crawl target", () => {
  it("turns a work address into a host", () => {
    expect(deriveTarget("scott@wearefilament.com")).toEqual({
      email: "scott@wearefilament.com",
      host: "wearefilament.com",
      needsUrl: false,
    });
  });

  it("bounces free mail to the URL prompt instead of guessing", () => {
    for (const d of ["gmail.com", "outlook.com", "icloud.com", "proton.me", "hey.com"]) {
      const t = deriveTarget(`vj@${d}`)!;
      expect(t.host, d).toBeNull();
      expect(t.needsUrl, d).toBe(true);
      // The address is still captured — the lead is banked either way.
      expect(t.email, d).toBe(`vj@${d}`);
    }
  });

  it("bounces disposable addresses too", () => {
    expect(deriveTarget("x@mailinator.com")!.needsUrl).toBe(true);
  });

  it("is case-insensitive about free mail", () => {
    expect(deriveTarget("VJ@Gmail.COM")!.needsUrl).toBe(true);
  });

  it("keeps plus-addressing out of the domain logic", () => {
    const t = deriveTarget("vj+audit@acme.com")!;
    expect(t.email).toBe("vj+audit@acme.com");
    expect(t.host).toBe("acme.com");
  });

  it("returns null for an unusable address so the field can error inline", () => {
    expect(deriveTarget("not-an-email")).toBeNull();
  });
});

describe("the URL the visitor types after a free-mail bounce", () => {
  it("takes a bare domain", () => {
    expect(hostFromUserUrl("acme.com")).toBe("acme.com");
  });

  it("takes a full URL and throws away everything but the host", () => {
    expect(hostFromUserUrl("https://acme.com/pricing?utm=x#top")).toBe("acme.com");
  });

  it("strips www, which is not how anyone thinks of their site", () => {
    expect(hostFromUserUrl("https://www.acme.com/")).toBe("acme.com");
  });

  it("tolerates the mess people actually paste", () => {
    expect(hostFromUserUrl("  HTTP://Acme.com.  ")).toBe("acme.com");
  });

  it("rejects input with no host in it", () => {
    for (const bad of ["", "   ", "acme", "https://"]) {
      expect(hostFromUserUrl(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});
