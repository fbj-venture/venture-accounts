// How the Trial Balance totals, shared by the page and the Excel export so the
// two can't disagree. No server-only imports: the browser uses it too.

// A debit balance (positive) goes in the Debit column, a credit balance
// (negative) in the Credit column. Summed in cents so the totals don't pick up
// floating point dust.
export function totalRows(rows: { balance: number }[]) {
  let debitCents = 0
  let creditCents = 0
  for (const row of rows) {
    const cents = Math.round(row.balance * 100)
    if (cents > 0) debitCents += cents
    else creditCents -= cents
  }
  return { debits: debitCents / 100, credits: creditCents / 100 }
}
