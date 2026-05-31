import { ExpensesClient } from "@/components/expenses/expenses-client";
import { getExpenses, getExpenseSummary } from "@/lib/actions/admin";

export default async function ExpensesPage() {
  const [expenses, summary] = await Promise.all([getExpenses("month"), getExpenseSummary()]);
  return <ExpensesClient expenses={expenses} summary={summary} />;
}
