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
import { SaveIcon, Trash2Icon } from "lucide-react"
import { useState, type FormEvent } from "react"
import {
  MAX_ACCOUNT_DESCRIPTION_LENGTH,
  MAX_ACCOUNT_NAME_LENGTH,
} from "../-server/accounts.server.ts"
import type { ImportAccount } from "./accounts-import.ts"

// The value of the <no parent> choice: a Select item can't have an empty one.
const NO_PARENT = "none"

export type ImportParentChoice = { name: string; accountType: string }

// The choices, plus the current value when it isn't one of them (a type or
// parent the file got wrong), so the select can still show what is there.
function withCurrent(choices: string[], current: string) {
  return current === "" || choices.includes(current) ? choices : [current, ...choices]
}

// Edits one account of the import list before it is imported. Nothing is
// checked here: the list is validated as a whole after every change.
export function EditImportAccountDialog({
  item,
  accountTypes,
  parents,
  onSave,
  onRemove,
  onClose,
}: {
  item: ImportAccount
  accountTypes: string[]
  /** The accounts that could be this one's parent: those that aren't sub-accounts themselves. */
  parents: ImportParentChoice[]
  onSave: (item: ImportAccount) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)
  const [type, setType] = useState(item.accountType)
  const [parent, setParent] = useState(item.parent === "" ? NO_PARENT : item.parent)
  const [isArchived, setIsArchived] = useState(item.isArchived)

  const parentChoice = parents.find((choice) => choice.name === parent)
  const parentNames = withCurrent(
    parents.map((choice) => choice.name),
    parent === NO_PARENT ? "" : parent,
  )

  // A sub-account has its parent's type, so choosing a parent sets the type to
  // match (and the type select is locked while a known parent is chosen).
  function changeParent(value: string) {
    setParent(value)
    const chosen = parents.find((choice) => choice.name === value)
    if (chosen) {
      setType(chosen.accountType)
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    onSave({
      name,
      description,
      accountType: type,
      parent: parent === NO_PARENT ? "" : parent,
      isArchived,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>
              Changes only the list to be imported, not the file you uploaded.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="edit-import-name">Name</FieldLabel>
            <Input
              id="edit-import-name"
              value={name}
              maxLength={MAX_ACCOUNT_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-import-description">Description</FieldLabel>
            <Input
              id="edit-import-description"
              value={description}
              maxLength={MAX_ACCOUNT_DESCRIPTION_LENGTH}
              onChange={(event) => setDescription(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-import-parent">Parent</FieldLabel>
            <Select value={parent} onValueChange={changeParent}>
              <SelectTrigger id="edit-import-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>&lt;no parent&gt;</SelectItem>
                {parentNames.map((parentName) => (
                  <SelectItem key={parentName} value={parentName}>
                    {parentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-import-type">Account type</FieldLabel>
            <Select value={type} onValueChange={setType} disabled={parentChoice !== undefined}>
              <SelectTrigger id="edit-import-type" className="w-full">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {withCurrent(accountTypes, type).map((typeName) => (
                  <SelectItem key={typeName} value={typeName}>
                    {typeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="edit-import-archived"
              checked={isArchived}
              onCheckedChange={(checked) => setIsArchived(checked === true)}
            />
            <FieldLabel htmlFor="edit-import-archived">Archived</FieldLabel>
          </Field>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={onRemove}>
              <Trash2Icon />
              Remove from import
            </Button>
            <span className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <SaveIcon />
                Save
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
