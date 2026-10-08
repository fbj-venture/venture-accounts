import { MultiSelect } from '#/components/multi-select.tsx';
import { AmountFilterInput } from '#/components/amount-filter-input.tsx';
import { TableDateRange } from '#/components/table-date-range.tsx';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { Checkbox } from '#/components/ui/checkbox.tsx';
import { Field, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute } from '@tanstack/react-router';
import { SearchIcon, XIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { loadBankAccounts } from '../-components/bank-accounts-cache.ts';
import { isValidAmountFilter } from '#/lib/amount-filter.ts';
import {
  getIsAdmin,
  searchTransactions,
  type SearchCriteria,
  type SearchResult,
} from './-components/search-fn.ts';
import { SearchResultsTable } from './-components/search-results-table.tsx';
import { getAccountOptions } from '../transactions/-components/account-options-fn.ts';

export const Route = createFileRoute('/books/banking/search/')({
  // A bank account to start with, e.g. from the dashboard's Actions menu.
  validateSearch: (search: Record<string, unknown>): { bankAccountId?: number } => {
    const bankAccountId = Number(search.bankAccountId);
    return Number.isInteger(bankAccountId) && bankAccountId > 0 ? { bankAccountId } : {};
  },
  loader: async () => {
    const [bankAccounts, accountOptions, isAdmin] = await Promise.all([
      loadBankAccounts(),
      getAccountOptions(),
      getIsAdmin(),
    ]);
    return { bankAccounts, accountOptions, isAdmin };
  },
  component: RouteComponent,
});

// Every criterion is optional; an empty one doesn't restrict the search.
type Criteria = {
  bankAccountIds: number[];
  range: DateRange | undefined;
  /** The amount expression, as on the transactions page (e.g. ">100 & <500"). */
  amount: string;
  /** Text to find anywhere in the transaction's note or description (any case). */
  description: string;
  /** null: either way; true: only posted; false: only unposted. */
  posted: boolean | null;
  reconciled: boolean | null;
  accountIds: number[];
};

type Outcome =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; results: SearchResult[]; amount: string };

const NO_CRITERIA: Criteria = {
  bankAccountIds: [],
  range: undefined,
  amount: '',
  description: '',
  posted: null,
  reconciled: null,
  accountIds: [],
};

// The years the date range's quick-select offers: this one and the ten before.
const YEARS = Array.from({ length: 11 }, (_, index) => new Date().getFullYear() - index);

// Clicking cycles: either (dash) -> yes (tick) -> no (empty) -> either.
function TriStateCheckbox({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean | null;
  onValueChange: (value: boolean | null) => void;
}) {
  const id = `search-${label.toLowerCase()}`;
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={value === null ? 'indeterminate' : value}
        onCheckedChange={() => onValueChange(value === null ? true : value ? false : null)}
      />
      <label htmlFor={id} className="text-sm">
        {label}
        <span className="pl-1 text-muted-foreground">
          ({value === null ? 'either' : value ? 'yes' : 'no'})
        </span>
      </label>
    </div>
  );
}

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard', url: '/books' }, { title: 'Find transactions' }]);
  const { bankAccounts, accountOptions, isAdmin } = Route.useLoaderData();
  const { bankAccountId } = Route.useSearch();

  const [criteria, setCriteria] = useState<Criteria>(() => ({
    ...NO_CRITERIA,
    bankAccountIds:
      bankAccountId !== undefined && bankAccounts.some((account) => account.id === bankAccountId)
        ? [bankAccountId]
        : [],
  }));
  // The latest search: its results, plus the amount expression it was run
  // with (applied to them in the results table).
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const searchCount = useRef(0);
  // The criteria the latest search was run with, so refreshSearch repeats
  // that search even if the form has been edited since.
  const lastSearch = useRef<SearchCriteria | null>(null);

  async function runSearch() {
    const searchId = ++searchCount.current;
    const { range, amount } = criteria;
    setOutcome({ status: 'loading' });
    try {
      const data: SearchCriteria = {
        bankAccountIds: criteria.bankAccountIds,
        accountIds: criteria.accountIds,
        description: criteria.description,
        from: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
        to: range?.from ? format(range.to ?? range.from, 'yyyy-MM-dd') : null,
        posted: criteria.posted,
        reconciled: criteria.reconciled,
      };
      lastSearch.current = data;
      const results = await searchTransactions({ data });
      if (searchId === searchCount.current) {
        setOutcome({ status: 'done', results, amount });
      }
    } catch (caught) {
      if (searchId === searchCount.current) {
        setOutcome({
          status: 'error',
          message: caught instanceof Error ? caught.message : "Couldn't run the search.",
        });
      }
    }
  }

  // Repeats the latest search without the "Searching..." state, so the table
  // (and its sort and page) stays put while an administrator's change shows.
  async function refreshSearch() {
    const data = lastSearch.current;
    if (!data) {
      return;
    }
    const searchId = ++searchCount.current;
    try {
      const results = await searchTransactions({ data });
      setOutcome((previous) =>
        searchId === searchCount.current && previous?.status === 'done'
          ? { ...previous, results }
          : previous,
      );
    } catch {
      // The old results stay; the next Search will show any error.
    }
  }

  const bankAccountChoices = useMemo(
    () =>
      bankAccounts.map((bankAccount) => ({
        value: bankAccount.id,
        label: `${bankAccount.name} (${bankAccount.accountNumber})`,
      })),
    [bankAccounts],
  );
  const accountChoices = useMemo(
    () =>
      accountOptions.categories.map((option) => ({
        value: option.id,
        label: option.parentName ? `${option.parentName} › ${option.name}` : option.name,
      })),
    [accountOptions],
  );

  // A half-typed amount expression would silently search without it.
  const canSearch = criteria.amount.trim() === '' || isValidAmountFilter(criteria.amount);
  const update = (changes: Partial<Criteria>) => setCriteria((previous) => ({ ...previous, ...changes }));

  return (
    <>
      <h2 className="pb-2">Find transactions</h2>
      <Card className="mt-4 max-w-3xl">
        <CardHeader>
          <CardTitle>Search criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSearch) {
                runSearch();
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="search-bank-accounts">Bank accounts</FieldLabel>
                <MultiSelect
                  id="search-bank-accounts"
                  options={bankAccountChoices}
                  value={criteria.bankAccountIds}
                  onValueChange={(bankAccountIds) => update({ bankAccountIds })}
                  placeholder="All bank accounts"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="search-accounts">Accounts</FieldLabel>
                <MultiSelect
                  id="search-accounts"
                  options={accountChoices}
                  value={criteria.accountIds}
                  onValueChange={(accountIds) => update({ accountIds })}
                  placeholder="All accounts"
                />
              </Field>
              <Field>
                <FieldLabel>Date range</FieldLabel>
                <div>
                  <TableDateRange
                    range={criteria.range}
                    onRangeChange={(range) => update({ range })}
                    years={YEARS}
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="search-amount">Amount</FieldLabel>
                <AmountFilterInput
                  id="search-amount"
                  value={criteria.amount}
                  onValueChange={(amount) => update({ amount })}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="search-description">Description</FieldLabel>
              <Input
                id="search-description"
                value={criteria.description}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="Contains... (any case)"
              />
            </Field>
            <div className="flex flex-wrap gap-6">
              <TriStateCheckbox
                label="Posted"
                value={criteria.posted}
                onValueChange={(posted) => update({ posted })}
              />
              <TriStateCheckbox
                label="Reconciled"
                value={criteria.reconciled}
                onValueChange={(reconciled) => update({ reconciled })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!canSearch}>
                <SearchIcon />
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCriteria(NO_CRITERIA);
                  searchCount.current++;
                  setOutcome(null);
                }}
              >
                <XIcon />
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="mt-6">
        {outcome === null ? (
          <p className="text-sm text-muted-foreground">Enter any criteria and press Search.</p>
        ) : outcome.status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Searching...</p>
        ) : outcome.status === 'error' ? (
          <p className="text-sm text-destructive" role="alert">
            {outcome.message}
          </p>
        ) : (
          <SearchResultsTable
            results={outcome.results}
            amountFilter={outcome.amount}
            isAdmin={isAdmin}
            onChanged={refreshSearch}
          />
        )}
      </div>
    </>
  );
}
