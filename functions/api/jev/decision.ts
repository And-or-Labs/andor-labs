/**
 * POST /api/jev/decision: the live "Call Jev" button in Megafly (/megafly/).
 *
 * Port of megafly/scripts/jev-service.ts for Cloudflare Pages Functions. It recomputes the
 * neural replay from the same public circuit file the browser uses, asks Jev (TypeSafe
 * system-one) the typed questions, and returns the verified response. Nothing is invented:
 * a missing key or an API error returns an error, and the page shows no decision.
 *
 * Secret: TYPESAFE_API_KEY (Pages → andorlabs → Settings → Variables and Secrets).
 */
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { decisionState, simulateCircuit, type Circuit } from "../../../megafly/src/neural";
import { allocation, questions } from "../../../megafly/src/jev";
import { fallbackTrace } from "../../../megafly/src/trace";

interface Env { TYPESAFE_API_KEY?: string; }

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (!env.TYPESAFE_API_KEY) return json({ error: "Jev is not connected on this server. No request was sent." }, 503);

  const circuitRes = await fetch(new URL("/megafly/data/locomotor-circuit.json", request.url));
  if (!circuitRes.ok) return json({ error: "Circuit data unavailable. No request was sent." }, 503);
  const circuit = (await circuitRes.json()) as Circuit;
  const frames = simulateCircuit(circuit);
  const body = { model: "jev-latest", state: decisionState(circuit, frames[250]), questions: questions() };

  try {
    const started = Date.now();
    const result = await new TypeSafeClient({ apiKey: env.TYPESAFE_API_KEY }).systemOne(body).withResponse();
    const response = result.data;
    const action = response.answers.action, destination = response.answers.destination;
    if (!Number.isFinite(action.confidence)) return json({ error: "Jev returned an invalid confidence. No decision was applied." }, 502);
    return json({
      model: response.model,
      generatedAt: new Date().toISOString(),
      request: body,
      response,
      latencyMs: Date.now() - started,
      usage: response.usage,
      neuralModel: "megafly-lif-v1",
      transport: { status: result.response.status, requestId: result.response.headers.get("x-request-id") ?? result.response.headers.get("request-id") },
      decision: { action: action.choice, from: "display", to: destination.choice, percentage: allocation(action.choice, destination.choice), confidence: action.confidence },
      steps: fallbackTrace.steps,
    }, 200);
  } catch (error) {
    const status = (error as { status?: number }).status;
    console.error("[jev] request failed:", status ?? error);
    return json({ error: status ? `Jev returned HTTP ${status}. No decision was applied.` : "Jev request failed. No decision was applied." }, 502);
  }
};
