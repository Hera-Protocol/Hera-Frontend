/**
 * Transactional email in Hera's paper-and-ink look. Table layout and inline
 * CSS only, so Outlook and Gmail render it; no images, so nothing is hotlinked
 * and nothing is blocked. Every template has a plain-text twin.
 */
import type { AlertDto, ReportDto, Role } from "@hera/core";

export interface RenderedEmail {
  tag: string;
  subject: string;
  html: string;
  text: string;
}

const PAPER = "#FFF5E8";
const INK = "#17130F";
const SUN = "#FFC93C";
const MUTED = "#5C5348";
const FONT = "'Bricolage Grotesque','DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'DM Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const ROLE_LABEL: Record<Role, string> = { owner: "an owner", admin: "an admin", analyst: "an analyst", viewer: "a viewer" };

interface LayoutInput {
  preheader: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Small print under the button, e.g. expiry. */
  footnote?: string;
  /** Raw HTML block (already escaped) between paragraphs and the button. */
  extra?: string;
}

function wordmark(): string {
  // An ink square beside a bold wordmark: survives every client, no images.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="width:18px;height:18px;background:${INK};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
<td style="padding-left:8px;font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${INK};line-height:18px;">hera</td>
</tr></table>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;"><tr>
<td style="background:${SUN};border:2px solid ${INK};border-radius:10px;">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function layout(input: LayoutInput): string {
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:22px;color:${INK};">${p}</p>`)
    .join("\n");
  const cta = input.button
    ? `${button(input.button.label, input.button.url)}
<p style="margin:12px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Button not working? Paste this into your browser:<br><span style="font-family:${MONO};word-break:break-all;">${escapeHtml(input.button.url)}</span></p>`
    : "";
  const footnote = input.footnote ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${input.footnote}</p>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 0 18px;">${wordmark()}</td></tr>
<tr><td style="background:#FFFFFF;border:2px solid ${INK};border-radius:14px;padding:28px 28px 24px;">
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:28px;font-weight:800;color:${INK};">${escapeHtml(input.heading)}</h1>
${paragraphs}
${input.extra ?? ""}
${cta}
${footnote}
</td></tr>
<tr><td style="padding:18px 4px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Hera · Compliance for Stellar and EVM chains<br>You're getting this because of activity on your Hera account.</td></tr>
</table></td></tr></table>
</body></html>`;
}

function text(lines: (string | undefined)[]): string {
  return `${lines.filter((l) => l !== undefined).join("\n\n")}\n\n—\nHera · Compliance for Stellar and EVM chains\n`;
}

/* ─── Templates ──────────────────────────────────────── */

export function verifyEmail(input: { name: string; url: string }): RenderedEmail {
  return {
    tag: "verify-email",
    subject: "Confirm your email for Hera",
    html: layout({
      preheader: "One click and you're verified.",
      heading: "Confirm your email",
      paragraphs: [`Hi ${escapeHtml(input.name)}, thanks for signing up. Confirm this address so we can reach you about alerts and reports.`],
      button: { label: "Confirm email", url: input.url },
      footnote: "The link works for 24 hours. If you didn't sign up for Hera, ignore this email.",
    }),
    text: text([
      `Hi ${input.name}, thanks for signing up for Hera.`,
      `Confirm your email: ${input.url}`,
      "The link works for 24 hours. If you didn't sign up, ignore this email.",
    ]),
  };
}

export function passwordReset(input: { url: string }): RenderedEmail {
  return {
    tag: "password-reset",
    subject: "Reset your Hera password",
    html: layout({
      preheader: "Choose a new password.",
      heading: "Reset your password",
      paragraphs: ["Someone (hopefully you) asked to reset the password on this Hera account. Choose a new one below and every existing session will be signed out."],
      button: { label: "Choose a new password", url: input.url },
      footnote: "The link works for 1 hour. If you didn't ask for this, you can ignore it: your password won't change.",
    }),
    text: text([
      "Someone (hopefully you) asked to reset your Hera password.",
      `Choose a new one: ${input.url}`,
      "The link works for 1 hour. If you didn't ask for this, ignore it and your password won't change.",
    ]),
  };
}

export function teamInvite(input: { inviter: string; orgName: string; role: Role; url: string }): RenderedEmail {
  const role = ROLE_LABEL[input.role];
  return {
    tag: "team-invite",
    subject: `${input.inviter} invited you to ${input.orgName} on Hera`,
    html: layout({
      preheader: `Join ${input.orgName} as ${role}.`,
      heading: `Join ${input.orgName} on Hera`,
      paragraphs: [`${escapeHtml(input.inviter)} invited you to join <strong>${escapeHtml(input.orgName)}</strong> as ${role}.`],
      button: { label: "Accept invite", url: input.url },
      footnote: "The invite expires in 7 days. Not expecting it? Ignore this email and nothing happens.",
    }),
    text: text([
      `${input.inviter} invited you to join ${input.orgName} on Hera as ${role}.`,
      `Accept the invite: ${input.url}`,
      "The invite expires in 7 days. Not expecting it? Ignore this email.",
    ]),
  };
}

const SEVERITY_COLOR: Record<AlertDto["severity"], string> = { low: "#137A4A", medium: "#9A5C00", high: "#C2410C", critical: "#B91C1C" };

export function alertNotification(input: { orgName: string; alerts: AlertDto[]; url: string }): RenderedEmail {
  const [first] = input.alerts;
  const count = input.alerts.length;
  const subject =
    count === 1 ? `[${first!.severity.toUpperCase()}] ${first!.title}: ${first!.subjectDisplay}` : `${count} new high-risk alerts in ${input.orgName}`;
  const rows = input.alerts
    .slice(0, 10)
    .map(
      (a) => `<tr>
<td style="padding:8px 10px;border-top:1px solid ${INK};font-family:${FONT};font-size:12px;font-weight:700;color:${SEVERITY_COLOR[a.severity]};text-transform:uppercase;white-space:nowrap;">${a.severity}</td>
<td style="padding:8px 10px;border-top:1px solid ${INK};font-family:${FONT};font-size:14px;color:${INK};">${escapeHtml(a.title)}<br><span style="font-family:${MONO};font-size:12px;color:${MUTED};">${escapeHtml(a.walletLabel ?? a.subjectDisplay)}</span></td>
</tr>`,
    )
    .join("\n");
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${INK};border-radius:10px;margin:4px 0 16px;border-collapse:separate;">${rows}</table>`;
  return {
    tag: "alert",
    subject,
    html: layout({
      preheader: `${count} new alert${count === 1 ? "" : "s"} need a look.`,
      heading: count === 1 ? "New alert on a watched wallet" : `${count} new alerts on watched wallets`,
      paragraphs: [`Hera raised ${count === 1 ? "an alert" : `${count} alerts`} in <strong>${escapeHtml(input.orgName)}</strong> that ${count === 1 ? "needs" : "need"} review.`],
      extra: table,
      button: { label: "Review alerts", url: input.url },
      footnote: "You get these for high and critical alerts. Turn them off under Settings → Notifications.",
    }),
    text: text([
      `Hera raised ${count} alert${count === 1 ? "" : "s"} in ${input.orgName}:`,
      input.alerts
        .slice(0, 10)
        .map((a) => `- [${a.severity.toUpperCase()}] ${a.title} (${a.walletLabel ?? a.subjectDisplay})`)
        .join("\n"),
      `Review them: ${input.url}`,
      "You get these for high and critical alerts. Turn them off under Settings → Notifications.",
    ]),
  };
}

export function reportReady(input: { name: string; report: ReportDto; url: string }): RenderedEmail {
  const { report } = input;
  return {
    tag: "report-ready",
    subject: `Your report is ready: ${report.title}`,
    html: layout({
      preheader: `${report.reference} is ready to download.`,
      heading: "Your report is ready",
      paragraphs: [
        `Hi ${escapeHtml(input.name)}, <strong>${escapeHtml(report.title)}</strong> has finished rendering.`,
        `Reference <span style="font-family:${MONO};">${escapeHtml(report.reference)}</span>. Its SHA-256 is printed on every page, so anyone you share it with can check it's genuine.`,
      ],
      button: { label: "Open report", url: input.url },
    }),
    text: text([`Hi ${input.name}, ${report.title} (${report.reference}) has finished rendering.`, `Open it: ${input.url}`]),
  };
}
