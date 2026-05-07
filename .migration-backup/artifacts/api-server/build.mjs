import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "..", "..");

const sharedExternal = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt",
  "argon2", "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil",
  "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider", "isolated-vm",
  "lightningcss", "pg-native", "oracledb", "mongodb-client-encryption",
  "nodemailer", "handlebars", "knex", "typeorm", "protobufjs",
  "onnxruntime-node", "@tensorflow/*", "@prisma/client", "@mikro-orm/*",
  "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*", "@opentelemetry/*",
  "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
  "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
  "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis", "kerberos",
  "leveldown", "miniflare", "mysql2", "newrelic", "odbc", "piscina", "realm",
  "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport", "snappy",
  "tinypool", "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
  "playwright", "puppeteer", "puppeteer-core", "electron",
];

const sharedBanner = {
  js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
  `,
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  // ── Build 1: Standalone server (Replit / traditional host) ──────────────
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: sharedExternal,
    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
    banner: sharedBanner,
  });

  // ── Build 2: Vercel serverless handler ──────────────────────────────────
  // Bundles the Express app into a single file at <repo-root>/api/index.mjs.
  // Vercel auto-detects files in /api/ at the project root and exposes them
  // as serverless functions. We export the Express app as the default
  // export — Express app instances are valid Node HTTP handlers, so Vercel
  // can invoke them directly per request.
  //
  // We deliberately do NOT include the esbuild-plugin-pino transport plugin
  // here. Vercel runs functions with NODE_ENV=production, where the pino
  // logger writes raw JSON to stdout (no transport worker). Vercel captures
  // stdout for log output, so we get structured logs without needing a
  // pretty-printer or worker thread (which can't run reliably inside a
  // single-file serverless bundle).
  // The output filename `[[...path]].mjs` is Vercel's catch-all convention.
  // It causes Vercel to route every request matching `/api/*` (and `/api`
  // itself) to this single function, while preserving the original URL in
  // `req.url`. This lets Express's `app.use("/api", router)` match the
  // sub-paths normally — without it we'd need a rewrite, which would
  // collapse all sub-paths to `/api` and break routing.
  const vercelDir = path.resolve(repoRoot, "api");
  await mkdir(vercelDir, { recursive: true });
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/handler.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(vercelDir, "[[...path]].mjs"),
    logLevel: "info",
    external: sharedExternal,
    sourcemap: "linked",
    banner: sharedBanner,
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
