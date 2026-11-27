import { Button } from "#/components/ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  PackageIcon,
  PaperclipIcon,
  ScaleIcon,
  SearchIcon,
  ZapIcon,
} from "lucide-react"
import { useState } from "react"
import { StatementsPackDialog } from "./statements-pack-dialog.tsx"

// The "Actions" menu in a bank account card's footer. Uploads comes first; add
// further per-account pages below it.
export function BankAccountMenu({
  bankAccountId,
  bankAccountName,
}: {
  bankAccountId: number
  bankAccountName: string
}) {
  const id = String(bankAccountId)
  const [packOpen, setPackOpen] = useState(false)
  return (
    <>
      {packOpen ? (
        <StatementsPackDialog
          bankAccountId={bankAccountId}
          bankAccountName={bankAccountName}
          onClose={() => setPackOpen(false)}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ZapIcon />
            Actions
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link to="/books/banking/uploads/$id" params={{ id }}>
              <PaperclipIcon />
              Uploads
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/books/banking/transactions/$id" params={{ id }}>
              <ArrowLeftRightIcon />
              Transactions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/books/banking/recon/$id" params={{ id }}>
              <ScaleIcon />
              Reconciliation
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/books/banking/search" search={{ bankAccountId }}>
              <SearchIcon />
              Find Transactions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPackOpen(true)}>
            <PackageIcon />
            Statements Pack
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
