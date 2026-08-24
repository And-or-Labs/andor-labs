/**
 * A free-mail address must be able to finish the audit.
 *
 * The endpoint answers a personal address with `need-url` and the question
 * "what's the site you'd like audited?". For weeks nothing asked it: the
 * handler printed the question into the status line and stopped, under a field
 * that only accepts an email and beside a progress bar frozen at one cell.
 * Everyone on gmail hit a wall that asked them something they had no way to
 * answer, and it was invisible — the endpoint had taken a `url` alongside the
 * email since the first commit, so nothing errored anywhere.
 *
 * The comment in email-domain.ts still says those addresses "fall through to a
 * URL prompt in the modal". The modal has been gone for weeks. That sentence is
 * why this file exists: the contract survived the UI that honoured it.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hero = readFileSync(new URL("../src/components/sections/Hero.astro", import.meta.url), "utf8");
const api = readFileSync(new URL("../functions/api/audit.ts", import.meta.url), "utf8");

describe("the free-mail prompt", () => {
  it("asks for the site rather than stopping", () => {
    // `stop(msg.message)` is the bug, exactly.
    expect(hero).toMatch(/need-url"\)\s*\{\s*askForSite\(msg\.message\)/);
  });

  it("sends the answer back as `url`, which is what the endpoint reads", () => {
    expect(hero).toContain("{ email, url: site }");
    expect(api).toMatch(/payload\.url === "string"/);
  });

  it("keeps the address that asked, so the lead banks against a person", () => {
    // The site is not the visitor. bankLead() takes the email either way, and
    // sending the domain as the address would file the lead under nobody.
    expect(hero).toMatch(/pending = auditInput\.value\.trim\(\)/);
    expect(hero).toMatch(/run\(pending \?\? typed/);
  });
});

describe("what the report claims it read", () => {
  it("only names the pricing page when the crawl found one", () => {
    // "We read your homepage and pricing page" is a fabrication on every site
    // without one — on a page whose entire claim is that its findings are
    // checkable against the site, that is the one sentence it cannot afford.
    expect(api).toContain("pricing: ctx.hasPricing");
    expect(hero).toMatch(/d\.pricing \? "your homepage and pricing page" : "your homepage"/);
  });
});
