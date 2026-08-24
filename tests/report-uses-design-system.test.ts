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
    for (const c of ["Badge", "Button", "Card"]) {
      expect(report).toMatch(new RegExp(`import ${c} from "\\.\\./ds/${c}\\.astro"`));
    }
  });

  it("renders those components into the template the client clones", () => {
    // Astro only emits component markup where the component is USED. An import
    // with no call site would satisfy the test above and ship nothing.
    expect(report).toContain('<template id="tpl-audit-finding">');
    expect(report).toMatch(/<Card[^>]*class="aol-finding"/);
    // The observed panel is a SUNKEN Card, not a background drawn by hand.
    expect(report).toMatch(/<Card variant="sunken"[^>]*class="aol-finding__observed"/);
  });

  it("publishes no grade and no scorekeeping", () => {
    // A letter off a six-check wave is a fabricated metric on a page whose
    // premise is peer-reviewed method. The run count went too: "3 checks run ·
    // 1 failed" was scorekeeping about the tool, and it framed three fixes as a
    // mark against the reader.
    expect(report).not.toContain("aol-report__grade");
    expect(report).not.toContain("aol-report__count");
    const top = report.slice(report.indexOf('class="aol-report__top"'), report.indexOf("</header>"));
    expect(top).toContain("aol-report__host");
    expect(top).not.toContain("Badge");
  });

  it("clones the templates instead of constructing markup", () => {
    const render = hero.slice(hero.indexOf("const render ="), hero.indexOf("const handle ="));
    expect(render).toContain("#tpl-audit-finding");
    expect(render).toContain("cloneNode");
    // The tell of the old version: building the report out of new elements.
    expect(render).not.toContain("document.createElement");
  });

  it("gives a win card exactly what a win needs", () => {
    const tpl = report.slice(report.indexOf('<template id="tpl-audit-finding">'), report.lastIndexOf("</template>"));
    const slots = [...tpl.matchAll(/data-slot="([a-z]+)"/g)].map((m) => m[1]);
    // Which win, from where, the instruction, why it matters, what we saw here,
    // and the source. Nothing else.
    expect(slots.sort()).toEqual(["area", "cite", "found", "n", "title", "why"].sort());
    // NO VERDICT BADGE. Every card is a fix now, so a PASS/FAIL chip on it
    // would be telling the reader off for the thing they are being handed.
    expect(tpl).not.toContain("__verdict");
    // The headline statistic is still barred — it was the third object on a
    // card that had stopped reading as one thing.
    expect(tpl).not.toContain("__stat");
  });

  it("labels the why and the observation", () => {
    // Unlabelled, the two paragraphs read as one run of prose and a reader had
    // to work out which sentence was about the research and which was about
    // their own page.
    const tpl = report.slice(report.indexOf('<template id="tpl-audit-finding">'), report.lastIndexOf("</template>"));
    expect(tpl).toMatch(/aol-finding__lbl">Why</);
    expect(tpl).toMatch(/aol-finding__lbl">Observed</);
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
