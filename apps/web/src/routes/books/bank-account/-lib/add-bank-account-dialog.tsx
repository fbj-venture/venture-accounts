import { Button } from "#/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { Input } from "#/components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import {
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
} from "#/routes/books/accounts/-server/accounts.server.ts"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { MAX_DESCRIPTION_LENGTH, createBankAccount } from "../-server/bank-accounts.server.ts"

// Adds a new bank account: an Asset Account plus the bank details behind it.
export function AddBankAccountDialog({
  banks,
  onClose,
  onAdded,
}: {
  banks: { id: number; name: string; logo: string | null }[]
  onClose: () => void
  /** Called after the bank account was added, to reload the list. */
  onAdded: () => void | Promise<unknown>
}) {
  const [accountName, setAccountName] = useState("")
  const [bankId, setBankId] = useState("")
  const [bankDescription, setBankDescription] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave =
    accountName.trim() !== "" &&
    bankId !== "" &&
    bankDescription.trim() !== "" &&
    accountNumber.trim() !== "" &&
    !saving

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createBankAccount({
        data: { accountName, bankId: Number(bankId), bankDescription, accountNumber },
      })
      await onAdded()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't add the bank account.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New Bank Account</DialogTitle>
            <DialogDescription>
              Creates the ledger account (an Asset) together with its bank details.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="add-bank-account-name">Accounting name</FieldLabel>
            <Input
              id="add-bank-account-name"
              value={accountName}
              maxLength={MAX_ACCOUNT_NAME_LENGTH}
              onChange={(event) => setAccountName(event.target.value)}
              autoFocus
              autoComplete="off"
            />
          </Field>
          <hr />
          <Field>
            <FieldLabel htmlFor="add-bank-account-bank">Bank</FieldLabel>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger id="add-bank-account-bank" className="w-full">
                <SelectValue placeholder="Choose a bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    <span className="flex items-center gap-2">
                      <BankLogo logo={bank.logo} />
                      {bank.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="add-bank-account-number">Bank account number</FieldLabel>
            <Input
              id="add-bank-account-number"
              inputMode="numeric"
              value={accountNumber}
              maxLength={MAX_ACCOUNT_NUMBER_LENGTH + 10}
              onChange={(event) => setAccountNumber(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="add-bank-account-description">Account description</FieldLabel>
            <Input
              id="add-bank-account-description"
              value={bankDescription}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(event) => setBankDescription(event.target.value)}
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
  )
}
