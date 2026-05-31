"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createExpense, deleteExpense } from "@/lib/actions/admin";
import { formatCurrency, formatDateOnly } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import { ExpenseCategory } from "@prisma/client";

interface ExpensesClientProps {
  expenses: Array<{
    id: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: Date;
    reference: string | null;
  }>;
  summary: { daily: number; monthly: number };
}

const categoryLabels: Record<string, string> = {
  FUEL: "Fuel",
  ELECTRICITY: "Electricity",
  WATER: "Water",
  STAFF: "Staff",
  MAINTENANCE: "Maintenance",
  PURCHASES: "Purchases",
  OTHER: "Other",
};

export function ExpensesClient({ expenses, summary }: ExpensesClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await createExpense({
        category: form.get("category") as ExpenseCategory,
        description: form.get("description") as string,
        amount: Number(form.get("amount")),
        date: form.get("date") ? new Date(form.get("date") as string) : undefined,
        reference: (form.get("reference") as string) || undefined,
      });
      toast({ title: "Expense recorded" });
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Expenses" description="Track business expenses">
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Expense
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Daily Expenses" value={summary.daily} icon={Wallet} variant="danger" />
        <StatCard title="Monthly Expenses" value={summary.monthly} icon={Wallet} variant="gold" />
      </div>

      <div className="space-y-3">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{expense.description}</span>
                  <Badge variant="outline">{categoryLabels[expense.category]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatDateOnly(expense.date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-red-400">{formatCurrency(expense.amount)}</span>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => {
                  await deleteExpense(expense.id);
                  router.refresh();
                  toast({ title: "Expense deleted" });
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select name="category" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" required /></div>
            <div className="space-y-2"><Label>Amount (KES)</Label><Input name="amount" type="number" required /></div>
            <div className="space-y-2"><Label>Date</Label><Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
            <div className="space-y-2"><Label>Reference</Label><Input name="reference" /></div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Save Expense</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
