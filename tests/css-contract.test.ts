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
