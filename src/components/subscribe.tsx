import { useState } from "react";
import { Button, cn } from "@andor/ds";

type State = { kind: "idle" | "sending" | "done" | "error"; text?: string };

/** Field notes signup. Posts to the Loops-backed Pages Function at /api/subscribe. */
export function Subscribe({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, lists: ["field-notes"], source: "andorlabs.ca" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) setState({ kind: "done", text: "You're on the list. Check your inbox to confirm." });
      else setState({ kind: "error", text: body.error ?? "That didn't go through. Try again?" });
    } catch {
      setState({ kind: "error", text: "That didn't go through. Try again?" });
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)} noValidate={false}>
      <label htmlFor="subscribe-email" className="sr-only">Email address</label>
      <div className="flex gap-2 max-sm:flex-col">
        <input
          id="subscribe-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          disabled={state.kind === "sending" || state.kind === "done"}
          className="h-11 min-w-0 flex-1 rounded-lg bg-background px-3.5 text-[15px] shadow-[0_0_0_1px_var(--input)] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_2px_var(--ring)]"
        />
        <Button type="submit" size="lg" disabled={state.kind === "sending" || state.kind === "done"}>
          {state.kind === "sending" ? "Subscribing" : "Subscribe"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={cn("mt-2 min-h-5 text-sm", state.kind === "error" ? "text-destructive" : "text-muted-foreground")}>
        {state.text}
      </p>
    </form>
  );
}
