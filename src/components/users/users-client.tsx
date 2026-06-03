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
  DialogDescription,
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
import { createUserWithTempPassword, resetUserTempPassword } from "@/lib/actions/users";
import { archiveUser } from "@/lib/actions/archive";
import { ROLE_LABELS } from "@/lib/utils";
import { getErrorMessage } from "@/lib/app-error";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Plus, Copy, KeyRound, UserX } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface UsersClientProps {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    mustChangePassword: boolean;
    createdAt: Date;
  }>;
}

export function UsersClient({ users }: UsersClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<UsersClientProps["users"][0] | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [resetTarget, setResetTarget] = useState<UsersClientProps["users"][0] | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<{
    email: string;
    password: string;
    emailSent: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await createUserWithTempPassword({
        name: form.get("name") as string,
        email: form.get("email") as string,
        role: form.get("role") as string,
      });
      setDialogOpen(false);
      setTempPasswordResult({
        email: result.user.email,
        password: result.temporaryPassword,
        emailSent: result.emailSent,
      });
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetTempPassword = async () => {
    if (!resetTarget) return;
    setLoading(true);
    try {
      const result = await resetUserTempPassword(resetTarget.id);
      setResetTarget(null);
      setTempPasswordResult({
        email: resetTarget.email,
        password: result.temporaryPassword,
        emailSent: result.emailSent,
      });
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Users" description="Create staff accounts with secure temporary passwords">
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add User
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No active users
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{user.name}</span>
                    <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                    {user.mustChangePassword && (
                      <Badge variant="warning">Pending password change</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResetTarget(user)}
                  >
                    <KeyRound className="h-4 w-4 mr-1" /> Reset temp password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30"
                    onClick={() => {
                      setArchiveTarget(user);
                      setArchiveReason("");
                    }}
                  >
                    <UserX className="h-4 w-4 mr-1" /> Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add User</DialogTitle>
            <DialogDescription>
              A secure temporary password will be generated automatically. You cannot set the password manually.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select name="role" defaultValue="CASHIER">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              Create User
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!tempPasswordResult}
        onOpenChange={(open) => !open && setTempPasswordResult(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold">Temporary password</DialogTitle>
            <DialogDescription className="text-amber-500 font-medium">
              Copy this temporary password now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {tempPasswordResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Account: {tempPasswordResult.email}</p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={tempPasswordResult.password}
                  className="font-mono text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyPassword(tempPasswordResult.password)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {!tempPasswordResult.emailSent && (
                <p className="text-sm text-amber-500">
                  User created, but email failed. Copy and share the temporary password securely.
                </p>
              )}
              {tempPasswordResult.emailSent && (
                <p className="text-sm text-emerald-500">
                  Welcome email sent. You may still copy the password as a backup.
                </p>
              )}
              <Button
                className="w-full"
                variant="gold"
                onClick={() => setTempPasswordResult(null)}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title="Reset temporary password?"
        description={`Generate a new temporary password for ${resetTarget?.name}? They must change it on next login.`}
        confirmLabel="Reset password"
        loading={loading}
        onConfirm={handleResetTempPassword}
      />

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Deactivate user</DialogTitle>
            <DialogDescription>
              {archiveTarget?.name} will not be able to sign in. Historical data is preserved. Restore from Archive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g. Left the resort"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              if (!archiveTarget) return;
              setLoading(true);
              try {
                await archiveUser(archiveTarget.id, archiveReason);
                toast({ title: "User deactivated" });
                setArchiveTarget(null);
                router.refresh();
              } catch (err) {
                toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
              } finally {
                setLoading(false);
              }
            }}
          >
            Deactivate user
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
