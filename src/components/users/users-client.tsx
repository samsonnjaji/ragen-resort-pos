"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/stat-card";
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
import { createUser, updateUser } from "@/lib/actions/admin";
import { ROLE_LABELS } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface UsersClientProps {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    createdAt: Date;
  }>;
}

export function UsersClient({ users }: UsersClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await createUser({
        name: form.get("name") as string,
        email: form.get("email") as string,
        password: form.get("password") as string,
        role: form.get("role") as string,
      });
      toast({ title: "User created" });
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Users" description="Manage system users and roles">
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add User
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                  {!user.active && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await updateUser(user.id, { active: !user.active });
                  router.refresh();
                  toast({ title: user.active ? "User deactivated" : "User activated" });
                }}
              >
                {user.active ? "Deactivate" : "Activate"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Add User</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input name="name" required /></div>
            <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
            <div className="space-y-2"><Label>Password</Label><Input name="password" type="password" required minLength={6} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select name="role" defaultValue="CASHIER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Create User</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
