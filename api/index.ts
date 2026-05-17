// Vercel serverless entrypoint. A `/api/(.*)` rewrite in vercel.json routes
// every /api/* request to this single function, which delegates to the
// existing Express app (it mounts its routes under /api so URL paths match).
//
// The bundled app is copied to ./_bundle/ at build time so this function is
// fully self-contained inside the api/ directory.
// @ts-expect-error -- bundled .mjs has no type declarations
import app from "./_bundle/app.mjs";

export default app;
