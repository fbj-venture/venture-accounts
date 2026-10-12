import { MultiSelect } from '#/components/multi-select.tsx';
import { Field, FieldLabel } from '#/components/ui/field.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { AccountsTable } from './-components/accounts-table.tsx';
import { getAccounts, getAccountTypes } from './-server/accounts.server.ts';

export const Route = createFileRoute('/books/accounts/')({
  loader: async () => {
    const [accounts, accountTypes] = await Promise.all([getAccounts(), getAccountTypes()]);
    return { accounts, accountTypes };
  },
  component: RouteComponent,
});

// The Account Types the list starts out showing.
const DEFAULT_TYPES = ['Expense', 'Income'];

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard', url: '/books' }, { title: 'Accounts' }]);
  const { accounts, accountTypes } = Route.useLoaderData();

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
