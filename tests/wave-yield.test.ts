/**
 * A check that the model DECLINED and a call that FAILED are different events.
 *
 * Both used to be the same one. The group scorers threw when a response scored
 * nothing, which was right when a call carried a whole subsection — six rules
 * and zero scores is a model that ignored the task. The wave changed the shape
 * and the check did not follow: every call now carries ONE rule, so the two
 * things the prompt explicitly asks for — "if the pages do not show you enough,
 * OMIT it", and a note whose quote is really on the page — each produced an
 * empty result, which was raised as an exception, rejected out of
 * Promise.allSettled, and dropped on the floor beside a genuine outage.
 *
 * Measured across seven live runs afterwards: 0 failed calls, and 1–3 declines
 * per wave. Every one of those had been indistinguishable from a provider
 * error, and the report simply said it had checked fewer things.
 */
import { describe, expect, it } from "vitest";
import { requireScores } from "../functions/_lib/audit-score";

describe("what counts as an answer", () => {
  it("accepts a response that scored nothing", () => {
    // THE WHOLE POINT. The model read the page, could not judge the one rule it
    // was given, and said so — which is the behaviour the prompt asks for.
    expect(requireScores('{"scores":[]}')).toEqual({ scores: [] });
  });

  it("accepts a normal answer", () => {
    expect(requireScores('{"scores":[{"id":"a","verdict":"pass","note":"x"}]}')).toEqual({
      scores: [{ id: "a", verdict: "pass", note: "x" }],
    });
  });

  it("rejects a body that is not JSON at all", () => {
    // A transport or model failure, and now the only thing a rejection means —
    // which is what makes counting rejections worth doing.
    expect(() => requireScores("I'm sorry, I can't help with that.")).toThrow();
  });

  it("rejects JSON with no scores array", () => {
    expect(() => requireScores('{"summary":"looks fine"}')).toThrow();
    expect(() => requireScores('{"scores":"none"}')).toThrow();
  });
});
