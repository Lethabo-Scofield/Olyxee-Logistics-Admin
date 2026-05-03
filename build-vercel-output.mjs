/**
 * Vercel Build Output API v3
 * https://vercel.com/docs/build-output-api/v3
 *
 * Converts our monorepo build artifacts into Vercel's explicit output format.
 * Run as the last step of `pnpm run build:vercel`.
 *
 *   .vercel/output/
 *     config.json                          ← routing rules
 *     static/                              ← CDN-served frontend (Vite build)
 *     functions/
 *       api/
 *         handler.func/                    ← serverless Express API
 *           handler.mjs  (+ pino workers)
 *           .vc-config.json
 */

import { mkdir, cp, writeFile, rm, readdir } from "fs/promises";
import { existsSync } from "fs";

const OUT = ".vercel/output";
const FUNC_DIR = `${OUT}/functions/api/handler.func`;

console.log("Building Vercel output…");

// Clean previous output
await rm(OUT, { recursive: true, force: true });

// ── Static frontend ──────────────────────────────────────────────────────────
await mkdir(`${OUT}/static`, { recursive: true });
await cp("artifacts/olyxee-admin/dist/public", `${OUT}/static`, { recursive: true });
console.log("  ✓ static/ ← artifacts/olyxee-admin/dist/public");

// ── Serverless API function ──────────────────────────────────────────────────
await mkdir(FUNC_DIR, { recursive: true });

// Copy every file esbuild produced into api/ (handler.mjs + pino workers)
const apiFiles = await readdir("api");
for (const file of apiFiles) {
  await cp(`api/${file}`, `${FUNC_DIR}/${file}`);
}
console.log(`  ✓ functions/api/handler.func/ ← api/ (${apiFiles.join(", ")})`);

// Function runtime config
await writeFile(
  `${FUNC_DIR}/.vc-config.json`,
  JSON.stringify({
    runtime: "nodejs20.x",
    handler: "handler.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: true,
    maxDuration: 30,
  }, null, 2),
);

// ── Routing config ───────────────────────────────────────────────────────────
await writeFile(
  `${OUT}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [
      // Send /api/* to the Express serverless function
      { src: "/api/(.*)", dest: "/api/handler" },
      // Serve static assets from the CDN
      { handle: "filesystem" },
      // SPA fallback — all other paths → index.html
      { src: "/(.*)", dest: "/index.html" },
    ],
    // Long-lived cache for hashed Vite assets
    overrides: {
      "assets/**": {
        headers: { "cache-control": "public,max-age=31536000,immutable" },
      },
    },
  }, null, 2),
);

console.log("  ✓ config.json written");
console.log("Done — .vercel/output is ready.");
