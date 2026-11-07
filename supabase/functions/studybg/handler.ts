// Runs the StudyBg API (the same Express app as server/) inside a Supabase Edge Function.
// The function is reachable at https://<project>.supabase.co/functions/v1/studybg/…
// Supabase keeps the function name in the path, so the app is mounted under /studybg (and at / for local runs).
import express from "express";

// deno-lint-ignore no-explicit-any
type Build = (env: Record<string, string | undefined>, options: Record<string, unknown>) => Promise<{ app: any; summary: string }>;

export async function start(buildFromEnv: Build) {
  const { app, summary } = await buildFromEnv(Deno.env.toObject(), {
    runMigrations: false, // the schema is managed with Supabase migrations (supabase/migrations)
    runtime: "edge",
    // Keep the isolate alive until background work (sending a receipt) finishes.
    // deno-lint-ignore no-explicit-any
    waitUntil: (p: Promise<unknown>) => (globalThis as any).EdgeRuntime?.waitUntil?.(p),
  });
  console.log(`StudyBg API ready (${summary})`);

  const outer = express();
  outer.use("/studybg", app);
  outer.use(app);
  outer.listen(Number(Deno.env.get("PORT")) || 3000);
}
