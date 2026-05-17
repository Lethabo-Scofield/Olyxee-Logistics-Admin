// Shared, framework-agnostic order status data.
// Imported by BOTH the API server (for outgoing email copy) and the admin
// frontend (for the live email preview + suggested message chips), so the
// admin sees exactly what the customer will receive.

export const ORDER_STATUSES = [
  "Order received",
  "Processing",
  "Driver assigned",
  "In transit",
  "Delayed",
  "Out for delivery",
  "Delivered",
  "Failed delivery",
  "Cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface StatusChoices {
  primary: OrderStatus;
  exceptions: OrderStatus[];
}

const CHOICES: Record<string, StatusChoices | null> = {
  "Order received":   { primary: "Processing",       exceptions: ["Delayed", "Cancelled"] },
  "Processing":       { primary: "Driver assigned",  exceptions: ["Delayed", "Cancelled"] },
  "Driver assigned":  { primary: "In transit",       exceptions: ["Delayed", "Cancelled"] },
  "In transit":       { primary: "Out for delivery", exceptions: ["Delayed", "Cancelled"] },
  "Delayed":          { primary: "In transit",       exceptions: ["Failed delivery", "Cancelled"] },
  "Out for delivery": { primary: "Delivered",        exceptions: ["Failed delivery", "Cancelled"] },
  "Failed delivery":  { primary: "Driver assigned",  exceptions: ["Delayed", "Cancelled"] },
  "Delivered":        null,
  "Cancelled":        null,
};

export function statusChoices(current: string): StatusChoices | null {
  return CHOICES[current] ?? null;
}

export function nextStatuses(current: string): OrderStatus[] {
  const c = statusChoices(current);
  if (!c) return [];
  return [c.primary, ...c.exceptions];
}

export function isTerminal(status: string): boolean {
  return CHOICES[status] === null;
}

// ─── Customer-facing email copy ──────────────────────────────────────────────
// SINGLE source of truth. Used by:
//   1. Server email template — actual outgoing email
//   2. Admin order detail page — live email preview
// Mirror updates between them is now impossible (same import).
export interface StatusCopy {
  headline: string;       // e.g. "Your package is on the way"
  intro: string;          // one-line description shown under the headline
  accent: string;         // hex color used for the status badge in the email
  tone: "positive" | "neutral" | "warning" | "negative";
}

export const STATUS_COPY: Record<string, StatusCopy> = {
  "Order received":   { headline: "We've got your order",          intro: "Thanks for choosing us — we'll start preparing it shortly.",            accent: "#0284c7", tone: "neutral" },
  "Processing":       { headline: "We're preparing your order",    intro: "Your items are being packed and made ready for collection.",            accent: "#7c3aed", tone: "neutral" },
  "Driver assigned":  { headline: "A driver is on the way",        intro: "A driver has been assigned to collect your package.",                   accent: "#4f46e5", tone: "neutral" },
  "In transit":       { headline: "Your package is on the move",   intro: "It's making its way through our network to you.",                       accent: "#2563eb", tone: "positive" },
  "Delayed":          { headline: "Your delivery is a bit late",   intro: "We're sorry — there's a small delay. We'll keep you posted.",          accent: "#d97706", tone: "warning" },
  "Out for delivery": { headline: "Out for delivery today",        intro: "A driver is bringing your package to you now.",                         accent: "#ea580c", tone: "positive" },
  "Delivered":        { headline: "Your package has arrived",      intro: "It's been delivered successfully. Thanks for trusting us!",             accent: "#16a34a", tone: "positive" },
  "Failed delivery":  { headline: "We couldn't deliver today",     intro: "Our driver wasn't able to complete the delivery. We'll be in touch.",   accent: "#dc2626", tone: "negative" },
  "Cancelled":        { headline: "Your order has been cancelled", intro: "If this wasn't expected, please reach out to us.",                      accent: "#6b7280", tone: "negative" },
};

export function statusCopy(status: string): StatusCopy {
  return STATUS_COPY[status] ?? {
    headline: `Order update: ${status}`,
    intro: "Your order status has been updated.",
    accent: "#2b2b2b",
    tone: "neutral",
  };
}

// ─── Suggested admin messages per next-status ────────────────────────────────
// Shown as one-click chips below the message textarea so the admin doesn't
// have to invent wording every time. These match the customer-facing tone.
export const SUGGESTED_MESSAGES: Record<string, string[]> = {
  "Processing":       [
    "We've started preparing your order.",
    "Your items are being packed now.",
  ],
  "Driver assigned":  [
    "A driver has been assigned and will collect your package shortly.",
    "Expect a call from our driver soon.",
  ],
  "In transit":       [
    "Your package has left our facility.",
    "On its way to the next sorting hub.",
  ],
  "Delayed":          [
    "Sorry — there's a slight delay due to high volume. We'll update you soon.",
    "Delivery is delayed due to weather. We're working to get it to you.",
  ],
  "Out for delivery": [
    "Our driver is on the way to you today.",
    "Expect your delivery within the next few hours.",
  ],
  "Delivered":        [
    "Your package has been delivered. Thanks for choosing us!",
    "Delivered successfully — please let us know if anything's missing.",
  ],
  "Failed delivery":  [
    "We weren't able to reach you. We'll attempt redelivery tomorrow.",
    "Address could not be located — please contact us to confirm details.",
  ],
  "Cancelled":        [
    "Your order has been cancelled as requested.",
    "Order cancelled — please reach out if this wasn't expected.",
  ],
};

export function suggestedMessages(status: string): string[] {
  return SUGGESTED_MESSAGES[status] ?? [];
}
