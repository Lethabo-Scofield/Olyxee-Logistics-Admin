import { randomBytes } from "crypto";

export function generateId(): string {
  return randomBytes(16).toString("hex");
}

export function generateTrackingId(slug: string): string {
  const prefix = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 3);
  const year = new Date().getFullYear();
  const num = Math.floor(100000 + Math.random() * 899999);
  return `${prefix}-${year}-${num}`;
}
