# Ledger Ubiquitous Language

2026-09-22 · @Someone

## Purpose

Across this project we have been discussing the same handful of concepts from three different angles: the accounting theory, the database schema, and eventually a UI. It is easy for the same idea to pick up three different names depending on which angle you are looking from, and for that drift to quietly become bugs or confused conversations later.

This document is the single source of truth for what each core term means, and what it is called in each of those three contexts. When extending the schema or building the UI, use the terms below.

## Core entity glossary

| Theory term | Database representation | UI label (proposed) | Notes |
| --- | --- | --- | --- |
| Ledger account | Row in `accounts` | "Category" (for income/expense) or "Account" (for bank/asset) | See Account vs. bank account below |
| Account type | `account_types.code`, referenced by `accounts.type` | Not usually shown directly; drives grouping in reports | Asset, Liability, Equity, Income, Expense |
| Transaction | A `journal_entries` row plus its `journal_lines` | "Transaction" | One real-world event; may span several lines |
| Journal entry | Row in `journal_entries` | Same as Transaction in UI | The envelope; date + description |
| Journal line / posting | Row in `journal_lines` | Not shown as a separate concept | One account + signed amount within an entry |
| Debit | Positive `amount` value | Implicit; shown as money in/out depending on account type | Never shown as the word "debit" to the user |
| Credit | Negative `amount` value | Implicit | Never shown as the word "credit" to the user |
| Balance | `SUM(amount)` for an account | "Balance" | Shown per account and for the whole ledger (should always be 0) |
| Sub-account | `accounts.parent_id` self-reference (deferred) | Nested category, e.g. "Groceries › Household" | Not yet built |
| Opening balance | Equity-type row in `accounts` named "Opening Balance" | "Starting balance" | Absorbs the other side of take-on entries |
| Bank account details | Row in `bank_account_details`, 1:1 with an `accounts` row | Account settings / "linked bank account" | Kept separate from ledger `accounts` on purpose |

## Term-by-term notes

**"Account" is overloaded — resolve it by context.** In ledger/theory language, an account is any bucket lines get posted to (Bank, Groceries, Salary Income). In everyday and banking language, a "bank account" is a real external thing with an institution and account number. The database keeps these separate: `accounts` holds the first kind, `bank_account_details` holds the second, 1:1 linked by `account_id`. The UI should follow this split too, e.g. labelling ledger buckets "Categories" and reserving "Account" for the linked real-world bank account, to avoid the same collision in front of the user.

**Debit and credit are never shown to the user as words.** They are stored as sign (`amount` positive = debit, negative = credit), but the UI should translate this into plain language relative to what the account represents: money in vs. money out for Bank, amount spent for an Expense category, amount earned for an Income category. Whether a debit "increases" or "decreases" an account depends on `normal_balance`, so the UI must always join through `account_types` rather than hardcoding sign-to-meaning per account.

**A "transaction" and a "journal entry" are the same thing, referred to differently by audience.** Users and the UI say "transaction." The database and theory conversation says "journal entry" (the envelope) and "journal line" (each posting inside it). Never introduce a third term for either.

**Balancing has two distinct meanings and both matter.** (1) Internal balancing: every journal entry's lines sum to zero — a database-enforced invariant, checked at write time. (2) Reconciliation: the ledger's Bank account balance matches the actual bank statement — an external check, done periodically, not enforced by the schema. It is tracked per journal line (`journal_line.is_reconciled`), not per entry, because one entry can hold lines for two bank accounts (a matched transfer) and each bank's statement is reconciled separately. Keep these named differently in the UI ("balanced" vs. "reconciled") so users don't conflate a data-integrity guarantee with a real-world check.

## Open decisions / deferred concepts

These have a settled theory meaning but no database or UI representation yet. Listed so a future addition uses the same name across all three layers rather than inventing a new one on the spot.

- **Sub-accounts** — theory: a category nested under a parent (e.g. Groceries › Household). DB: `accounts.parent_id` self-reference, deferred until a real category needs splitting. UI: nested/indented category, not yet designed.
- **Contra-accounts** — theory: an account whose normal balance is deliberately opposite its type (e.g. Accumulated Depreciation). Not needed for a bank-transaction ledger; no DB or UI representation planned.
- **Transfers** — theory: not a new account type, just an ordinary entry between two asset accounts (e.g. Bank → Savings). Deliberately has no special DB table or UI category beyond a normal transaction with two asset-type accounts on either side. **Transfer matching:** each bank's statement imports its own side of a transfer as a separate one-line entry. Choosing a bank account (the "Banks" tab) for a transaction finds the other bank's line — opposite amount, same date, not yet categorised or posted — and moves it into this entry, deleting the other bank's now-empty entry. No match is an error, never a newly created line, since that would be duplicated when the other bank's statement is imported.
- **Account subtype** (Current vs. Fixed Asset, etc.) — theory: a reporting refinement within one of the five root types. Not yet decided whether this becomes a `subtype` column on `account_types` or stays a presentation-only grouping.
