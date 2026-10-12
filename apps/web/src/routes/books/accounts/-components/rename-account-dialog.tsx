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
import { Field, FieldLabel } from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import { LoaderCircleIcon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MAX_ACCOUNT_NAME_LENGTH, renameAccount, type AccountRow } from "./accounts-fn.ts";

// Edits just this account's own name - for a sub-account that's the part
// after the "Parent:", the parent's name isn't touched. Mount it with a key
// on the account so each account starts from its own name.
export function RenameAccountDialog({
  account,
  onClose,
  onRenamed,
}: {
  account: AccountRow;
  onClose: () => void;
  /** Called after the new name was saved, to reload the list. */
  onRenamed: () => void | Promise<unknown>;
}) {
  const [name, setName] = useState(account.name);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSave = trimmed !== "" && trimmed !== account.name && !saving;

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
      await renameAccount({ data: { id: account.id, name: trimmed } });
      await onRenamed();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't rename the account.");
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
              <DialogTitle>Rename account</DialogTitle>
              <DialogDescription>
                {account.parentName
                  ? `A sub-account of ${account.parentName}. Only its own name is edited here.`
                  : `${account.accountType} account.`}
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="rename-account-name">Name</FieldLabel>
              <Input
                id="rename-account-name"
                value={name}
                maxLength={MAX_ACCOUNT_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                autoComplete="off"
              />
            </Field>
            <p className="flex items-start gap-2 text-sm text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              Changing the name affects past and future transactions that are linked to this
              account.
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
            <AlertDialogTitle>Rename this account?</AlertDialogTitle>
            <AlertDialogDescription>
              "{account.name}" will be renamed to "{trimmed}". Every transaction linked to this
              account, past and future, will show the new name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button disabled={saving} onClick={save}>
              {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
              Yes, rename
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
