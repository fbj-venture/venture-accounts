import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";
import { getBankAccounts } from "./-bank-accounts.ts";
import { useSetBreadcrumbs } from "#/routes/books/-breadcrumbs.ts";

export const Route = createFileRoute("/books/banking/")({
  beforeLoad: async () => {
    const bankAccounts = await getBankAccounts();
    return { bankAccounts };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { bankAccounts } = Route.useRouteContext();
  useSetBreadcrumbs([{ title: "Bank Accounts" }]);

  return (
    <>
      <h2>Bank accounts</h2>

      <div className="mt-6 flex max-w-sm flex-col gap-4">
        {bankAccounts.map((bankAccount) => (
          <Link
            key={bankAccount.id}
            to="/books/banking/$id"
            params={{ id: String(bankAccount.id) }}
          >
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{bankAccount.name}</CardTitle>
                <CardDescription>
                  {bankAccount.bankName} &middot; {bankAccount.accountNumber}
                </CardDescription>
              </CardHeader>
              {bankAccount.description ? (
                <CardContent className="text-sm text-muted-foreground">
                  {bankAccount.description}
                </CardContent>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
