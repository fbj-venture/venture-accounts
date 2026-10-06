import { text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * Audit trail columns - spread into a table: `...auditColumns`.
 *
 * Who created a row and who last changed it, and when. The names are explicit
 * so the columns are the same under both pgTable and snakeCase.table.
 *
 * updatedAt is stamped by Drizzle on every update (see $onUpdate), but
 * Drizzle has no idea who the current user is, so createdBy and updatedBy
 * must be passed in by the caller - use withCreate / withUpdate below, which
 * make leaving them out a compile error on insert.
 *
 * This only records who last touched a row, not what changed. It is not a
 * full audit log: the previous values are overwritten.
 */
export const auditColumns = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => user.id),
};

/** Values for an insert, stamped with the user creating the row(s). */
// The array overload must come first: an array is also an `object`, so it
// would otherwise match the single-row overload.
export function withCreate<T extends object>(
  userId: string,
  values: readonly T[],
): (T & { createdBy: string; updatedBy: string })[];
export function withCreate<T extends object>(
  userId: string,
  values: T,
): T & { createdBy: string; updatedBy: string };
export function withCreate<T extends object>(userId: string, values: T | readonly T[]) {
  const stamp = { createdBy: userId, updatedBy: userId };
  return Array.isArray(values)
    ? values.map((row) => ({ ...row, ...stamp }))
    : { ...(values as T), ...stamp };
}

/** Values for an update's .set(), stamped with the user changing the row(s). */
export function withUpdate<T extends object>(userId: string, values: T): T & { updatedBy: string } {
  return { ...values, updatedBy: userId };
}
