import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { buildFromEnv } from "./bootstrap.js";

// Local development / any Node host. Production runs as a Supabase Edge Function instead
// (see supabase/functions/studybg), which builds the same app with buildFromEnv.
const { app, db, sweep, summary } = await buildFromEnv(process.env, {
  staticDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist"),
});

const port = Number(process.env.PORT) || 8787;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`StudyBg API listening on :${port} (${summary})`);
});

// Durable jobs remain pending across restarts; sweep them periodically.
const timer = setInterval(sweep, 30_000);
timer.unref();
void sweep();
process.on("SIGTERM", () => {
  clearInterval(timer);
  server.close(async () => {
    await db?.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref();
});
