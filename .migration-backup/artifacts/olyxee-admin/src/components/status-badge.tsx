import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  "Order received": "bg-gray-100 text-gray-700 border-gray-200",
  "Processing": "bg-blue-50 text-blue-700 border-blue-200",
  "In transit": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Out for delivery": "bg-violet-100 text-violet-800 border-violet-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Delayed": "bg-amber-100 text-amber-800 border-amber-200",
  "Failed delivery": "bg-red-100 text-red-800 border-red-200",
  "Cancelled": "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <Badge variant="outline" className={`font-medium ${colorClass} ${className}`}>
      {status}
    </Badge>
  );
}
