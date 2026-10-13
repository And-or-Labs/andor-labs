/* `npm run dev`: astro dev plus the Pages Functions (wrangler pages dev on
   8788, picked up by the /api proxy in astro.config.mjs). Forwards argv and
   PORT to astro; dies when either child dies. */
import { spawn } from "node:child_process";

const extra = process.argv.slice(2);
const astroArgs = ["dev", ...extra];
const hasPort = extra.some((a) => a === "--port" || a.startsWith("--port="));
if (process.env.PORT && !hasPort) astroArgs.push("--port", process.env.PORT);

const children = [
  spawn("npx", ["astro", ...astroArgs], { stdio: "inherit", env: process.env }),
  // --persist-to: a separate miniflare dir so this does not share SQLite
  // state (or lock) with another wrangler dev on this repo, e.g. :8799.
  // --kv BRIEF: local brief cache binding (prod binds it in the dashboard).
  spawn("npx", ["wrangler", "pages", "dev", "public", "--port", "8788", "--persist-to", ".scratch/wrangler-dev", "--kv", "BRIEF"], { stdio: "inherit", env: process.env }),
];

let exiting = false;
const shutdown = (code) => {
  if (exiting) return;
  exiting = true;
  for (const c of children) if (!c.killed) c.kill("SIGINT");
  setTimeout(() => process.exit(code), 300).unref();
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
for (const c of children) {
  c.on("exit", (code, signal) => {
    if (!exiting) {
      console.error(`[dev] ${c.spawnargs[1]} exited (${signal ?? code}); stopping`);
      shutdown(code ?? 1);
    }
  });
}
