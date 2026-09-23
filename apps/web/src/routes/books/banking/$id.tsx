import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";
import { getBankAccountById } from "./-bank-accounts.ts";
import { useSetBreadcrumbs } from "#/routes/books/-breadcrumbs.ts";

export const Route = createFileRoute("/books/banking/$id")({
  beforeLoad: async ({ params }) => {
    const bankAccount = await getBankAccountById({ data: params.id });
    if (!bankAccount) {
      throw notFound();
    }
    return { bankAccount };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { bankAccount } = Route.useRouteContext();
  useSetBreadcrumbs([
    { title: "Bank Accounts", url: "/books/banking" },
    { title: bankAccount.name },
  ]);

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>{bankAccount.name}</CardTitle>
        <CardDescription>{bankAccount.bankName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>Account number: {bankAccount.accountNumber}</p>
        {bankAccount.description ? <p>{bankAccount.description}</p> : null}
      </CardContent>
    </Card>
  );
}
