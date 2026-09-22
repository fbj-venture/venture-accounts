# venture-accounts

Church bank account management: importing bank statement PDFs into structured transaction records for financial reporting.

## Language

**Bank Statement**:
The source PDF exported by the bank for one account and one date range, containing the transactions to import.

**Import Row**:
A single row parsed directly off a Bank Statement, before financial typing or normalization — all fields are raw strings, plus a row index and a hash fingerprint used to detect re-imports of the same row.
_Avoid_: Row, Raw Transaction

**Transaction**:
A normalized financial record derived from an Import Row — a signed `amount` (positive for a credit, negative for a debit) instead of separate debit/credit columns, and real number/date types instead of strings.
_Avoid_: Entry, Line Item

**Statement Date**:
The date printed in a Bank Statement's first-page header (`dd MMMM yyyy`). Used to resolve the year for each Transaction's date, since transaction rows only carry a day and month.

**Service Fee**:
An optional bank-charged fee on a Transaction, separate from its debit/credit amount.

**Account Type**:
The canonical classification of an Account: Asset, Liability, Equity, Income, or Expense.

**Account**:
A category that money comes from or goes to (e.g. Salaries, Woolworths, a bank account itself). Classified by exactly one Account Type.
_Avoid_: Category, Ledger Account
