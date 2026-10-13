/**
 * Jev question set for the visitor briefing: one judgement over the
 * factsheet metrics. Pure data; safe in Workers, the browser and Node.
 */
import { choice, noul, type Question } from "@typesafe-ai/sdk";

export function questionsFor(name: string): { q: Record<string, Question> } {
  const q: Record<string, Question> = {
    is_network_operator: noul(`Using only the state, is "${name}" primarily an internet service provider, telecom carrier or hosting network rather than an ordinary employer? Do not assume.`),
    verdict: choice(`Based only on the metrics in the state, which read best fits "${name}" right now? Do not assume facts that are not in the state, and do not make things up.`, {
      growing_into_it: "Headcount and web traffic are both rising.",
      runway_soundtrack: "A long time since the last funding round, with headcount flat or falling.",
      leaky_funnel: "Web traffic is falling noticeably while headcount holds steady or grows.",
      outgrown_story: "An established product whose growth has stalled, with traffic and headcount roughly flat.",
      tool_hoarder: "An unusually large software stack for the size of the team.",
      quietly_profitable: "Meaningful revenue with little or no outside funding.",
      big_and_steady: "A large organization, thousands of staff, with stable metrics.",
      too_early: "Too little data in the state to judge.",
    }),
  };
  return { q };
}
