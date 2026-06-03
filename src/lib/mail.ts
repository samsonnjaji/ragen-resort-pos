import nodemailer from "nodemailer";
import { getLoginUrl, getResetPasswordUrl } from "@/lib/app-url";
import {
  buildWelcomeEmail,
  buildAdminTempPasswordEmail,
  buildPasswordResetEmail,
} from "@/lib/email-templates";

export type SendMailResult = { ok: true } | { ok: false; error: string };

function getSmtpConfig() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || 587);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, user, pass, from };
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendMailResult> {
  const config = getSmtpConfig();
  if (!config) {
    console.error("[mail] SMTP not configured — set EMAIL_SERVER_* env vars");
    return { ok: false, error: "Email is not configured on the server." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    console.error("[mail] Send failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendWelcomeUserEmail(
  to: string,
  data: { name: string; role: string; temporaryPassword: string }
): Promise<SendMailResult> {
  const loginUrl = getLoginUrl();
  const { html, text } = buildWelcomeEmail({
    name: data.name,
    role: data.role,
    loginUrl,
    temporaryPassword: data.temporaryPassword,
  });

  return sendMail({
    to,
    subject: "Welcome to RAGEN RESORT POS",
    text,
    html,
  });
}

export async function sendAdminTempPasswordEmail(
  to: string,
  data: { name: string; role: string; temporaryPassword: string }
): Promise<SendMailResult> {
  const loginUrl = getLoginUrl();
  const { html, text } = buildAdminTempPasswordEmail({
    name: data.name,
    role: data.role,
    loginUrl,
    temporaryPassword: data.temporaryPassword,
  });

  return sendMail({
    to,
    subject: "Your RAGEN RESORT POS temporary password",
    text,
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string
): Promise<SendMailResult> {
  const resetUrl = getResetPasswordUrl(rawToken);
  const { html, text } = buildPasswordResetEmail(resetUrl);

  return sendMail({
    to,
    subject: "Reset your RAGEN RESORT POS password",
    text,
    html,
  });
}
