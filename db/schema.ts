import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const railObservations = sqliteTable(
  'rail_observations',
  {
    key: text('key').primaryKey(),
    line: text('line').notNull(),
    payload: text('payload').notNull(),
    polledAt: integer('polled_at').notNull().default(0),
    expiresAt: integer('expires_at').notNull().default(0),
    sourceTime: integer('source_time').notNull().default(0),
  },
  (t) => [index('rail_observations_line_time').on(t.line, t.polledAt)],
);
export const railTripCache = sqliteTable('rail_trip_cache', {
  line: text('line').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at').notNull().default(0),
});
