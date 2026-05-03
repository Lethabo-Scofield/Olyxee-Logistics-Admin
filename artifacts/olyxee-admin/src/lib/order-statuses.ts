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
