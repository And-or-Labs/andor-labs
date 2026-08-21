// Site-wide constants that are referenced from more than one component.
// Kept here so a change lands in one place — the booking URL in particular
// used to be copy-pasted across six files, two of which declared their own
// rival local constant for it. That is one missed grep away from a stale CTA.

/** Destination for every "Book a call" / "Let's talk" CTA on the site. */
export const BOOKING_URL = "https://cal.com/jatain/book";

/**
 * Who the site says it's for.
 *
 * This drifted into THREE live phrasings before it was centralised — "adtech",
 * then "AI, tech & media" in the hero, then "early-stage B2B" everywhere else —
 * because the same idea was retyped in nine files across two broadening passes.
 * The first screen ended up giving three different answers to "is this for me?".
 * Change it here; every surface follows.
 *
 * Narrowed to adtech on 2026-08-21, then widened the same day to early-stage
 * technology. The narrowing was sound while PROMISE named advertising
 * technology and nothing else; the widening is a positioning decision, not a
 * drift, and PROMISE moved with it in the same commit. The rule that matters is
 * unchanged: this constant and the promise say the same thing, always.
 */
export const ICP = "early-stage technology";

/** The ICP as a noun phrase, e.g. "We help {ICP_STARTUPS} lead their category". */
export const ICP_STARTUPS = `${ICP} startups`;

/**
 * The one-sentence promise — hero subhead AND meta description.
 *
 * These were two separately-typed sentences making two different claims, so the
 * search snippet promised something the page didn't. Same phrase, one source.
 *
 * This now DERIVES from ICP_STARTUPS, and that is the point. It previously
 * spelled its category out by hand, because "adtech" was house shorthand and too
 * terse for the first sentence a stranger reads — a defensible reason that came
 * with a standing hazard, documented right here as "the one surface that does not
 * derive from ICP, so the two must be moved together". They then failed to move
 * together twice. "early-stage technology" reads fine in prose, so the exception
 * is no longer needed and the hazard is retired with it: change ICP and this
 * sentence follows, like every other surface.
 */
export const PROMISE = `We're a boutique consultancy helping ${ICP_STARTUPS} find product-market fit, accelerate revenue growth, and win their category.`;
