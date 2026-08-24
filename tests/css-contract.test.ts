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
const site = readFileSync(new URL("../src/styles/site.css", import.meta.url), "utf8");

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

  it("keeps the ground under the copy on a phone, not parked below it", () => {
    // TWO RULES, ONE COMPOSITION, and it has been wrong in both directions.
    //
    // Without a band the last line of copy sat at 7-8% up the mask ramp, where
    // the picture is near solid — the assurance ticks are --ink-500 at 11px and
    // measured 1.3:1 against the hillside. The first fix reserved the picture's
    // WHOLE height below the content, which made them legible by moving the
    // picture out from under them entirely: it began 32px BELOW the last line
    // at every mobile width, zero overlap, and read as a photograph parked
    // under the hero rather than the ground the hero stands on.
    //
    // So the band must exist AND be smaller than the picture. 22vh puts the
    // last line at 29% — desktop's own position — leaving 60-100px of picture
    // above it. Measured behind the ticks afterwards: 3.8:1 at 390px and 4.0:1
    // at 768, against desktop's 3.65:1.
    expect(site).toMatch(/padding-bottom:\s*clamp\(110px,\s*22vh,\s*190px\)/);
    expect(site).not.toMatch(/padding-bottom:\s*calc\(64vw/);

    // The picture's own top fade is longer on a phone, because the source runs
    // dark-pale-dark: night sky, cloud bank, black hillside. Desktop only ever
    // puts copy over the pale middle third; a phone crops to a third of the
    // width and brings the dark SKY up to where the field is.
    expect(css).toMatch(/@media \(max-width:900px\)\{[\s\S]{0,120}#000 55%/);

    // And a third rule, for the width where the ticks wrap onto two lines. The
    // band is sized so the LAST LINE lands about 29% up the ramp; below 380px
    // there is a second line 26px further down, and at 320 it sat 80px into the
    // picture, on the black hillside, at 1.1:1 with 99.9% of its background
    // under 3:1 — invisible, and shipped.
    //
    // It survived two rounds of checking because the union box of the two rows
    // averages to a comfortable 4.8:1, and because at 320 the second row starts
    // below the fold, so an unscrolled screenshot samples the page background
    // rather than the picture. Measure PER ROW, SCROLLED.
    //
    // 340 and not 380: 360 and 375 measured clean without it, and applying it
    // there pushed the first row out of the picture entirely.
    expect(site).toMatch(/@media \(max-width: 340px\)[\s\S]{0,160}clamp\(110px, 22vh, 190px\) \+ 34px/);
  });

  it("never crops on a wide screen, and caps the crop on a narrow one", () => {
    // Two separate bugs, one rule.
    //
    // `height:auto` is what keeps the picture at its true proportions: `cover`
    // alone filled the box by height and showed 65% of a 3:1 source in a 1440
    // hero — the scene zoomed and the composition lost. That shipped once.
    //
    // The min-height is what gives the picture its share of the ground on a
    // phone, where `height:auto` alone left it at 19% of the container against
    // 67% on desktop. It crops to do that, and the CAP HAS TO LIVE INSIDE THE
    // min(): CSS resolves min-height last, so a separate max-height is simply
    // ignored — written that way it zoomed 2.87x at 320px and cut the figure
    // out of the frame. 64vw is 1.9x on a 2.975:1 source, which is exactly
    // where the visible window still reaches the figure at 0.80.
    expect(css).toMatch(/\.aol-horizon img\{[^}]*height:auto/);
    expect(css).toMatch(/\.aol-horizon img\{[^}]*min-height:\s*min\(55%,\s*64vw\)/);
    expect(css).not.toMatch(/\.aol-horizon img\{[^}]*max-height/);
  });
});

describe("the report", () => {
  it("gives a win card the same width whatever the win count", () => {
    // The wave returns one, two or three wins, and one and two are the common
    // answers on real sites. Under `auto-fit` the empty tracks collapse and the
    // survivors take the whole container: the same card measured 371px with
    // three wins, 566px with two and 1152px with one — a different component
    // depending on how well the visitor's site scored.
    const rule = /\.aol-report__findings\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).not.toContain("auto-fit");
    expect(rule).not.toContain("auto-fill");
    expect(rule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("wraps every string it did not write", () => {
    // These overflow WITHOUT widening their own box, so nothing measures as too
    // wide and the page just gains a horizontal scrollbar. A 160-character host
    // took the document to 1826px at every viewport while .aol-report__top went
    // on reporting a width of 342.
    // Every rule in the file that sets it — there is more than one, and the
    // report's is whichever one claims the findings.
    const blocks = [...css.matchAll(/([^{}]*)\{\s*overflow-wrap:anywhere;?\s*\}/g)].map((m) => m[1]);
    const rule = blocks.find((b) => b.includes(".aol-finding__found")) ?? "";
    for (const cls of [
      ".aol-finding__found",   // the page's own words
      ".aol-finding__why",
      ".aol-finding__title",
      ".aol-finding__cite",
      ".aol-report__host",     // whatever the visitor typed
      ".aol-report__cap",
      ".aol-report__passing",
      ".aol-report__ctatitle", // subsection names out of the rule table
    ]) {
      expect(rule, `${cls} renders text from outside this repo and must wrap`).toContain(cls);
    }
  });

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
