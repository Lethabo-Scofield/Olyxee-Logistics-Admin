import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  authUserId: text("auth_user_id").unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["owner", "admin", "staff"] })
    .notNull()
    .default("staff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
