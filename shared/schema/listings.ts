import { pgTable, uuid, varchar, text, boolean, integer, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { listingKindEnum, platformKindEnum } from "./enums";
import { users } from "./users";

const tsvector = customType<{ data: string; notNull: false; default: false }>({ dataType: () => "tsvector" });

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id").references(() => users.id, { onDelete: "set null" }),

    kind: listingKindEnum("kind").notNull(),
    platform: platformKindEnum("platform").notNull().default("telegram"),

    username: varchar("username", { length: 64 }),
    title: varchar("title", { length: 200 }),
    description: text("description"),

    price: numeric("price", { precision: 18, scale: 8 }).notNull().default("0"),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    channelMode: varchar("channel_mode", { length: 32 }),
    subscribersCount: integer("subscribers_count"),
    followersCount: integer("followers_count"),
    giftsCount: integer("gifts_count"),
    giftKind: varchar("gift_kind", { length: 64 }),

    tgUserType: varchar("tg_user_type", { length: 64 }),
    accountCreatedAt: varchar("account_created_at", { length: 7 }),

    serviceType: varchar("service_type", { length: 64 }),
    target: varchar("target", { length: 32 }),
    serviceCount: integer("service_count"),

    isActive: boolean("is_active").notNull().default(true),
    removedByAdmin: boolean("removed_by_admin").notNull().default(false),
    removedReason: text("removed_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    searchVector: tsvector("search_vector"),
  },
  (t) => ({
    listingsSellerIdx: index("idx_listings_seller").on(t.sellerId),
    listingsPlatCreateIdx: index("idx_listings_platform_created").on(t.platform, t.createdAt),
    listingsActiveIdx: index("idx_listings_active").on(t.isActive),
    listingsPlatKindActiveIdx: index("idx_listings_platform_kind_active").on(t.platform, t.kind, t.isActive),
  })
);

// DDL helper (نفّذه بهجرة/سكربت DB)
export const ddlListingsTsvector = sql`
CREATE OR REPLACE FUNCTION listings_tsvector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english',
      coalesce(NEW.username,'') || ' ' ||
      coalesce(NEW.title,'')    || ' ' ||
      coalesce(NEW.description,'')
    );
  RETURN NEW;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_listings_tsv_update') THEN
    CREATE TRIGGER trg_listings_tsv_update
    BEFORE INSERT OR UPDATE OF username, title, description
    ON listings
    FOR EACH ROW EXECUTE FUNCTION listings_tsvector_update();
  END IF;
END$$;
`;