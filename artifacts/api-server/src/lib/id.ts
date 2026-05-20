import { randomBytes } from "crypto";

export function generateId(): string {
  return randomBytes(16).toString("hex");
}

// Alphabet for customer-facing tracking IDs. Excludes 0/O/1/I/L so the codes
// stay readable when handwritten or read aloud over the phone.
const TRACKING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(n: number): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += TRACKING_ALPHABET[bytes[i] % TRACKING_ALPHABET.length];
  }
  return out;
}

// Customer-facing tracking ID in the form {PREFIX}-{3 alnums}-{4 alnums},
// e.g. FSL-K7M-9X2A. Prefix is 3–5 uppercase letters chosen by the business;
// we sanitize and clamp it here so unusual inputs (slugs, lowercase) still
// produce a well-formed ID. ~26 bits of entropy in the random portion — plenty
// for tens of thousands of orders per tenant before collision risk matters,
// and the caller still loops on the unique constraint to be safe.
export function generateTrackingId(prefixInput: string): string {
  const cleaned = (prefixInput ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .substring(0, 5);
  const prefix = cleaned.length >= 3 ? cleaned : "OLY";
  return `${prefix}-${randomChars(3)}-${randomChars(4)}`;
}
