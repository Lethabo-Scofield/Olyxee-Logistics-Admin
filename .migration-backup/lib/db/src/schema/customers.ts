import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const customersTable = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessesTable.id),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    companyName: text("company_name"),
    address: text("address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Composite unique on (id, business_id) so a child table (orders) can
    // declare a composite foreign key that physically prevents linking a
    // customer to an order belonging to a different tenant.
    idBusinessUnique: unique("customers_id_business_id_key").on(t.id, t.businessId),
  }),
);

export const insertCustomerSchema = createInsertSchema(customersTable);
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
