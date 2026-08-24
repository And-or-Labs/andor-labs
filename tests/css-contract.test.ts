/**
 * Rules whose ABSENCE is invisible to the type checker, the build and every
 * other test — but obvious on the page.
 *
 * This file exists because the horizon band's CSS was deleted by accident and
 * nothing caught it. Removing dead receipt styles meant slicing components.css
 * between two comment anchors, and the horizon block sat inside that range. The
 * markup kept rendering, the build stayed green, 237 tests stayed green, and
 * the hero shipped a raw 1088x272 image with no height cap, no crop and no
 * pixelation. A structural edit to a stylesheet has no compiler.
 *
 * The horizon band it was written for was removed on 2026-08-22 — the imagery
 * was a step too far from the design system — so its four assertions are gone
 * with it. The file stays, and so does this note: the failure it records was
 * never about that one block, it was about structural edits to a stylesheet
 * having no compiler.
 *
 * Only rules that are LOAD-BEARING belong here — ones where losing the
 * declaration changes what the page does rather than how it is decorated.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");
const hero = readFileSync(new URL("../src/components/sections/Hero.astro", import.meta.url), "utf8");

describe("the hero form always submits", () => {
  it("guards on the form and input ONLY", () => {
    // This guard once also required the progress bar, its fill, its status line
    // and the report section. When the progress markup was deleted by accident
    // the listener never attached, the browser did a native GET submit, and the
    // page silently RELOADED on every attempt — a cosmetic dependency had been
    // made a functional one.
    expect(hero).toContain("if (auditForm && auditInput) {");
    expect(hero).not.toMatch(/if \(auditForm && auditInput && [a-z]/);
  });

  it("still ships the progress markup it stopped depending on", () => {
    // The bar is the shared .aol-meter now, not a hero-local one.
    for (const c of ["aol-hero__progress", "aol-meter", "aol-meter__fill", "aol-hero__status"]) {
      expect(hero, `${c} missing from the hero`).toContain(c);
    }
  });

  it("uses the system's segmented meter, not a progress pill", () => {
    // The meter's own comment calls a smooth rounded fill "a SaaS progress
    // pill" and exists to rule it out — and the system allows pills on buttons
    // and the switch track only. The hero grew one anyway, a few hundred lines
    // from the component that says not to.
    expect(hero).not.toContain("aol-hero__bar");
    expect(hero).not.toContain("aol-hero__fill");
    expect(css).toMatch(/\.aol-meter,[\s\S]{0,40}\.aol-rmc__meter\{/);
    // Ten cells, drawn as ticks rather than a plain track.
    expect(css).toMatch(/\.aol-meter,[\s\S]{0,400}repeating-linear-gradient/);
    const block = css.slice(css.indexOf(".aol-meter,"), css.indexOf(".aol-meter,") + 900);
    expect(block).not.toMatch(/border-radius/);
  });

  it("centres the field on the same axis as the headline", () => {
    // The block was 31rem holding a 26rem form aligned left, which put the
    // field five rem off the centre line the headline sits on.
    expect(css).toMatch(/\.aol-hero__auditform\{[^}]*margin:0 auto/);
  });
});

describe("the audit field", () => {
  it("never restates a font-size on the input", () => {
    // It inherits 16px from .aol-control, and that is load-bearing: iOS zooms
    // the viewport when a focused input is under 16px. A local font-size here
    // is how that regression would arrive.
    const rule = /\.aol-hero__auditinput\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).not.toMatch(/font-size/);
  });

  it("puts the focus ring on the wrapper, since that is what reads as the control", () => {
    expect(css).toMatch(/\.aol-hero__auditrow:focus-within\{[^}]*--focus-ring/);
  });
});

describe("screen-reader-only", () => {
  it("still exists, because a missing rule here PAINTS a label", () => {
    // The audit field's label is deliberately unpainted. When this class goes
    // missing the label does not disappear — it renders as visible serif text
    // in the middle of the hero, which is the opposite of the intent. Lost
    // twice already to comment-anchored slice edits of components.css.
    expect(css).toContain(".aol-visually-hidden{");
    expect(css).toMatch(/\.aol-visually-hidden\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.aol-visually-hidden\{[^}]*clip:\s*rect\(0 0 0 0\)/);
  });
});

describe("the hero horizon", () => {
  /**
   * These assertions have now been deleted and restored twice, and the second
   * time nobody noticed for six commits — the picture shipped to production as
   * a plain inline image with no fade at all, because the markup still emitted
   * the classes and no rule matched them.
   *
   * Both times the cause was identical: a comment-anchored slice of
   * components.css that swallowed an unrelated block sitting between the two
   * anchors. This whole FILE exists because of that failure mode. Do not remove
   * these again — if the horizon is genuinely retired, delete the component and
   * the markup in the same commit and these will fail loudly, which is the
   * point.
   */
  it("still has its rules at all", () => {
    expect(css).toContain(".aol-horizon{");
    expect(css).toContain(".aol-has-horizon{");
    expect(css).toContain(".aol-horizon img{");
  });

  it("keeps the container mask, which is what makes the fade span the screen", () => {
    // The dissolve is measured against the SECTION, not the picture. Losing
    // this leaves a hard-edged band instead of a horizon.
    expect(css).toMatch(/\.aol-horizon\{[^}]*mask-image:\s*linear-gradient/);
  });

  it("keeps the picture's own top fade", () => {
    // How far the container ramp has run by the picture's top edge depends on
    // viewport height; without this a hairline draws across the page.
    expect(css).toMatch(/\.aol-horizon img\{[^}]*mask-image:\s*linear-gradient/);
  });

  it("clips on the section, not on the capped inner", () => {
    // .aol-hero-inner is 1200px wide. overflow:hidden there clips the 100vw
    // picture back to the container and the hero loses its bleed — which
    // shipped once already.
    expect(css).toMatch(/\.aol-hero\{\s*overflow:hidden/);
    expect(css).toMatch(/\.aol-has-horizon\{\s*position:relative;\s*\}/);
  });

  it("never crops the picture", () => {
    // `cover` fills by height and showed 65% of a 3:1 source in a 1440 hero.
    expect(css).toMatch(/\.aol-horizon img\{[^}]*height:auto/);
    expect(css).not.toMatch(/\.aol-horizon img\{[^}]*object-fit:\s*cover/);
  });
});

describe("the report", () => {
  it("has real vertical padding", () => {
    // It had almost none, and a result somebody waited thirty seconds for
    // should not arrive crammed against the thing above it.
    expect(css).toMatch(/\.aol-report\{[^}]*padding:\s*var\(--space-16\)/);
  });

  it("gives the observation its own ground inside the card", () => {
    // The card was a flat pink field carrying four paragraphs with nothing to
    // tell a reader which sentence was about the research and which was about
    // their own site. The one sentence that IS about their site now sits on a
    // sunken Card — a component surface, not a background drawn here.
    const block = css.slice(css.indexOf("/* ---- The audit report ----"));
    expect(block).toMatch(/\.aol-finding__observed\{[^}]*margin-top/);
    expect(block).not.toMatch(/\.aol-finding__observed\{[^}]*background/);
  });
});
