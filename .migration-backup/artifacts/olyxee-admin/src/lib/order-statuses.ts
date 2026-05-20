// Framework-agnostic order status data (statuses, transitions, customer copy,
// suggested admin messages) lives in @workspace/order-statuses so the admin
// UI and the server email template stay in lockstep.
//
// This file layers on the UI-only bits (lucide icons, tailwind classes) that
// don't belong in a shared lib.
import {
  ClipboardList, Settings2, Truck, AlertTriangle,
  Navigation, House, PackageX, Ban, Package,
} from "lucide-react";

export {
  ORDER_STATUSES,
  type OrderStatus,
  type StatusChoices,
  statusChoices,
  nextStatuses,
  isTerminal,
  STATUS_COPY,
  statusCopy,
  type StatusCopy,
  SUGGESTED_MESSAGES,
  suggestedMessages,
} from "@workspace/order-statuses";

// ─── Visual config (shared between detail page + lists) ──────────────────────
export interface StatusVisual {
  icon: React.ElementType;
  bg: string;
  border: string;
  iconColor: string;
  label: string;
}

export const STATUS_VISUALS: Record<string, StatusVisual> = {
  "Order received":   { icon: ClipboardList, bg: "bg-sky-50",    border: "border-sky-300",    iconColor: "text-sky-600",    label: "Order Received" },
  "Processing":       { icon: Settings2,     bg: "bg-violet-50", border: "border-violet-300", iconColor: "text-violet-600", label: "Processing" },
  "In transit":       { icon: Truck,         bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600",   label: "In Transit" },
  "Delayed":          { icon: AlertTriangle, bg: "bg-amber-50",  border: "border-amber-300",  iconColor: "text-amber-600",  label: "Delayed" },
  "Out for delivery": { icon: Navigation,    bg: "bg-orange-50", border: "border-orange-300", iconColor: "text-orange-600", label: "Out for Delivery" },
  "Delivered":        { icon: House,         bg: "bg-green-50",  border: "border-green-400",  iconColor: "text-green-600",  label: "Delivered" },
  "Failed delivery":  { icon: PackageX,      bg: "bg-red-50",    border: "border-red-300",    iconColor: "text-red-600",    label: "Failed Delivery" },
  "Cancelled":        { icon: Ban,           bg: "bg-gray-100",  border: "border-gray-300",   iconColor: "text-gray-500",   label: "Cancelled" },
};

export function getStatusVisual(status: string): StatusVisual {
  return STATUS_VISUALS[status] ?? {
    icon: Package,
    bg: "bg-muted",
    border: "border-border",
    iconColor: "text-muted-foreground",
    label: status,
  };
}
