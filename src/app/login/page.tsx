import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-emerald-950 text-gold">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
