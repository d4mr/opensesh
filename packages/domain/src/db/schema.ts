import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  timezone: text("timezone").notNull(),
});
