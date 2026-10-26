import { FilterSelect } from "#/components/filter-select.tsx"
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx"
import { Button } from "#/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import { dayKey } from "#/lib/dates.ts"
import {
  MAX_EXPENSE_DESCRIPTION_LENGTH,
  expenseProblems,
  type ExpenseField,
} from "#/lib/expense-entry.ts"
import { shrinkImage } from "#/lib/shrink-image.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, CheckCircle2Icon, LoaderCircleIcon } from "lucide-react"
import { useRef, useState, type FormEvent } from "react"
import { expenseOptionsQuery } from "./-lib/expense-queries.ts"
import { readLastBankAccountId, saveLastBankAccountId } from "./-lib/last-bank-account.ts"

export const Route = createFileRoute("/books/expense/new")({
  // The bank account picked on the dashboard card.
  validateSearch: (search: Record<string, unknown>): { bankAccountId?: number } => {
    const id = Number(search.bankAccountId)
    return Number.isInteger(id) && id > 0 ? { bankAccountId: id } : {}
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(expenseOptionsQuery)
  },
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Add Expense" }])
  const queryClient = useQueryClient()
  const { bankAccountId: searchBankAccountId } = Route.useSearch()
  const {
    data: { bankAccounts, expenseAccounts },
  } = useSuspenseQuery(expenseOptionsQuery)

  // The account from the dashboard card, else the one last used, else the first.
  const [bankAccountId, setBankAccountId] = useState(() => {
    const wanted = searchBankAccountId ?? readLastBankAccountId()
    return String(bankAccounts.find((b) => b.id === wanted)?.id ?? bankAccounts[0]?.id ?? "")
  })
  const [expenseAccountId, setExpenseAccountId] = useState("")
  const [date, setDate] = useState(() => dayKey(new Date()))
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const photoRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What is wrong with each field, found when Add expense is clicked. A
  // field's message goes as soon as that field is changed.
  const [problems, setProblems] = useState<Partial<Record<ExpenseField, string>>>({})
  const clearProblem = (field: ExpenseField) =>
    setProblems((previous) => ({ ...previous, [field]: undefined }))
  const [savedDescription, setSavedDescription] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSavedDescription(null)
    setSaving(true)
    try {
      // A big photo is shrunk first, so it is the shrunk one that is checked
      // against the size limit and uploaded.
      const chosen = photoRef.current?.files?.[0]
      const photo = chosen && (await shrinkImage(chosen))
      // Every field is checked, with the same rules the server applies.
      const found = expenseProblems({
        bankAccountId: Number(bankAccountId),
        expenseAccountId: Number(expenseAccountId),
        date,
        description,
        amount: amount.trim() === "" ? NaN : Number(amount),
        photo,
      })
      setProblems(found)
      if (!photo || Object.keys(found).length > 0) {
        return
      }
      const formData = new FormData()
      formData.set("bankAccountId", bankAccountId)
      formData.set("expenseAccountId", expenseAccountId)
      formData.set("date", date)
      formData.set("description", description.trim())
      formData.set("amount", amount)
      formData.set("photo", photo)
      const response = await fetch("/api/books/expense", { method: "POST", body: formData })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      saveLastBankAccountId(Number(bankAccountId))
      // The dashboard balances and the account's unposted transactions changed.
      await queryClient.invalidateQueries()
      setSavedDescription(description.trim())
      // Ready for the next one; the bank account and date usually stay.
      setDescription("")
      setAmount("")
      setExpenseAccountId("")
      if (photoRef.current) {
        photoRef.current.value = ""
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the expense.")
    } finally {
      setSaving(false)
    }
  }

  const label = (account: (typeof expenseAccounts)[number]) =>
    account.parentName ? `${account.parentName} › ${account.name}` : account.name

  return (
    <>
      <h2 className="pb-2">Add Expense</h2>
      <p className="py-2 text-sm text-muted-foreground">
        Record money paid out of a bank account, with a photo of the receipt. It is added as an
        unposted transaction, and is matched with the bank&apos;s own line when the statement is
        imported.
      </p>

      <form onSubmit={submit} noValidate className="mt-4 max-w-sm">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="expense-bank-account">Paid from</FieldLabel>
            <Select
              value={bankAccountId}
              onValueChange={(value) => {
                setBankAccountId(value)
                clearProblem("bankAccountId")
              }}
            >
              <SelectTrigger
                id="expense-bank-account"
                className="w-full"
                aria-invalid={problems.bankAccountId ? true : undefined}
              >
                <SelectValue placeholder="Choose a bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((bankAccount) => (
                  <SelectItem key={bankAccount.id} value={String(bankAccount.id)}>
                    {bankAccount.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{problems.bankAccountId}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-date">Date</FieldLabel>
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                clearProblem("date")
              }}
              aria-invalid={problems.date ? true : undefined}
            />
            <FieldError>{problems.date}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-description">Description</FieldLabel>
            <Input
              id="expense-description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                clearProblem("description")
              }}
              maxLength={MAX_EXPENSE_DESCRIPTION_LENGTH}
              autoComplete="off"
              aria-invalid={problems.description ? true : undefined}
            />
            <FieldError>{problems.description}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-amount">Amount (R)</FieldLabel>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                clearProblem("amount")
              }}
              aria-invalid={problems.amount ? true : undefined}
            />
            <FieldDescription>
              Always money paid out, so enter it as a positive amount.
            </FieldDescription>
            <FieldError>{problems.amount}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-account">Expense account</FieldLabel>
            <FilterSelect
              id="expense-account"
              options={expenseAccounts.map((expenseAccount) => ({
                value: String(expenseAccount.id),
                label: label(expenseAccount),
              }))}
              value={expenseAccountId}
              onValueChange={(value) => {
                setExpenseAccountId(value)
                clearProblem("expenseAccountId")
              }}
              placeholder="Choose an expense account"
              filterPlaceholder="Filter expense accounts..."
              invalid={problems.expenseAccountId !== undefined}
            />
            <FieldError>{problems.expenseAccountId}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-photo">Photo of the receipt</FieldLabel>
            <Input
              id="expense-photo"
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={() => clearProblem("photo")}
              aria-invalid={problems.photo ? true : undefined}
            />
            <FieldDescription>
              Take a photo or choose one. A large photo is made smaller before it is sent.
            </FieldDescription>
            <FieldError>{problems.photo}</FieldError>
          </Field>

          <Field>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
              {saving ? "Saving..." : "Add expense"}
            </Button>
          </Field>

          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>Not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {savedDescription !== null ? (
            <Alert>
              <CheckCircle2Icon className="size-4" />
              <AlertTitle>Expense added</AlertTitle>
              <AlertDescription>
                &ldquo;{savedDescription}&rdquo; was added. Add another above, or go back to the{" "}
                <Link to="/books" className="underline">
                  dashboard
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
      </form>
    </>
  )
}
