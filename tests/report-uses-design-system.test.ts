/**
 * The report must be built from design-system COMPONENTS, not from classes
 * typed to resemble them.
 *
 * This exists because it drifted once and the drift was invisible to every
 * other check. The report is rendered on the client, so there is no server pass
 * in which to call <Card> per finding; the first version answered that by
 * writing markup in JS and inventing `.aol-tile`, `.aol-finding__stat` and a
 * bespoke masthead, then 285 lines of stylesheet to make them look deliberate.
 * It built, it typechecked, every test passed, and it looked nothing like the
 * rest of the site.
 *
 * The fix is <template>: Astro renders the real components into the templates,
 * the client clones them. These tests guard that arrangement — that the
 * components are imported and used, that the client clones rather than
 * constructs, and that a finding card carries exactly the four things it is
 * allowed to carry.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const report = readFileSync(new URL("../src/components/sections/AuditReport.astro", import.meta.url), "utf8");
const hero = readFileSync(new URL("../src/components/sections/Hero.astro", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");

describe("the report is assembled from design-system components", () => {
  it("imports the components rather than reimplementing them", () => {
    for (const c of ["Badge", "Button", "Card", "SpecGrid"]) {
      expect(report).toMatch(new RegExp(`import ${c} from "\\.\\./ds/${c}\\.astro"`));
    }
  });

  it("renders those components into templates the client can clone", () => {
    // Astro only emits component markup where the component is USED. An import
    // with no call site would satisfy the test above and ship nothing.
    expect(report).toContain('<template id="tpl-audit-checks">');
    expect(report).toContain('<template id="tpl-audit-finding">');
    expect(report).toMatch(/<SpecGrid[^>]*\/>/);
    expect(report).toMatch(/<Card[^>]*class="aol-finding"/);
  });

  it("publishes no grade", () => {
    // A letter off a three-check sample is a fabricated metric on a page whose
    // premise is peer-reviewed method. The header states what ran and what it
    // found; a Badge survives only as the per-finding verdict.
    expect(report).not.toContain("aol-report__grade");
    const top = report.slice(report.indexOf('class="aol-report__top"'), report.indexOf("</header>"));
    expect(top).toContain("aol-report__host");
    expect(top).toContain("aol-report__count");
    expect(top).not.toContain("Badge");
  });

  it("clones the templates instead of constructing markup", () => {
    const render = hero.slice(hero.indexOf("const render ="), hero.indexOf("const handle ="));
    expect(render).toContain("#tpl-audit-finding");
    expect(render).toContain("#tpl-audit-checks");
    expect(render).toContain("cloneNode");
    // The tell of the old version: building the report out of new elements.
    expect(render).not.toContain("document.createElement");
  });

  it("gives a finding card exactly four things", () => {
    const tpl = report.slice(report.indexOf('<template id="tpl-audit-finding">'), report.lastIndexOf("</template>"));
    const slots = [...tpl.matchAll(/data-slot="([a-z]+)"/g)].map((m) => m[1]);
    // title + verdict live on one row; then why, found, cite.
    expect(slots.sort()).toEqual(["cite", "found", "title", "verdict", "why"].sort());
    // Things the card is NOT allowed to carry again: the code, the subsection
    // label and the headline statistic. Three of those on a card is what stopped
    // it reading as a finding.
    expect(tpl).not.toContain("__stat");
    expect(tpl).not.toContain("__area");
    expect(tpl).not.toContain("__code");
  });
});

describe("the report's stylesheet stays out of the components' way", () => {
  it("has no trace of the invented chrome", () => {
    for (const dead of ["aol-tile", "aol-report__masthead", "aol-report__letter", "aol-report__redact"]) {
      expect(css).not.toContain(dead);
    }
  });

  it("draws no separator over a finding or the CTA", () => {
    // A Card already has an edge. The 2px rules stacked on top of it were the
    // single most-reported problem with the previous version.
    const block = css.slice(css.indexOf("/* ---- The audit report ----"));
    expect(block).not.toMatch(/\.aol-finding\{[^}]*border-top/);
    expect(block).not.toMatch(/\.aol-report__cta\{[^}]*border-top/);
  });

  it("never restates a border, radius or shadow a component owns", () => {
    const block = css.slice(css.indexOf("/* ---- The audit report ----"));
    // Comments legitimately discuss these words; declarations must not.
    const declarations = block.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).not.toMatch(/border-radius\s*:/);
    expect(declarations).not.toMatch(/box-shadow\s*:/);
  });
});
