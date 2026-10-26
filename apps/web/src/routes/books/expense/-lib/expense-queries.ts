import { queryOptions } from "@tanstack/react-query"
import { getExpenseOptions } from "../-server/expense-options.server.ts"

export const expenseOptionsQuery = queryOptions({
  queryKey: ["expense", "options"] as const,
  queryFn: () => getExpenseOptions(),
})
