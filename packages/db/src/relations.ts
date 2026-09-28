import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.js";

// Drizzle v1 relations (Relational Queries v2), used by `db.query.*`. One
// definition for the whole schema, passed to drizzle({ relations }) in both
// clients (./index.ts and ./direct.ts). These only describe how tables join
// for relational queries - the actual foreign keys live on the tables.
//
// A `many` side with no from/to is inferred from the matching `one` on the
// other table; they're spelled out only where inference can't work (the
// 1:1 bankAccount link and the account parent/child self-reference).
export const relations = defineRelations(schema, (r) => ({
  accountType: {
    accounts: r.many.account(),
  },

  account: {
    accountType: r.one.accountType({
      from: r.account.account_type,
      to: r.accountType.id,
      optional: false,
    }),
    // Sub-accounts (docs/Ledger Ubiquitous Language.md), e.g.
    // "Charitable giving > Apostolic gifts". The alias pairs the two sides
    // of the self-reference.
    parent: r.one.account({
      from: r.account.parentId,
      to: r.account.id,
      alias: "account_parent",
    }),
    children: r.many.account({
      from: r.account.id,
      to: r.account.parentId,
      alias: "account_parent",
    }),
    // Only set for accounts that are real bank accounts (the "Banks" tab).
    bankAccount: r.one.bankAccount({
      from: r.account.id,
      to: r.bankAccount.id,
    }),
    journalLines: r.many.journalLine(),
  },

  bankAccount: {
    account: r.one.account({
      from: r.bankAccount.id,
      to: r.account.id,
      optional: false,
    }),
  },

  journal: {
    lines: r.many.journalLine(),
  },

  journalLine: {
    journal: r.one.journal({
      from: r.journalLine.journalEntryId,
      to: r.journal.id,
      optional: false,
    }),
    account: r.one.account({
      from: r.journalLine.accountId,
      to: r.account.id,
      optional: false,
    }),
  },

  // better-auth tables (auth schema).
  user: {
    sessions: r.many.session(),
    accounts: r.many.authAccount(),
  },

  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  authAccount: {
    user: r.one.user({
      from: r.authAccount.userId,
      to: r.user.id,
      optional: false,
    }),
  },
}));
