"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const resetSuccess = searchParams.get("reset") === "success";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (showSplash) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-emerald-950 cursor-pointer select-none"
        onClick={() => setShowSplash(false)}
      >
        <div className="animate-pulse px-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gold text-emerald-950 font-serif font-bold text-6xl mb-6 shadow-2xl shadow-gold/20 mx-auto">
            R
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-gold text-center mb-2">RAGEN RESORT</h1>
          <p className="text-emerald-300/70 text-center text-lg md:text-xl">Point of Sale System</p>
          <p className="text-emerald-400/50 text-center text-base mt-10 animate-bounce">Tap to continue</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-emerald-950" />
        <div className="relative z-10 text-center px-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold text-emerald-950 font-serif font-bold text-4xl mx-auto mb-8 shadow-xl shadow-gold/20">
            R
          </div>
          <h1 className="font-serif text-5xl font-bold text-gold mb-4">RAGEN RESORT</h1>
          <p className="text-emerald-200/80 text-xl mb-2">Premium Resort Management</p>
          <p className="text-emerald-400/60">Accommodation • Restaurant • Bar • POS</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-8 bg-background min-h-screen">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex h-16 w-16 items-center justify-center rounded-full bg-gold text-emerald-950 font-serif font-bold text-3xl mx-auto mb-4">
              R
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold">Welcome Back</h2>
            <p className="text-muted-foreground mt-1 text-base">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="Enter your email"
                className="h-12 text-base"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-12 text-base"
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {resetSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
                Your password was updated. Sign in with your new password.
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-gold hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full h-14 text-base touch-target" variant="gold" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
