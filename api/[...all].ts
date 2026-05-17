// Vercel serverless entrypoint. Routes every /api/* request through the
// existing Express app from artifacts/api-server, which mounts its routes
// under /api so the URL paths match.
import app from "../artifacts/api-server/dist/app.mjs";

export const config = {
  runtime: "nodejs20.x",
};

export default app;
