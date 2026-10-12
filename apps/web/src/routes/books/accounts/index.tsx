import { MultiSelect } from '#/components/multi-select.tsx';
import { Field, FieldLabel } from '#/components/ui/field.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-lib/breadcrumbs';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { AccountsTable } from './-lib/accounts-table.tsx';
import { accountsQuery, accountTypesQuery } from './-lib/accounts-queries.ts';

export const Route = createFileRoute('/books/accounts/')({
  // Rendered in the browser only: the loader fills the query cache (instantly
  // when it is still fresh) and the page reads it with useSuspenseQuery.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(accountsQuery),
      queryClient.ensureQueryData(accountTypesQuery),
    ]);
  },
  pendingComponent: () => <p className="py-2 text-sm text-muted-foreground">Loading accounts...</p>,
  component: RouteComponent,
});

// The Account Types the list starts out showing.
const DEFAULT_TYPES = ['Expense', 'Income'];

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard', url: '/books' }, { title: 'Accounts' }]);
  const { data: accounts } = useSuspenseQuery(accountsQuery);
  const { data: accountTypes } = useSuspenseQuery(accountTypesQuery);

  // Ticked Account Type ids; none ticked shows every type, as with the
  // other filters.
  const [typeIds, setTypeIds] = useState<number[]>(() =>
    accountTypes.filter((type) => DEFAULT_TYPES.includes(type.name)).map((type) => type.id),
  );
  const typeChoices = useMemo(
    () => accountTypes.map((type) => ({ value: type.id, label: type.name })),
    [accountTypes],
  );
  const shown = useMemo(
    () => (typeIds.length ? accounts.filter((row) => typeIds.includes(row.accountTypeId)) : accounts),
    [accounts, typeIds],
  );

  return (
    <>
      <h2 className="pb-2">Accounts</h2>
      <div className="mt-2 max-w-xs">
        <Field>
          <FieldLabel htmlFor="accounts-types">Account types</FieldLabel>
          <MultiSelect
            id="accounts-types"
            options={typeChoices}
            value={typeIds}
            onValueChange={setTypeIds}
            placeholder="All account types"
          />
        </Field>
      </div>
      <p className="py-2 text-sm text-muted-foreground">
        {shown.length === 1 ? '1 account.' : `${shown.length} accounts.`}
      </p>
      <div className="mt-2">
        <AccountsTable data={shown} />
      </div>
    </>
  );
}
