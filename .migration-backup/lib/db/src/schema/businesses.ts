import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = pgTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  websiteUrl: text("website_url").notNull(),
  supportEmail: text("support_email").notNull(),
  industry: text("industry"),
  employeeCount: text("employee_count"),
  location: text("location"),
  phone: text("phone"),
  // Customer email customization. All nullable; the email template applies
  // sensible defaults when these are blank so existing businesses keep
  // working unchanged.
  //   emailGreeting    — opening line, supports {name} placeholder.
  //   emailSignature   — sign-off block; multi-line, supports {businessName}.
  //   emailFooterNote  — free text shown above the support email in footer.
  emailGreeting: text("email_greeting"),
  emailSignature: text("email_signature"),
  emailFooterNote: text("email_footer_note"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable);
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
