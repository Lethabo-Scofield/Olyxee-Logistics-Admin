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

const TRANSITIONS: Record<string, OrderStatus[]> = {
  "Order received":  ["Processing", "Cancelled"],
  "Processing":      ["Driver assigned", "Delayed", "Cancelled"],
  "Driver assigned": ["In transit", "Delayed", "Cancelled"],
  "In transit":      ["Out for delivery", "Delayed", "Failed delivery", "Cancelled"],
  "Delayed":         ["In transit", "Driver assigned", "Out for delivery", "Failed delivery", "Cancelled"],
  "Out for delivery":["Delivered", "Failed delivery", "Delayed"],
  "Delivered":       [],
  "Failed delivery": ["Driver assigned", "In transit", "Cancelled"],
  "Cancelled":       [],
};

export function nextStatuses(current: string): OrderStatus[] {
  return TRANSITIONS[current] ?? ORDER_STATUSES.filter(s => s !== current);
}

export function isTerminal(status: string): boolean {
  return TRANSITIONS[status]?.length === 0;
}
