import type { Transaction } from "@app/models";

// Transaction.date is a native Date, which implements toJSON(), so
// JSON.stringify() serializes it to its ISO string (e.g.
// "2024-02-14T00:00:00.000Z") without any extra handling here.
export function toJson(transactions: Transaction[]): string {
  return `${JSON.stringify(transactions, null, 2)}\n`;
}
