import { Button } from "#/components/ui/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { Input } from "#/components/ui/input.tsx"
import { formatDateTime } from "#/lib/dates.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { accountKeys } from "#/routes/books/accounts/-lib/accounts-queries.ts"
import {
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
} from "#/routes/books/accounts/-server/accounts.server.ts"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router"
import { ChevronLeft, SaveIcon, TriangleAlertIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { bankAccountKeys } from "./-lib/bank-accounts-queries.ts"
import {
  getBankAccount,
  MAX_DESCRIPTION_LENGTH,
  updateBankAccountDetails,
} from "./-server/bank-accounts.server.ts"

export const Route = createFileRoute("/books/bank-account/$id")({
  loader: async ({ params }) => {
    const id = Number(params.id)
    const bankAccount = Number.isInteger(id) ? await getBankAccount({ data: id }) : null
    if (!bankAccount) {
      throw notFound()
    }
    return { bankAccount }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { bankAccount } = Route.useLoaderData()
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Bank accounts", url: "/books/bank-account" },
    { title: bankAccount.accountName },
  ])

  const [accountName, setAccountName] = useState(bankAccount.accountName)
  const [accountDescription, setAccountDescription] = useState(bankAccount.accountDescription ?? "")
  const [bankDescription, setBankDescription] = useState(bankAccount.bankDescription)
  const [accountNumber, setAccountNumber] = useState(bankAccount.accountNumber)
  // One flag for both: the Account and its bank details are always archived together.
  const [isArchived, setIsArchived] = useState(bankAccount.bankIsArchived)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const newAccountName = accountName.trim()
  const newAccountDescription = accountDescription.trim()
  const newBankDescription = bankDescription.trim()
  const newNumber = accountNumber.replace(/\s+/g, "")
  const isChanged =
    newAccountName !== bankAccount.accountName ||
    newAccountDescription !== (bankAccount.accountDescription ?? "") ||
    isArchived !== bankAccount.accountIsArchived ||
    newBankDescription !== bankAccount.bankDescription ||
    newNumber !== bankAccount.accountNumber ||
    isArchived !== bankAccount.bankIsArchived
  const canSave =
    isChanged && !saving && newAccountName !== "" && newBankDescription !== "" && newNumber !== ""

  // Wraps a field's setter so editing it clears the "Saved." note.
  const edited =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setSaved(false)
    }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateBankAccountDetails({
        data: {
          id: bankAccount.id,
          accountName: newAccountName,
          accountDescription: newAccountDescription,
          accountIsArchived: isArchived,
          bankDescription: newBankDescription,
          accountNumber: newNumber,
          bankIsArchived: isArchived,
        },
      })
      // The list, the Accounts page and the account selectors (still route
      // loader data) all show these details.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bankAccountKeys.all }),
        queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      ])
      await router.invalidate({ sync: true })
      setAccountName(newAccountName)
      setAccountDescription(newAccountDescription)
      setBankDescription(newBankDescription)
      setAccountNumber(newNumber)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the bank account.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="pb-2">{bankAccount.accountName}</h2>
      {saved ? <p className="mb-2 text-sm text-muted-foreground">Saved.</p> : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form id="bank-account-form" onSubmit={save} className="grid max-w-4xl gap-4">
        <div className="grid items-start gap-4 md:grid-cols-2">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Bookkeeping Account details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm text-muted-foreground">{bankAccount.accountType} account.</p>
                <Field>
                  <FieldLabel htmlFor="account-name">Name</FieldLabel>
                  <Input
                    id="account-name"
                    value={accountName}
                    maxLength={MAX_ACCOUNT_NAME_LENGTH}
                    onChange={(event) => edited(setAccountName)(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-description">Description</FieldLabel>
                  <Input
                    id="account-description"
                    value={accountDescription}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    onChange={(event) => edited(setAccountDescription)(event.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <p className="flex items-start gap-2 text-sm text-warning">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                  Changing the name affects past and future transactions that are linked to this
                  account.
                </p>
              </CardContent>
            </Card>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDateTime(bankAccount.createdAt)}</dd>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd>{formatDateTime(bankAccount.updatedAt)}</dd>
            </dl>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Bank Account details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel>Bank</FieldLabel>
                <p className="flex items-center gap-2 text-sm">
                  <BankLogo logo={bankAccount.bankLogo} />
                  {bankAccount.bankName}
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-description">Description</FieldLabel>
                <Input
                  id="bank-description"
                  value={bankDescription}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChange={(event) => edited(setBankDescription)(event.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-account-number">Account number</FieldLabel>
                <Input
                  id="bank-account-number"
                  inputMode="numeric"
                  value={accountNumber}
                  maxLength={MAX_ACCOUNT_NUMBER_LENGTH + 10}
                  onChange={(event) => edited(setAccountNumber)(event.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>
              <p className="flex items-start gap-2 text-sm text-warning">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                Bank statements are matched to this account by its account number. If it is changed,
                statements that still show the old number will no longer import into this account.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-end justify-between gap-4">
          <Button asChild variant="ghost">
            <Link to="/books/bank-account">
              <ChevronLeft />
              Back to bank accounts
            </Link>
          </Button>
          <div className="grid justify-items-end gap-4">
            <Field orientation="horizontal" className="w-fit">
              <Checkbox
                id="archived"
                checked={isArchived}
                onCheckedChange={(checked) => edited(setIsArchived)(checked === true)}
              />
              <FieldLabel htmlFor="archived">Archived</FieldLabel>
            </Field>
            <Button type="submit" disabled={!canSave}>
              <SaveIcon />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
