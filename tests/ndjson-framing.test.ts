/**
 * NDJSON framing, as the audit modal parses it.
 *
 * This exists because the first version of the client had a real bug that no
 * type checker or build would catch: it split on newlines, held the tail in a
 * buffer, and broke out of the read loop on `done` WITHOUT processing that
 * tail. Streamed audits were fine — every line there ends in \n — but the
 * non-streamed replies (need-url, validation failures) are a single JSON object
 * with no trailing newline, so they lived entirely in the dropped buffer. The
 * whole free-mail path silently did nothing.
 *
 * The logic below mirrors AuditModal.astro's reader. If you change one, change
 * both — this is the cheap way to keep a bug that only shows up in a browser
 * out of the browser.
 */
import { describe, expect, it } from "vitest";

/** Feed chunks through the same algorithm the modal uses; collect messages. */
function parseStream(chunks: string[]): any[] {
  const out: any[] = [];
  let buf = "";

  const handle = (raw: string) => {
    if (!raw.trim()) return;
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* a partial or malformed line is skipped, never thrown */
    }
  };

  for (const chunk of chunks) {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const raw of lines) handle(raw);
  }
  handle(buf); // the flush that was missing

  return out;
}

const line = (o: unknown) => `${JSON.stringify(o)}\n`;

describe("NDJSON framing", () => {
  it("reads whole lines delivered one per chunk", () => {
    const msgs = parseStream([
      line({ t: "open", host: "acme.com" }),
      line({ t: "step", label: "Reading your homepage", status: "OK" }),
      line({ t: "result", grade: "C" }),
    ]);
    expect(msgs.map((m) => m.t)).toEqual(["open", "step", "result"]);
  });

  it("reassembles a line split across chunk boundaries", () => {
    const whole = line({ t: "step", label: "Rounding in your favour", status: "NO" });
    const cut = Math.floor(whole.length / 2);
    const msgs = parseStream([whole.slice(0, cut), whole.slice(cut)]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe("NO");
  });

  it("handles several messages arriving in one chunk", () => {
    const msgs = parseStream([line({ t: "step", label: "a" }) + line({ t: "step", label: "b" })]);
    expect(msgs).toHaveLength(2);
  });

  it("handles a boundary that lands exactly on the newline", () => {
    const a = line({ t: "step", label: "a" });
    const b = line({ t: "step", label: "b" });
    expect(parseStream([a, b])).toHaveLength(2);
    expect(parseStream([a.slice(0, -1), "\n" + b])).toHaveLength(2);
  });

  it("READS A FINAL LINE WITH NO TRAILING NEWLINE — the bug this file exists for", () => {
    // Exactly the shape of the need-url reply: one object, no \n.
    const msgs = parseStream([JSON.stringify({ t: "need-url", message: "What's the site?" })]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].t).toBe("need-url");
  });

  it("reads an unterminated final line even when it arrives split", () => {
    const whole = JSON.stringify({ t: "failed", message: "Couldn't read that site." });
    const msgs = parseStream([whole.slice(0, 10), whole.slice(10)]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].message).toBe("Couldn't read that site.");
  });

  it("reads a result that follows steps with no trailing newline", () => {
    const msgs = parseStream([
      line({ t: "step", label: "a" }),
      JSON.stringify({ t: "result", grade: "B", lockedItems: ["Free trials"] }),
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].grade).toBe("B");
  });

  it("skips a malformed line instead of throwing away the rest of the stream", () => {
    const msgs = parseStream([
      line({ t: "step", label: "a" }),
      "{ not json at all }\n",
      line({ t: "result", grade: "A" }),
    ]);
    expect(msgs.map((m) => m.t)).toEqual(["step", "result"]);
  });

  it("ignores blank lines and trailing whitespace", () => {
    expect(parseStream([`\n\n${line({ t: "step", label: "a" })}\n  \n`])).toHaveLength(1);
  });

  it("survives a stream that ends mid-object without corrupting what came before", () => {
    const msgs = parseStream([line({ t: "step", label: "a" }), '{"t":"resu']);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].label).toBe("a");
  });
});
