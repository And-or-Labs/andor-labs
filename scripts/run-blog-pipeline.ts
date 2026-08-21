/**
 * The whole pipeline, end to end, unattended.
 *
 * Ask AirOps for a post, convert and validate it, source a hero, publish if it
 * passes. This is the piece that makes "2 posts a week" a schedule rather than a
 * chore: point cron at it twice a week and nothing else has to happen.
 *
 *   AirOps async_execute  →  envelope
 *        ↓
 *   ingest-post           →  drafts.post-<slug>
 *        ↓
 *   backfill-heroes       →  Openverse → dither → upload
 *        ↓
 *   ingest-post (again)   →  published, if every check passed
 *        ↓
 *   Sanity webhook        →  Cloudflare Pages build  →  live
 *
 * The second ingest is not a retry. Block keys are content-derived, so re-running
 * with an unchanged envelope is byte-identical and therefore safe; what changes
 * is that the document now has a hero, which is the last condition on publishing.
 *
 * Run with:
 *   node --experimental-strip-types scripts/run-blog-pipeline.ts
 *   …  --topic "how to choose an ad server"   seed the generator with a topic
 *   …  --dry-run                              generate and check, write nothing
 *   …  --envelope path.json                   skip AirOps, use a local envelope
 *
 * Needs AIROPS_API_KEY, AIROPS_APP_UUID and SANITY_WRITE_TOKEN in .env.
 */
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------- env */

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {...(process.env as Record<string, string>)};
  const file = path.join(process.cwd(), ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) out[m[1]] = m[2];
    }
  }
  return out;
}

const env = loadEnv();
const argOf = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (name: string) => process.argv.includes(`--${name}`);

const SCRATCH = path.join(process.cwd(), ".scratch");

/* --------------------------------------------------------------- airops */

const API = env.AIROPS_API_BASE ?? "https://api.airops.com/public_api";

async function airops(pathname: string, init?: RequestInit) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.AIROPS_API_KEY}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AirOps ${pathname} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Run the playbook and wait for it.
 *
 * Async rather than sync: the sync endpoint fails outright if the run exceeds
 * ten minutes, and a research-and-draft workflow is exactly the kind that
 * sometimes does. Queued-and-polled degrades to "slow" where sync degrades to
 * "lost".
 */
async function generate(topic?: string): Promise<unknown> {
  const uuid = env.AIROPS_APP_UUID;
  if (!uuid) {
    throw new Error(
      "AIROPS_APP_UUID is not set.\n" +
        "  Find it in the AirOps URL when the playbook is open, or via:\n" +
        `  curl -H "Authorization: Bearer $AIROPS_API_KEY" ${API}/airops_apps\n` +
        "  then add AIROPS_APP_UUID=<uuid> to .env",
    );
  }

  const started = await airops(`/airops_apps/${uuid}/async_execute`, {
    method: "POST",
    body: JSON.stringify({inputs: topic ? {topic} : {}}),
  });

  const id = started.uuid ?? started.id;
  console.log(`AirOps execution ${id} queued…`);

  // Poll with a ceiling rather than forever: an execution wedged in `pending`
  // must fail the cron run loudly, not hold a process open until someone
  // notices. Twenty minutes is double the sync endpoint's own limit.
  const deadline = Date.now() + 20 * 60_000;
  let delay = 5_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`AirOps execution ${id} still running after 20 min`);
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 30_000);

    const run = await airops(`/airops_apps/executions/${id}`);
    if (run.status === "success") {
      console.log(`AirOps execution ${id} succeeded (${run.credits_used ?? "?"} credits).`);
      return run.output;
    }
    if (run.status === "error" || run.status === "cancelled") {
      throw new Error(`AirOps execution ${id} ended as "${run.status}": ${JSON.stringify(run.output).slice(0, 400)}`);
    }
    if (run.status === "review_needed") {
      throw new Error(
        `AirOps execution ${id} is waiting on a human review step. This pipeline expects the ` +
          `playbook to run unattended — remove the approval step, or run it manually.`,
      );
    }
    console.log(`  … ${run.status}`);
  }
}

/**
 * Dig the envelope out of whatever the workflow returned.
 *
 * A workflow's output shape depends on how its final step is named, and that is
 * configuration nobody should have to keep in sync with this file. So: accept the
 * object itself, a single-key wrapper around it, or a JSON string, and fail with
 * the actual keys when none of those match.
 */
function unwrapEnvelope(output: unknown): Record<string, unknown> {
  const looksLikeEnvelope = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && "title" in v && "bodyMarkdown" in v;

  if (typeof output === "string") {
    try {
      return unwrapEnvelope(JSON.parse(output));
    } catch {
      throw new Error("AirOps returned a string that is not JSON");
    }
  }
  if (looksLikeEnvelope(output)) return output;

  if (typeof output === "object" && output !== null) {
    for (const value of Object.values(output)) {
      if (looksLikeEnvelope(value)) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (looksLikeEnvelope(parsed)) return parsed;
        } catch {
          /* not JSON; keep looking */
        }
      }
    }
    throw new Error(
      `No envelope in the AirOps output. Expected an object with "title" and "bodyMarkdown"; ` +
        `got keys: ${Object.keys(output).join(", ") || "(none)"}. See docs/AIROPS-CONTRACT.md.`,
    );
  }
  throw new Error(`AirOps output was ${typeof output}, not an object`);
}

/* --------------------------------------------------------------- steps */

function run(cmd: string, args: string[]): string {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {encoding: "utf8", stdio: ["inherit", "pipe", "inherit"]});
}

const ingest = (file: string, extra: string[] = []) =>
  run("node", ["--experimental-strip-types", "scripts/ingest-post.ts", "--file", file, ...extra]);

/* ----------------------------------------------------------------- main */

async function main() {
  fs.mkdirSync(SCRATCH, {recursive: true});
  const dryRun = has("dry-run");

  /* 1. get an envelope ------------------------------------------------- */

  const local = argOf("envelope");
  const envelope = local
    ? JSON.parse(fs.readFileSync(local, "utf8"))
    : unwrapEnvelope(await generate(argOf("topic")));

  const slug = String(envelope.slug ?? envelope.title ?? "post")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  // Kept on disk before anything else touches it. A generation that cost credits
  // and then failed validation must be re-runnable without paying for it twice.
  const file = path.join(SCRATCH, `envelope-${slug}.json`);
  fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
  console.log(`Envelope saved → ${path.relative(process.cwd(), file)}`);

  if (dryRun) {
    console.log(ingest(file, ["--dry-run"]));
    return;
  }

  /* 2. first ingest — lands as a draft, no hero yet -------------------- */

  console.log(ingest(file));

  /* 3. hero ------------------------------------------------------------ */
  // Its own script because it already exists, has a measured quality gate, and
  // is idempotent: posts that already have art are skipped, so this is safe to
  // run on every pass.

  try {
    run("npx", ["sanity", "exec", "scripts/backfill-heroes.ts", "--with-user-token"]);
  } catch {
    // A missing hero blocks publication but must not lose the draft — the post
    // is already safely in Sanity and a human can pick art by hand.
    console.error("\n⚠ hero sourcing failed; the draft is written and can be published once it has art.");
  }

  /* 4. second ingest — promotes the draft if everything passed --------- */

  console.log(ingest(file));
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
