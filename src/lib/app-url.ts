import { AppError } from "@/lib/app-error";

/** Production hostname for email links (never use Vercel preview/team URLs). */
export const PRODUCTION_APP_HOST = "ragen-resort-pos.vercel.app";

/**
 * Public app base URL for user-facing email links.
 * Prefers APP_BASE_URL, then NEXTAUTH_URL. Never uses VERCEL_URL.
 */
export function getAppBaseUrl(): string {
  const appBase = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  const nextAuth = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");

  const base = appBase || nextAuth;

  if (!base) {
    throw new AppError(
      "APP_BASE_URL or NEXTAUTH_URL must be set (e.g. https://ragen-resort-pos.vercel.app)."
    );
  }

  if (isUnsafeEmailBaseUrl(base)) {
    if (appBase && !isUnsafeEmailBaseUrl(appBase)) {
      return appBase;
    }
    throw new AppError(
      "Email links require APP_BASE_URL set to your public production URL: https://ragen-resort-pos.vercel.app"
    );
  }

  return base;
}

/** True when URL looks like a protected Vercel preview/team deployment. */
export function isUnsafeEmailBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (host === PRODUCTION_APP_HOST || host === "localhost") return false;
    if (host.includes("daniels-projects")) return true;
    if (host.endsWith(".vercel.app") && host !== PRODUCTION_APP_HOST) return true;
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel && (host === vercel || url.includes(vercel))) return true;
  } catch {
    return true;
  }
  return false;
}

export function getLoginUrl(): string {
  return `${getAppBaseUrl()}/login`;
}

export function getResetPasswordUrl(token: string): string {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
