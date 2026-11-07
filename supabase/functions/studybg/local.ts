// Local test entry: same handler, but with the code from this checkout instead of the pinned URL.
import { buildFromEnv } from "../../../server/bootstrap.js";
import { start } from "./handler.ts";

await start(buildFromEnv);
