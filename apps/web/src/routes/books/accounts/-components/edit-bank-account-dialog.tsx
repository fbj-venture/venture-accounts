import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "#/components/ui/alert-dialog.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import { LoaderCircleIcon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
    MAX_ACCOUNT_NUMBER_LENGTH,
    MAX_BANK_NAME_LENGTH,
    updateBankAccount,
    type AccountRow,
} from "../-server/accounts.server.ts";

// Edits the bank details behind a bank Account. Mount it with a key on the
// account so each one starts from its own details.
export function EditBankAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountRow;
  onClose: () => void;
  /** Called after the details were saved, to reload the list. */
  onSaved: () => void | Promise<unknown>;
}) {
  const [bankName, setBankName] = useState(account.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(account.accountNumber ?? "");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newName = bankName.trim();
  const newNumber = accountNumber.replace(/\s+/g, "");
  const isChanged = newName !== account.bankName || newNumber !== account.accountNumber;
  const canSave = newName !== "" && newNumber !== "" && isChanged && !saving;

  function askToConfirm(event: FormEvent) {
    event.preventDefault();
    if (canSave) {
      setConfirming(true);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateBankAccount({ data: { id: account.id, bankName: newName, accountNumber: newNumber } });
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't update the bank account.");
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={askToConfirm} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Edit bank account</DialogTitle>
              <DialogDescription>The bank details behind {account.fullName}.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="edit-bank-name">Bank name</FieldLabel>
                <Input
                  id="edit-bank-name"
                  value={bankName}
                  maxLength={MAX_BANK_NAME_LENGTH}
                  onChange={(event) => setBankName(event.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-bank-account-number">Account number</FieldLabel>
                <Input
                  id="edit-bank-account-number"
                  inputMode="numeric"
                  value={accountNumber}
                  maxLength={MAX_ACCOUNT_NUMBER_LENGTH + 10}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  autoComplete="off"
                />
              </Field>
            </FieldGroup>
            <p className="flex items-start gap-2 text-sm text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              Bank statements are matched to this account by its account number. If it is changed,
              statements that still show the old number will no longer import into this account.
              The new details show wherever this bank account is listed.
            </p>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave}>
                {saving ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={(open) => !saving && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change these bank details?</AlertDialogTitle>
            <AlertDialogDescription>
              {account.bankName} · {account.accountNumber} will become {newName} · {newNumber}.
              Statements showing the old account number will no longer import into this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button disabled={saving} onClick={save}>
              {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
              Yes, change them
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
