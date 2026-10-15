import { Button } from "#/components/ui/button.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import { LoaderCircleIcon, PlusIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { MAX_ACCOUNT_NAME_LENGTH, createAccount } from "../-server/accounts.server.ts"

// The value of the <no parent> choice: a Select item can't have an empty one.
const NO_PARENT = "none"

export type ParentChoice = { id: number; name: string; accountTypeId: number }

// Adds a new Account. Its Account Type is chosen here, unless it is put under
// a parent: a sub-account takes its parent's type.
export function AddAccountDialog({
  accountTypes,
  parents,
  onClose,
  onAdded,
}: {
  accountTypes: { id: number; name: string }[]
  /** The Accounts that can be a parent: every one that isn't a sub-account itself. */
  parents: ParentChoice[]
  onClose: () => void
  /** Called after the account was added, to reload the list. */
  onAdded: () => void | Promise<unknown>
}) {
  const [name, setName] = useState("")
  const [parentValue, setParentValue] = useState(NO_PARENT)
  const [typeValue, setTypeValue] = useState("")
  const [isArchived, setIsArchived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parent = parents.find((choice) => String(choice.id) === parentValue)
  const trimmed = name.trim()
  const canSave = trimmed !== "" && typeValue !== "" && !saving

  // A sub-account has its parent's type, so choosing a parent sets the type to
  // match (and the type select is locked while a parent is chosen). Going back
  // to <no parent> leaves the type as it was, free to change.
  function changeParent(value: string) {
    setParentValue(value)
    const chosen = parents.find((choice) => String(choice.id) === value)
    if (chosen) {
      setTypeValue(String(chosen.accountTypeId))
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createAccount({
        data: {
          name: trimmed,
          isArchived,
          accountTypeId: Number(typeValue),
          parentId: parent ? parent.id : null,
        },
      })
      await onAdded()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't add the account.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              Put it under a parent to make it a sub-account, which takes the parent's type.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="add-account-name">Name</FieldLabel>
            <Input
              id="add-account-name"
              value={name}
              maxLength={MAX_ACCOUNT_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="add-account-parent">Parent</FieldLabel>
            <Select value={parentValue} onValueChange={changeParent}>
              <SelectTrigger id="add-account-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>&lt;no parent&gt;</SelectItem>
                {parents.map((choice) => (
                  <SelectItem key={choice.id} value={String(choice.id)}>
                    {choice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="add-account-type">Account type</FieldLabel>
            <Select value={typeValue} onValueChange={setTypeValue} disabled={parent !== undefined}>
              <SelectTrigger id="add-account-type" className="w-full">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="add-account-archived"
              checked={isArchived}
              onCheckedChange={(checked) => setIsArchived(checked === true)}
            />
            <FieldLabel htmlFor="add-account-archived">Archived</FieldLabel>
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
              {saving ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
