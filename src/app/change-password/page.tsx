import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-emerald-950 font-serif font-bold text-2xl mx-auto mb-4">
            R
          </div>
          <h1 className="text-2xl font-serif font-bold">Change password</h1>
          <p className="text-muted-foreground text-sm mt-2">
            You must change your temporary password before continuing.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
