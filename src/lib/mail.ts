import nodemailer from "nodemailer";

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
  html?: string;
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
      html: options.html ?? options.text.replace(/\n/g, "<br>"),
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
  data: { name: string; role: string; loginUrl: string; temporaryPassword: string }
): Promise<SendMailResult> {
  return sendMail({
    to,
    subject: "Welcome to RAGEN RESORT POS",
    text: [
      `Hello ${data.name},`,
      "",
      "An administrator created your RAGEN RESORT POS account.",
      "",
      `Role: ${data.role}`,
      `Login URL: ${data.loginUrl}`,
      `Temporary password: ${data.temporaryPassword}`,
      "",
      "You must change this password immediately after your first login.",
      "Do not share this password.",
      "",
      "— RAGEN RESORT POS",
    ].join("\n"),
    html: `
      <p>Hello <strong>${data.name}</strong>,</p>
      <p>Your <strong>RAGEN RESORT POS</strong> account is ready.</p>
      <p><strong>Role:</strong> ${data.role}</p>
      <p><strong>Login:</strong> <a href="${data.loginUrl}">${data.loginUrl}</a></p>
      <p><strong>Temporary password:</strong> <code>${data.temporaryPassword}</code></p>
      <p><strong>You must change this password immediately after your first login.</strong></p>
      <p>Do not share this password.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendMailResult> {
  const business = process.env.EMAIL_FROM?.includes("<")
    ? "RAGEN RESORT POS"
    : "RAGEN RESORT POS";

  return sendMail({
    to,
    subject: `${business} — Password reset`,
    text: [
      "You requested a password reset for your RAGEN RESORT POS account.",
      "",
      "Reset your password using this link (expires in 30 minutes):",
      resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
      "",
      "— RAGEN RESORT POS",
    ].join("\n"),
    html: `
      <p>You requested a password reset for your <strong>RAGEN RESORT POS</strong> account.</p>
      <p><a href="${resetUrl}">Reset your password</a> (link expires in 30 minutes).</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
