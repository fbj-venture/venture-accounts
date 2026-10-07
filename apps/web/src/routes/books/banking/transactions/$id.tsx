import { TableFilterBar } from "#/components/table-filter-bar.tsx";
import { parseAmountFilter } from "#/lib/amount-filter.ts";
import { formatZar } from "#/lib/currency.ts";
import { useSetBreadcrumbs } from "#/routes/books/-components/breadcrumbs.ts";
import { createFileRoute, getRouteApi, notFound, useRouter } from '@tanstack/react-router';
import { endOfDay, isWithinInterval, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { loadBankAccount } from "../-components/bank-accounts-cache.ts";
import { getOpeningBalance } from "../-components/bank-accounts-fn.ts";
import { OpeningBalanceDialog } from "./-components/opening-balance-dialog.tsx";
import { getUnPostedAccountTransactions } from "./-components/transactions-fn.ts";
import { TransactionsTable } from "./-components/transactions-table.tsx";

export const Route = createFileRoute('/books/banking/transactions/$id')({
  beforeLoad: async ({ params }) => {
    const bankAccount = await loadBankAccount(params.id);
    if (!bankAccount) {
      throw notFound();
    }
    const openingBalance = await getOpeningBalance({ data: bankAccount.id });
    return { bankAccount, openingBalance };
  },
  loader: async ({ context }) => {
    const transactions = await getUnPostedAccountTransactions({ data: context.bankAccount.id });
    return { transactions };
  },
  component: RouteComponent,
});

// Loaded once by the parent layout route - see ./route.tsx.
const transactionsLayout = getRouteApi('/books/banking/transactions');

function RouteComponent() {
  const router = useRouter();
  const { bankAccount, openingBalance } = Route.useRouteContext();
  const { transactions } = Route.useLoaderData();
  const { accountOptions: allAccountOptions } = transactionsLayout.useLoaderData();
  // A transaction can't be a transfer from this bank account to itself.
  const accountOptions = useMemo(
    () => ({
      ...allAccountOptions,
      banks: allAccountOptions.banks.filter((bank) => bank.id !== bankAccount.id),
    }),
    [allAccountOptions, bankAccount.id],
  );
  useSetBreadcrumbs([
    { title: "Bank Accounts", url: "/books/banking/transactions" },
    { title: `Un-posted transactions for ${bankAccount.name}` },
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

  const openingBallance =
    openingBalance === null ? (
      <OpeningBalanceDialog
        accountId={bankAccount.id}
        onSaved={() =>
          router.invalidate({
            filter: (match) => match.routeId === "/books/banking/transactions/$id",
            sync: true,
          })
        }
      />
    ) : (
      <span>Opening ballance: {formatZar(openingBalance)}</span>
    );

  return (
    <>
      <div className="flex items-center justify-between">
        <h2>{bankAccount.name}</h2>
        <div>
          {openingBallance}
        </div>
      </div>
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
  );
}
