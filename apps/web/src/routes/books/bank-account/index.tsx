import { Checkbox } from '#/components/ui/checkbox.tsx';
import { Field, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-lib/breadcrumbs.ts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { bankAccountsQuery } from './-lib/bank-accounts-queries.ts';
import { BankAccountsTable } from './-lib/bank-accounts-table.tsx';

export const Route = createFileRoute('/books/bank-account/')({
  // Rendered in the browser only: the loader fills the query cache (instantly
  // when it is still fresh) and the page reads it with useSuspenseQuery.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(bankAccountsQuery);
  },
  pendingComponent: () => (
    <p className="py-2 text-sm text-muted-foreground">Loading bank accounts...</p>
  ),
  component: RouteComponent,
});

// The archived filter is a tri-state checkbox: indeterminate shows every bank
// account, ticked only the archived ones, unticked only the active ones.
type ArchivedFilter = 'all' | 'archived' | 'unarchived';

const NEXT_FILTER: Record<ArchivedFilter, ArchivedFilter> = {
  all: 'archived',
  archived: 'unarchived',
  unarchived: 'all',
};

const FILTER_CHECKED = {
  all: 'indeterminate',
  archived: true,
  unarchived: false,
} as const;

const FILTER_LABEL: Record<ArchivedFilter, string> = {
  all: 'Show archived: all',
  archived: 'Show archived: archived only',
  unarchived: 'Show archived: only unarchived',
};

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard', url: '/books' }, { title: 'Bank accounts' }]);
  const { data: bankAccounts } = useSuspenseQuery(bankAccountsQuery);
  const [filter, setFilter] = useState<ArchivedFilter>('all');
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return bankAccounts.filter(
      (row) =>
        (filter === 'all' || row.isArchived === (filter === 'archived')) &&
        (needle === '' ||
          [row.bankName, row.accountNumber, row.description].some((text) =>
            text.toLowerCase().includes(needle),
          )),
    );
  }, [bankAccounts, filter, search]);

  return (
    <>
      <h2 className="pb-2">Bank accounts</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Input
          type="search"
          aria-label="Search bank accounts"
          placeholder="Search bank, account number or description..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-[320px]"
        />
        <Field orientation="horizontal" className="w-fit">
          <Checkbox
            id="bank-accounts-archived"
            checked={FILTER_CHECKED[filter]}
            onCheckedChange={() => setFilter(NEXT_FILTER[filter])}
          />
          <FieldLabel htmlFor="bank-accounts-archived">{FILTER_LABEL[filter]}</FieldLabel>
        </Field>
      </div>
      <p className="py-2 text-sm text-muted-foreground">
        {shown.length === 1 ? '1 bank account.' : `${shown.length} bank accounts.`}
      </p>
      <div className="mt-2">
        <BankAccountsTable data={shown} />
      </div>
    </>
  );
}
