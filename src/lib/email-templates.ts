/** Branded HTML email templates — inline CSS for Gmail compatibility. */

const COLORS = {
  emerald: "#047857",
  emeraldDark: "#064E3B",
  gold: "#D4AF37",
  goldDark: "#B8962E",
  white: "#FFFFFF",
  background: "#F8FAF7",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RAGEN RESORT POS</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${COLORS.white};border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(6,78,59,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.emeraldDark} 0%,${COLORS.emerald} 100%);padding:28px 32px;text-align:center;">
              <div style="width:48px;height:48px;line-height:48px;border-radius:50%;background-color:${COLORS.gold};color:${COLORS.emeraldDark};font-size:22px;font-weight:700;margin:0 auto 12px;">R</div>
              <h1 style="margin:0;color:${COLORS.white};font-size:22px;font-weight:700;letter-spacing:0.5px;">RAGEN RESORT POS</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Hospitality Management System</p>
              <div style="height:3px;width:64px;background-color:${COLORS.gold};margin:16px auto 0;border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:${COLORS.text};font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;background-color:#F3F6F4;border-top:1px solid ${COLORS.border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${COLORS.muted};">RAGEN RESORT POS — Secure hospitality operations</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background-color:${COLORS.gold};">
        <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;color:${COLORS.emeraldDark};font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function passwordBox(password: string, label = "Temporary password"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background-color:#F0FDF4;border:2px solid ${COLORS.emerald};border-radius:8px;">
    <tr>
      <td style="padding:16px 20px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:${COLORS.emerald};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:${COLORS.emeraldDark};font-family:ui-monospace,'Courier New',monospace;letter-spacing:2px;">${escapeHtml(password)}</p>
      </td>
    </tr>
  </table>`;
}

function securityNotice(text: string): string {
  return `<p style="margin:20px 0 0;padding:12px 16px;background-color:#FFFBEB;border-left:4px solid ${COLORS.gold};font-size:13px;color:#92400E;line-height:1.5;">${escapeHtml(text)}</p>`;
}

export type WelcomeEmailContent = {
  name: string;
  role: string;
  loginUrl: string;
  temporaryPassword: string;
};

export function buildWelcomeEmail(content: WelcomeEmailContent): { html: string; text: string } {
  const name = escapeHtml(content.name);
  const role = escapeHtml(content.role);
  const loginUrl = content.loginUrl;
  const password = content.temporaryPassword;

  const body = `
    <p style="margin:0 0 16px;font-size:16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">Welcome to <strong>RAGEN RESORT POS</strong>. An administrator has created your account.</p>
    <p style="margin:0 0 8px;"><strong style="color:${COLORS.emerald};">Role:</strong> ${role}</p>
    ${passwordBox(password)}
    ${ctaButton(loginUrl, "Sign in to RAGEN RESORT POS")}
    ${securityNotice("You must change this password immediately after your first login.")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLORS.muted};">Do not share this password with anyone.</p>
  `;

  const text = [
    `Hello ${content.name},`,
    "",
    "Welcome to RAGEN RESORT POS. An administrator has created your account.",
    "",
    `Role: ${content.role}`,
    `Sign in: ${loginUrl}`,
    `Temporary password: ${password}`,
    "",
    "You must change this password immediately after your first login.",
    "Do not share this password with anyone.",
    "",
    "— RAGEN RESORT POS — Secure hospitality operations",
  ].join("\n");

  return { html: wrapEmailLayout(body), text };
}

export function buildAdminTempPasswordEmail(content: WelcomeEmailContent): {
  html: string;
  text: string;
} {
  const name = escapeHtml(content.name);
  const role = escapeHtml(content.role);

  const body = `
    <p style="margin:0 0 16px;font-size:16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">An administrator has issued a new temporary password for your <strong>RAGEN RESORT POS</strong> account.</p>
    <p style="margin:0 0 8px;"><strong style="color:${COLORS.emerald};">Role:</strong> ${role}</p>
    ${passwordBox(content.temporaryPassword, "New temporary password")}
    ${ctaButton(content.loginUrl, "Sign in now")}
    ${securityNotice("You must change this password immediately after your next login.")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLORS.muted};">Do not share this password with anyone.</p>
  `;

  const text = [
    `Hello ${content.name},`,
    "",
    "Your RAGEN RESORT POS temporary password has been reset by an administrator.",
    "",
    `Role: ${content.role}`,
    `Sign in: ${content.loginUrl}`,
    `Temporary password: ${content.temporaryPassword}`,
    "",
    "You must change this password immediately after your next login.",
    "Do not share this password with anyone.",
    "",
    "— RAGEN RESORT POS — Secure hospitality operations",
  ].join("\n");

  return { html: wrapEmailLayout(body), text };
}

export function buildPasswordResetEmail(resetUrl: string): { html: string; text: string } {
  const body = `
    <p style="margin:0 0 16px;font-size:16px;">Hello,</p>
    <p style="margin:0 0 16px;">We received a request to reset your <strong>RAGEN RESORT POS</strong> password.</p>
    ${ctaButton(resetUrl, "Reset your password")}
    <p style="margin:0 0 8px;font-size:13px;color:${COLORS.muted};">This link expires in <strong>30 minutes</strong>.</p>
    <p style="margin:0 0 8px;font-size:13px;color:${COLORS.muted};">If the button does not work, copy this link:</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:${COLORS.emerald};">${escapeHtml(resetUrl)}</p>
    ${securityNotice("If you did not request this reset, you can ignore this email.")}
  `;

  const text = [
    "Hello,",
    "",
    "We received a request to reset your RAGEN RESORT POS password.",
    "",
    `Reset your password (expires in 30 minutes):`,
    resetUrl,
    "",
    "If you did not request this reset, you can ignore this email.",
    "",
    "— RAGEN RESORT POS — Secure hospitality operations",
  ].join("\n");

  return { html: wrapEmailLayout(body), text };
}
