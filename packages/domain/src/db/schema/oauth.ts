import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { users } from "./identity";

// Backing tables for the better-auth `mcp` plugin, which turns the app into
// an OAuth 2.1 authorization server for MCP clients (dynamic client
// registration, PKCE, consent). Field property names must match the plugin's
// model fields; SQL names follow the repo's snake_case convention.

export const oauthApplications = pgTable(
  "oauth_applications",
  {
    id: id(),
    name: text("name").notNull(),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls").notNull(),
    type: text("type").notNull(),
    disabled: boolean("disabled").notNull().default(false),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("oauth_applications_user_id_idx").on(table.userId)],
);

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: id(),
    accessToken: text("access_token").notNull().unique(),
    refreshToken: text("refresh_token").notNull().unique(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }).notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplications.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    ...timestamps,
  },
  (table) => [
    index("oauth_access_tokens_client_id_idx").on(table.clientId),
    index("oauth_access_tokens_user_id_idx").on(table.userId),
  ],
);

export const oauthConsents = pgTable(
  "oauth_consents",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplications.clientId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    consentGiven: boolean("consent_given").notNull(),
    ...timestamps,
  },
  (table) => [
    index("oauth_consents_client_id_idx").on(table.clientId),
    index("oauth_consents_user_id_idx").on(table.userId),
  ],
);
