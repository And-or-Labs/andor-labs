/**
 * Capture briefing fixtures for staging replay: runs the SAME runBrief
 * pipeline as /api/brief for every A+ organisation in snitcher-orgs.json and
 * writes .scratch/briefing/fixtures/<domain>.json plus index.json.
 *
 * Usage: node --experimental-strip-types scripts/capture-brief-fixtures.mts [name-prefix ...]
 * Keys come from .env / .dev.vars (.dev.vars wins). Sequential, 1.5 s apart,
 * already-captured domains are skipped. Aborts if one company costs > $0.05.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { runBrief, type BriefEvent } from "../src/lib/brief/pipeline.ts";
import {
  entityAccepted,
  interpret,
  resultHost,
  shapeHome,
  type Firmo,
} from "../src/lib/brief/interpret.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = `${ROOT}.scratch/briefing`;
const OUT = `${DIR}/fixtures`;
mkdirSync(OUT, { recursive: true });

const dotenv = (file: string): Record<string, string> => {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
};
const vars = { ...dotenv(`${ROOT}.env`), ...dotenv(`${ROOT}.dev.vars`), ...process.env };
const exaKey = vars.EXA_API_KEY;
const jevKey = vars.TYPESAFE_API_KEY;
if (!exaKey || !jevKey) throw new Error("EXA_API_KEY and TYPESAFE_API_KEY required");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const host = (u: string) => {
  try {
    return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const sizeOf = (o: { size?: unknown }) =>
  (o.size && typeof o.size === "object" ? ((o.size as Record<string, string>).name ?? (o.size as Record<string, string>).range ?? JSON.stringify(o.size)) : o.size) as string | null;

interface Org {
  name: string;
  website: string;
  industry?: string;
  size?: unknown;
  founded?: number | null;
  icp_tier?: string;
  type?: string | null;
  logo?: string;
  last_seen?: string;
  address?: { city?: string; country?: string };
}

const orgs = (JSON.parse(readFileSync(`${DIR}/snitcher-orgs.json`, "utf8")).data as Org[]).filter((o) => o.icp_tier === "A+");
const want = process.argv.slice(2);

/**
 * `--reinterpret`: re-run the pure interpret() over every fixture's stored raw
 * inputs so the frozen brief reflects current copy/rules without an API call.
 */
if (want[0] === "--reinterpret") {
  for (const file of readdirSync(OUT).filter((f) => f.endsWith(".json") && f !== "index.json")) {
    const f = JSON.parse(readFileSync(`${OUT}/${file}`, "utf8"));
    const domain = file.replace(/\.json$/, "");
    const accepted = entityAccepted(domain, f.raw?.entity ?? null);
    const firmo: Firmo = {
      name: f.snitcher.name ?? domain,
      domain,
      industry: f.snitcher.industry ?? null,
      size: f.snitcher.size ?? null,
      founded: null,
      city: f.snitcher.city ?? f.snitcher.address?.city ?? null,
      country: f.snitcher.country ?? f.snitcher.address?.country ?? null,
      source: "spotter",
    };
    f.brief = interpret({
      firmo,
      entityRaw: accepted ? f.raw?.entity ?? null : null,
      home: shapeHome(f.raw?.home ?? null),
      jev: f.raw?.jev ?? null,
    });
    writeFileSync(`${OUT}/${file}`, JSON.stringify(f, null, 1));
    const src = accepted ? "entity" : shapeHome(f.raw?.home ?? null) ? "homepage" : "none";
    console.log(`${domain}  brief rebuilt (description: ${src})`);
  }
  console.log("reinterpret done");
  process.exit(0);
}

let spend = 0;

for (const o of orgs) {
  if (want.length && !want.some((a) => o.name.toLowerCase().startsWith(a.toLowerCase()))) continue;
  const domain = host(o.website);
  const file = `${OUT}/${domain}.json`;
  if (existsSync(file)) {
    console.log(`skip ${domain} (already captured)`);
    continue;
  }
  const snitcher = {
    name: o.name,
    website: o.website,
    industry: o.industry ?? null,
    size: sizeOf(o) ?? null,
    address: { city: o.address?.city ?? null, country: o.address?.country ?? null },
    icp_tier: o.icp_tier ?? null,
    logo: o.logo ?? null,
    last_seen: o.last_seen ?? null,
    type: o.type ?? null,
  };
  const firmo: Partial<Firmo> = {
    industry: snitcher.industry,
    size: snitcher.size,
    founded: o.founded ?? null,
    city: snitcher.address.city,
    country: snitcher.address.country,
    source: "spotter",
  };
  const events: BriefEvent[] = [];
  const r = await runBrief({
    domain,
    name: o.name,
    firmo,
    exaKey,
    jevKey,
    emit: (e) => events.push(e),
  });
  spend += r.exaCost;
  if (r.exaCost > 0.05) {
    console.error(`ABORT: ${domain} cost $${r.exaCost.toFixed(4)} > $0.05`);
    process.exit(1);
  }
  writeFileSync(
    file,
    JSON.stringify(
      { snitcher, events, brief: r.brief, totalMs: r.totalMs, exaCost: r.exaCost, jevTokens: r.jevTokens, raw: r.raw },
      null,
      1,
    ),
  );
  const descSrc = entityAccepted(domain, r.raw.entity) ? "entity" : shapeHome(r.raw.home) ? "homepage" : "none";
  console.log(`${domain}  ${r.totalMs}ms  $${r.exaCost.toFixed(4)}  verdict=${r.brief.verdict?.key ?? "-"}  notices=${r.notices.join(",") || "-"}  desc=${descSrc}${r.rejectedHost ? `  rejected=${r.rejectedHost}` : ""}`);
  await sleep(1500);
}

const index = orgs
  .map((o) => ({ name: o.name, domain: host(o.website), industry: o.industry ?? null, city: o.address?.city ?? null, last_seen: o.last_seen ?? null }))
  .filter((f) => existsSync(`${OUT}/${f.domain}.json`));
writeFileSync(`${OUT}/index.json`, `${JSON.stringify(index, null, 1)}\n`);
console.log(`index: ${index.length} fixtures. Exa spend this run: $${spend.toFixed(4)}`);
