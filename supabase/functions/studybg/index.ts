// Deployed entry point. The API code lives in server/ in this repository and is imported from a
// commit-pinned URL, so exactly the reviewed code runs (change the commit to ship a new version).
import { buildFromEnv } from "https://raw.githubusercontent.com/greensystemstests/medstudent/COMMIT_SHA/server/bootstrap.js";
import { start } from "./handler.ts";

await start(buildFromEnv);
