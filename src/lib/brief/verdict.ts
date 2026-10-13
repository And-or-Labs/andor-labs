/**
 * Jev's one-line read on the company, as printed copy. Pure: takes the
 * verdict key and the Facts, fills the template when its numbers exist and
 * falls back to the plain line when they do not (or when the numbers would
 * contradict the wording).
 */
import type { Facts } from "./facts.ts";

export type VerdictKey =
  | "growing_into_it"
  | "runway_soundtrack"
  | "leaky_funnel"
  | "outgrown_story"
  | "tool_hoarder"
  | "quietly_profitable"
  | "big_and_steady"
  | "too_early";

export const VERDICTS: VerdictKey[] = [
  "growing_into_it",
  "runway_soundtrack",
  "leaky_funnel",
  "outgrown_story",
  "tool_hoarder",
  "quietly_profitable",
  "big_and_steady",
  "too_early",
];

const pct = (n: number) => Math.round(Math.abs(n));

export function verdictLine(key: string, f: Facts): string {
  switch (key) {
    case "growing_into_it":
      if (f.hcYoY != null && f.traffic6mo != null && f.hcYoY > 0 && f.traffic6mo > 0)
        return `Headcount up ${pct(f.hcYoY)}% and traffic up ${pct(f.traffic6mo)}%. Growing into it.`;
      return "Growing into it.";
    case "runway_soundtrack":
      if (f.monthsSinceRaise != null) {
        const hc =
          f.hcYoY == null ? null : Math.abs(f.hcYoY) < 2 ? "headcount flat" : f.hcYoY < 0 ? `headcount down ${pct(f.hcYoY)}%` : null;
        if (hc) return `${f.monthsSinceRaise} months since the last raise and ${hc}. The runway has developed a soundtrack.`;
      }
      return "A long while since the last raise. The runway has developed a soundtrack.";
    case "leaky_funnel":
      if (f.traffic6mo != null && f.traffic6mo < 0)
        return `Traffic down ${pct(f.traffic6mo)}% in six months while the team holds. Something upstream is leaking.`;
      return "Traffic is sliding while the team holds. Something upstream is leaking.";
    case "outgrown_story":
      return "The product outgrew its positioning. Common, fixable, billable.";
    case "tool_hoarder":
      if (f.stackCount != null && f.staff != null)
        return `${f.stackCount} tools in the stack for ${f.staff.toLocaleString("en-US")} people. Someone is paying for all of them.`;
      return "A very large stack for the team size. Someone is paying for all of them.";
    case "quietly_profitable":
      return "Revenue without much funding. Boring in the best way.";
    case "big_and_steady":
      return "Large, steady, unbothered. This sheet will not change their week.";
    case "too_early":
    default:
      return "Not enough on the record yet. Check back after the next round.";
  }
}

/** Jev's network guard (is_network_operator >= 0.5) replaces the verdict. */
export const NETWORK_LINE =
  "This is a network, not a company. Nobody wants a factsheet on their router.";
