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
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
    MAX_UPLOAD_DESCRIPTION_LENGTH,
    updateBankUploadDescription,
    type BankUploadRow,
} from "../-server/uploads.server.ts";

// Edits the description of an uploaded document. Mount it with a key on the
// upload so each one starts from its own description.
export function EditUploadDescriptionDialog({
  upload,
  onClose,
  onSaved,
}: {
  upload: Pick<BankUploadRow, "id" | "description">;
  onClose: () => void;
  /** Called after the description was saved, to reload the list. */
  onSaved: () => void | Promise<unknown>;
}) {
  const [description, setDescription] = useState(upload.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = description.trim();
  const canSave = trimmed !== "" && trimmed !== upload.description && !saving;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBankUploadDescription({ data: { id: upload.id, description: trimmed } });
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the description.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit description</DialogTitle>
            <DialogDescription>
              Only the description changes; the uploaded document itself is left as it is.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="edit-upload-description">Description</FieldLabel>
            <Input
              id="edit-upload-description"
              value={description}
              maxLength={MAX_UPLOAD_DESCRIPTION_LENGTH}
              onChange={(event) => setDescription(event.target.value)}
              autoFocus
              autoComplete="off"
            />
          </Field>
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
  );
}
