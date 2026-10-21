import { TableFilterBar } from "#/components/table-filter-bar.tsx"
import { parseAmountFilter } from "#/lib/amount-filter.ts"
import { currentYear, dayKey } from "#/lib/dates.ts"
import { useStartingYear } from "#/lib/starting-year.ts"
import { yearsFromStart } from "#/lib/years.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router"
import { format } from "date-fns"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { loadBankAccount } from "../-server/bank-accounts-cache.ts"
import { TransactionsTable } from "./-lib/transactions-table.tsx"
import { getUnPostedAccountTransactions } from "./-server/transactions.server.ts"

export const Route = createFileRoute("/books/banking/transactions/$id")({
  beforeLoad: async ({ params }) => {
    const bankAccount = await loadBankAccount(params.id)
    if (!bankAccount) {
      throw notFound()
    }
    return { bankAccount }
  },
  loader: async ({ context }) => ({
    transactions: await getUnPostedAccountTransactions({ data: context.bankAccount.id }),
  }),
  component: RouteComponent,
})

// Loaded once by the parent layout route - see ./route.tsx.
const transactionsLayout = getRouteApi("/books/banking/transactions")

function RouteComponent() {
  const { bankAccount } = Route.useRouteContext()
  const { transactions } = Route.useLoaderData()
  const { accountOptions: allAccountOptions } = transactionsLayout.useLoaderData()
  // A transaction can't be a transfer from this bank account to itself.
  const accountOptions = useMemo(
    () => ({
      ...allAccountOptions,
      banks: allAccountOptions.banks.filter((bank) => bank.id !== bankAccount.id),
    }),
    [allAccountOptions, bankAccount.id],
  )
  useSetBreadcrumbs([
    { title: "Bank Accounts", url: "/books/banking/transactions" },
    { title: `Un-posted transactions for ${bankAccount.name}` },
  ])

  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [descriptionFilter, setDescriptionFilter] = useState("")
  const [amountFilter, setAmountFilter] = useState("")

  const startingYear = useStartingYear()
  const years = useMemo(() => {
    const thisYear = currentYear()
    const transactionYears = transactions.map((transaction) =>
      Number(dayKey(transaction.date).slice(0, 4)),
    )
    return yearsFromStart(startingYear, Math.max(thisYear, ...transactionYears))
  }, [transactions, startingYear])

  const filteredTransactions = useMemo(() => {
    // Compared as calendar days: the picker's days are the user's local
    // ones, a transaction's is its South African day.
    const interval = range?.from
      ? {
          from: format(range.from, "yyyy-MM-dd"),
          to: format(range.to ?? range.from, "yyyy-MM-dd"),
        }
      : null
    const description = descriptionFilter.trim().toLowerCase()
    const amountPredicate = parseAmountFilter(amountFilter)

    return transactions.filter((transaction) => {
      if (interval) {
        const day = dayKey(transaction.date)
        if (day < interval.from || day > interval.to) {
          return false
        }
      }
      if (
        description &&
        !`${transaction.note} ${transaction.description ?? ""}`.toLowerCase().includes(description)
      ) {
        return false
      }
      if (amountPredicate && !amountPredicate(transaction.amount)) {
        return false
      }
      return true
    })
  }, [transactions, range, descriptionFilter, amountFilter])

  return (
    <>
      <h2>{bankAccount.name}</h2>
      <div className="mt-4">
        <TableFilterBar
          descriptionFilter={descriptionFilter}
          onDescriptionFilterChange={setDescriptionFilter}
          amountFilter={amountFilter}
          onAmountFilterChange={setAmountFilter}
          range={range}
          onRangeChange={setRange}
          years={years}
        />
      </div>
      <div className="mt-4">
        <TransactionsTable
          data={filteredTransactions}
          accountOptions={accountOptions}
          // New filters mean a new result set - start again from page 1.
          pageResetKey={JSON.stringify([range?.from, range?.to, descriptionFilter, amountFilter])}
        />
      </div>
    </>
  )
}
