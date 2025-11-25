import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  discordChannelId: text("discord_channel_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  readOnly: boolean("read_only").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;
