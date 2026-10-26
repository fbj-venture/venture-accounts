import { Button } from "#/components/ui/button.tsx"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import {
  readLastBankAccountId,
  saveLastBankAccountId,
} from "#/routes/books/expense/-lib/last-bank-account.ts"
import { useNavigate } from "@tanstack/react-router"
import { ReceiptIcon } from "lucide-react"
import { useEffect, useState } from "react"

// The same hover as the other dashboard cards: the border and the title turn orange.
const EXPENSE_HOVER =
  "transition-colors hover:border-primary **:data-[slot=card-title]:transition-colors hover:**:data-[slot=card-title]:text-primary"

// Dashboard shortcut for adding an expense with a photo of its receipt: pick
// the bank account it was paid from (remembered in this browser) and click the
// card to open the form.
export function AddExpenseCard({
  bankAccounts,
  className,
}: {
  bankAccounts: { id: number; name: string }[]
  className?: string
}) {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Read after mounting: the server render can't see local storage.
  useEffect(() => {
    const last = readLastBankAccountId()
    setSelectedId(bankAccounts.find((b) => b.id === last)?.id ?? bankAccounts[0]?.id ?? null)
  }, [bankAccounts])

  function open() {
    if (selectedId !== null) {
      void navigate({ to: "/books/expense/new", search: { bankAccountId: selectedId } })
    }
  }

  return (
    <Card
      className={`${className ?? ""} ${EXPENSE_HOVER} ${selectedId === null ? "" : "cursor-pointer"}`}
      onClick={open}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptIcon className="size-5" />
          Add an expense
        </CardTitle>
        <CardDescription>
          {bankAccounts.length === 0
            ? "Add a bank account first."
            : "Record money paid out, with a photo of the receipt."}
        </CardDescription>
      </CardHeader>
      {bankAccounts.length > 0 ? (
        // The drop-down is inside the clickable card, so its clicks (including
        // those from its pop-up, which React bubbles through the portal) stop here.
        <CardFooter className="flex-wrap gap-3" onClick={(event) => event.stopPropagation()}>
          <Select
            value={selectedId === null ? "" : String(selectedId)}
            onValueChange={(value) => {
              setSelectedId(Number(value))
              saveLastBankAccountId(Number(value))
            }}
          >
            <SelectTrigger aria-label="Paid from" className="min-w-0 grow">
              <SelectValue placeholder="Paid from..." />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((bankAccount) => (
                <SelectItem key={bankAccount.id} value={String(bankAccount.id)}>
                  {bankAccount.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={open} disabled={selectedId === null}>
            Add expense
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}
