import { useSetBreadcrumbs } from "#/routes/books/-breadcrumbs.ts";
import { createFileRoute, notFound } from '@tanstack/react-router';
import { endOfDay, isWithinInterval, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { getBankAccountById } from "../-bank-accounts.ts";
import { TableFilterBar } from "#/components/table-filter-bar.tsx";
import { parseAmountFilter } from "#/lib/amount-filter.ts";
import { TransactionsTable } from "./-components/transactions-table.tsx";
import { getUnPostedAccountTransactions } from "./-transactions.ts";

export const Route = createFileRoute('/books/banking/transactions/$id')({
  beforeLoad: async ({ params }) => {
    const bankAccount = await getBankAccountById({ data: params.id });
    if (!bankAccount) {
      throw notFound();
    }
    return { bankAccount };
  },
  loader: async ({ context }) => {
    const transactions = await getUnPostedAccountTransactions({ data: context.bankAccount.id });
    return { transactions };
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { bankAccount } = Route.useRouteContext();
  const { transactions } = Route.useLoaderData();
  useSetBreadcrumbs([
    { title: "Transactions", url: "/books/banking/transactions" },
    { title: bankAccount.name },
  ]);

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [amountFilter, setAmountFilter] = useState("");

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const transactionYears = transactions.map((transaction) => transaction.date.getFullYear());
    const minYear = Math.min(currentYear, ...transactionYears);
    const maxYear = Math.max(currentYear, ...transactionYears);
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const interval = range?.from
      ? { start: startOfDay(range.from), end: endOfDay(range.to ?? range.from) }
      : null;
    const description = descriptionFilter.trim().toLowerCase();
    const amountPredicate = parseAmountFilter(amountFilter);

    return transactions.filter((transaction) => {
      if (interval && !isWithinInterval(transaction.date, interval)) {
        return false;
      }
      if (
        description &&
        !(transaction.description ?? transaction.note).toLowerCase().includes(description)
      ) {
        return false;
      }
      if (amountPredicate && !amountPredicate(transaction.amount)) {
        return false;
      }
      return true;
    });
  }, [transactions, range, descriptionFilter, amountFilter]);

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
        <TransactionsTable data={filteredTransactions} />
      </div>
    </>
  );
}
