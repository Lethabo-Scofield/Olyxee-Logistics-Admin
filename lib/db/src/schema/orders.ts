import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { customersTable } from "./customers";

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

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  customerId: text("customer_id")
    .notNull()
    .references(() => customersTable.id),
  trackingId: text("tracking_id").notNull().unique(),
  orderReference: text("order_reference"),
  description: text("description"),
  currentStatus: text("current_status").notNull().default("Order received"),
  estimatedDeliveryDate: text("estimated_delivery_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
