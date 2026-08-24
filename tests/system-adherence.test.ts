/**
 * Three guards against hand-rolling, chosen from a sweep of everything this
 * branch introduced.
 *
 * The sweep found four violations. These three cover the ones that RECUR, are
 * INVISIBLE to the build, the typechecker and every other test, and can be
 * checked mechanically — no judgement, so no argument about whether a given
 * case counts.
 *
 * A fourth candidate was rejected on purpose: "every class defined in the
 * stylesheet is referenced somewhere in src/". It would have caught the five
 * dead `.aol-audit__url*` rules the sweep found, but 177 of the 384 classes are
 * variants (`aol-badge--blue`, `aol-btn--lg`) that components compose from
 * template strings and never spell out, so it would fire 177 false alarms. A
 * test nobody trusts gets deleted, and takes the real signal with it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssPath = new URL("../src/styles/components.css", import.meta.url);
const css = readFileSync(cssPath, "utf8");
/** Comments legitimately discuss all of this; only declarations are the rule. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

const sectionsDir = new URL("../src/components/sections/", import.meta.url);
const sections = readdirSync(sectionsDir)
  .filter((f) => f.endsWith(".astro"))
  .map((f) => ({ name: f, body: readFileSync(new URL(f, sectionsDir), "utf8") }));

describe("elevation stays in the system", () => {
  it("mixes no shadow by hand", () => {
    // The readme: elevation is a hard offset block shadow (--shadow-hard*), and
    // --shadow-soft is reserved for floating overlays. The hero's field row
    // carried three hand-mixed rgba glows — a third elevation language invented
    // for one element, and the kind of thing that looks deliberate enough that
    // nobody questions it later.
    const mixed = [...declarations.matchAll(/box-shadow\s*:[^;]*rgba\([^;]*/g)].map((m) => m[0].trim());
    expect(mixed, `hand-mixed shadow(s):\n${mixed.join("\n")}`).toEqual([]);
  });
});

describe("controls come from the system", () => {
  // The hamburger is a genuine non-DS control: a three-bar toggle with its own
  // animation, not a button in the system's sense. It is the ONLY exception,
  // and naming it here is cheaper than letting the rule go unenforced.
  const ALLOWED = new Set(["site-nav-toggle"]);

  it("uses <Button> rather than restating one", () => {
    // .aol-hero__auditgo restated font, tracking, uppercase, radius, fill,
    // hover and transitions — a complete second Button a few hundred lines from
    // the real one. It built, it typechecked, every test passed.
    const offenders: string[] = [];
    for (const { name, body } of sections) {
      const withoutComments = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      for (const m of withoutComments.matchAll(/<button\b[^>]*>/g)) {
        const cls = /class="([^"]*)"/.exec(m[0])?.[1] ?? "";
        if (![...ALLOWED].some((a) => cls.includes(a))) offenders.push(`${name}: ${m[0].slice(0, 70)}`);
      }
    }
    expect(offenders, `raw <button>:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("colour comes from tokens", () => {
  /**
   * Properties that actually paint a colour. `mask-image` is excluded on
   * purpose: a mask reads only the alpha channel, so the `#000` in a mask
   * gradient means "opaque" and is not a colour at all — flagging it would be
   * the false positive that gets this file deleted.
   */
  const PAINTS = ["color", "background", "background-color", "border-color", "fill", "stroke", "outline-color"];

  it("names no colour literally", () => {
    // --paper and --surface-card have both been re-pointed, and each time
    // anything holding the old value survived the change looking wrong. A
    // literal is a copy of a token that stops tracking it.
    const literals: string[] = [];
    for (const m of declarations.matchAll(/(^|[;{\s])([a-z-]+)\s*:\s*([^;{}]+)/g)) {
      const prop = m[2];
      const value = m[3].trim();
      if (!PAINTS.includes(prop)) continue;
      if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(value)) literals.push(`${prop}: ${value.slice(0, 60)}`);
    }
    expect(literals, `literal colour(s):\n${literals.join("\n")}`).toEqual([]);
  });
});
