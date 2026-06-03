import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-emerald-950 font-serif font-bold text-2xl mx-auto mb-4">
            R
          </div>
          <h1 className="text-2xl font-serif font-bold">Reset password</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose a new password for your account.</p>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="text-center text-sm">
          <Link href="/login" className="text-gold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
