import { formatDate } from "#/lib/dates.ts";
import { AccountSelector, type AccountOptions } from "#/components/account-selector.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Checkbox } from "#/components/ui/checkbox.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { formatZar } from "#/lib/currency.ts";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { LoaderCircleIcon, SaveCheckIcon } from "lucide-react";
import type { AccountTransaction } from "./transactions-fn.ts";

export type PostingState = {
  accountOptions: AccountOptions;
  /** Account chosen per row, keyed by journalLineId - not saved until onSave. */
  selections: ReadonlyMap<number, number>;
  onSelect: (journalLineId: number, accountId: number) => void;
  /** Rows whose "Post?" box is unticked - every other row posts on save. */
  unpostedLineIds: ReadonlySet<number>;
  onPostChange: (journalLineId: number, shouldPost: boolean) => void;
  /** Note typed per row, keyed by journalLineId - saved with the row. */
  notes: ReadonlyMap<number, string>;
  onNoteChange: (journalLineId: number, note: string) => void;
  /** accountId is the row's current account - a new choice or the saved one. */
  onSave: (transaction: AccountTransaction, accountId: number) => void;
  /** Rows whose save is still in flight - other rows stay editable. */
  savingLineIds: ReadonlySet<number>;
};

// @tanstack/react-table v9's native API (useTable + explicit feature slots)
// is far more than a plain listing table needs; the /legacy subpath keeps
// the familiar v8 useReactTable/ColumnDef/flexRender shape for this stub.
export function getColumns({
  accountOptions,
  selections,
  onSelect,
  unpostedLineIds,
  onPostChange,
  notes,
  onNoteChange,
  onSave,
  savingLineIds,
}: PostingState): LegacyColumnDef<AccountTransaction>[] {
  // Either tab can be saved: a Category balances the transaction, a Bank
  // matches it up as a Transfer with that bank's side (server-side).
  const selectableIds = new Set(
    [...accountOptions.categories, ...accountOptions.banks].map((option) => option.id),
  );

  return [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ getValue }) => formatDate(getValue<Date>()),
    },
    {
      id: "description",
      header: "Description",
      accessorFn: (row) => row.description ?? row.note,
    },
    {
      id: "note",
      header: "Note",
      cell: ({ row }) => {
        const { journalLineId } = row.original;
        return (
          <Input
            aria-label="Note"
            value={notes.get(journalLineId) ?? ""}
            onChange={(event) => onNoteChange(journalLineId, event.target.value)}
          />
        );
      },
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ getValue }) => (
        <div className="text-right tabular-nums">{formatZar(getValue<number>())}</div>
      ),
    },
    {
      id: "account",
      header: "Account",
      cell: ({ row }) => {
        const { journalLineId } = row.original;
        const postCheckboxId = `post-${journalLineId}`;
        return (
          <div className="flex items-center gap-3">
            <AccountSelector
              options={accountOptions}
              // An unsaved choice wins; otherwise show the account already saved
              // on the transaction's other side, if any.
              value={selections.get(journalLineId) ?? row.original.otherAccountId}
              onValueChange={(accountId) => onSelect(journalLineId, accountId)}
            />
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={postCheckboxId}
                checked={!unpostedLineIds.has(journalLineId)}
                onCheckedChange={(checked) => onPostChange(journalLineId, checked === true)}
              />
              <Label htmlFor={postCheckboxId} className="font-normal">
                Post?
              </Label>
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => {
        const { journalLineId, otherAccountId } = row.original;
        // Same rule as the Account cell: an unsaved choice, else the saved one.
        // A saved account alone still enables Save, so it can be posted later.
        const accountId = selections.get(journalLineId) ?? otherAccountId;
        const isSaving = savingLineIds.has(journalLineId);
        const canSave = accountId !== null && selectableIds.has(accountId) && !isSaving;
        return (
          <div className="flex justify-end">
            <Button
              type="button"
              size="icon-sm"
              aria-label="Save"
              disabled={!canSave}
              onClick={() => accountId !== null && onSave(row.original, accountId)}
            >
              {isSaving ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <SaveCheckIcon className="size-4" />
              )}
            </Button>
          </div>
        );
      },
    },
  ];
}
