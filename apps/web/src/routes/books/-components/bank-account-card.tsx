import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx"
import { BankLogo } from "./bank-logo.tsx"
import { formatZar } from "#/lib/currency.ts"
import { cn } from "#/lib/utils.ts"
import type { ReactNode } from "react"

// The union of fields any page might have for a bank account - each page
// passes whatever subset it fetched. Passing `balance` takes priority over
// `bankName`/`accountNumber` for the card's description line, since a page
// showing balances (see books/index.tsx) has no use for showing both.
export type BankAccountCardData = {
  id: number
  name: string
  description?: string | null
  bankName?: string | null
  /** The bank's logo as inline SVG markup (bank.logo). */
  bankLogo?: string | null
  accountNumber?: string
  balance?: number
}

export function BankAccountCard({
  bankAccount,
  className,
  footer,
}: {
  bankAccount: BankAccountCardData
  className?: string
  /** Rendered in the card's footer, e.g. an actions menu. */
  footer?: ReactNode
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BankLogo logo={bankAccount.bankLogo} name={bankAccount.bankName} />
          {bankAccount.name}
        </CardTitle>
        {bankAccount.balance !== undefined ? (
          <CardDescription className="text-lg font-medium text-foreground">
            {formatZar(bankAccount.balance)}
          </CardDescription>
        ) : bankAccount.bankName ? (
          <CardDescription>
            {bankAccount.bankName} &middot; {bankAccount.accountNumber}
          </CardDescription>
        ) : null}
      </CardHeader>
      {bankAccount.description ? (
        <CardContent className="text-sm text-muted-foreground">
          {bankAccount.description}
        </CardContent>
      ) : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  )
}
