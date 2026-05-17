// Vercel serverless entrypoint. A `/api/(.*)` rewrite in vercel.json routes
// every /api/* request to this single function, which delegates to the
// existing Express app (it mounts its routes under /api so URL paths match).
// @ts-expect-error -- bundled .mjs has no type declarations
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
