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
 * Only rules that are LOAD-BEARING belong here — ones where losing the
 * declaration changes what the page does rather than how it is decorated.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");

describe("the horizon band", () => {
  it("still has its rules at all", () => {
    expect(css).toContain(".aol-horizon{");
    expect(css).toContain(".aol-horizon img{");
  });

  it("keeps an EXPLICIT height, which is what makes object-fit crop", () => {
    // With height:auto the image ignores object-fit entirely and renders at its
    // full 272px natural height. This is the single declaration whose loss most
    // changes the hero.
    expect(css).toMatch(/\.aol-horizon img\{[^}]*height:\s*clamp\(/);
  });

  it("keeps image-rendering:pixelated", () => {
    // The source was quantised onto a real pixel grid specifically so this
    // would work. Smoothing on the way back up undoes all of it and leaves a
    // soft, slightly wrong photograph.
    expect(css).toMatch(/\.aol-horizon img\{[^}]*image-rendering:\s*pixelated/);
  });

  it("keeps the fade that stops it reading as a pasted rectangle", () => {
    expect(css).toMatch(/\.aol-horizon::after\{[^}]*linear-gradient/);
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

  it("keeps the board on an auto-filling grid", () => {
    // The board is the scannable layer and has to use the full width at any
    // size; a fixed column count wastes it on a wide screen.
    expect(css).toMatch(/\.aol-report__board\{[^}]*repeat\(auto-fill/);
  });

  it("colours failures differently from passes", () => {
    // The whole point of the board is that failures are pre-attentive. If these
    // collapse to one colour it becomes a list again.
    expect(css).toMatch(/\.aol-tile--fail\{[^}]*copper/);
    expect(css).toMatch(/\.aol-tile--pass \.aol-tile__verdict\{[^}]*blue/);
  });
});
