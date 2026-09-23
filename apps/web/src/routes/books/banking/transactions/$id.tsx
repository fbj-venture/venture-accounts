import { createFileRoute, notFound } from '@tanstack/react-router'
import { getBankAccountById } from "../-bank-accounts.ts";
import { useSetBreadcrumbs } from "#/routes/books/-breadcrumbs.ts";

export const Route = createFileRoute('/books/banking/transactions/$id')({
  beforeLoad: async ({ params }) => {
    const bankAccount = await getBankAccountById({ data: params.id });
    if (!bankAccount) {
      throw notFound();
    }
    return { bankAccount };
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { bankAccount } = Route.useRouteContext();
  useSetBreadcrumbs([
    { title: "Transactions", url: "/books/banking/transactions" },
    { title: bankAccount.name },
  ]);

  return <h2>{bankAccount.name}</h2>;
}
