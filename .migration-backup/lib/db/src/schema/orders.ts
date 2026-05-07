import { pgTable, text, timestamp, foreignKey } from "drizzle-orm/pg-core";
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

export const ordersTable = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessesTable.id),
    customerId: text("customer_id").notNull(),
    trackingId: text("tracking_id").notNull().unique(),
    orderReference: text("order_reference"),
    description: text("description"),
    currentStatus: text("current_status").notNull().default("Order received"),
    estimatedDeliveryDate: text("estimated_delivery_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    // Composite FK: an order's customer MUST belong to the same business as
    // the order. This is the database-level guarantee against cross-tenant
    // row linkage; application checks are defense-in-depth on top of it.
    customerBusinessFk: foreignKey({
      columns: [t.customerId, t.businessId],
      foreignColumns: [customersTable.id, customersTable.businessId],
      name: "orders_customer_business_fk",
    }),
  }),
);

export const insertOrderSchema = createInsertSchema(ordersTable);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
