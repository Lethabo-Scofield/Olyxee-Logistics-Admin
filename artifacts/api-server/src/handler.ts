/**
 * Vercel Serverless Handler
 *
 * Exports the Express app without binding to a port.
 * Vercel's Node.js runtime accepts an Express app as a default export
 * and handles the listen lifecycle itself.
 *
 * Built by `build.mjs` into `../../api/handler.mjs`.
 */
export { default } from "./app";
