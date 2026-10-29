/**
 * Email delivery abstraction.
 *
 * Providers (EMAIL_PROVIDER):
 *   - "console" (development default): prints to the server log, so the whole
 *     flow is testable without SMTP credentials.
 *   - "noop": silently discards (tests).
 *   - "resend": Resend REST API (needs RESEND_API_KEY, EMAIL_FROM).
 *   - "smtp": any SMTP server via Nodemailer (needs SMTP_HOST/PORT/USER/
 *     PASSWORD, EMAIL_FROM).
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function emailProvider(): string {
  return process.env.EMAIL_PROVIDER || "console";
}

export function isConsoleProvider(): boolean {
  return emailProvider() === "console";
}

/**
 * Dev-like providers (console, noop) do not actually deliver mail, so the auth
 * service may echo the verification / reset link back for testing and demos.
 */
export function exposesDevLinks(): boolean {
  const provider = emailProvider();
  return provider === "console" || provider === "noop";
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const provider = emailProvider();

  if (provider === "noop") return;

  if (provider === "console") {
    console.info(
      [
        "",
        "─────────────────────────── DEV EMAIL ───────────────────────────",
        `To:      ${input.to}`,
        `Subject: ${input.subject}`,
        "",
        input.text,
        "─────────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }

  if (provider === "resend") return sendViaResend(input);
  if (provider === "smtp") return sendViaSmtp(input);

  throw new Error(
    `EMAIL_PROVIDER="${provider}" is unknown. Use "console", "noop", "resend" or "smtp".`,
  );
}

function fromAddress(): string {
  const from = process.env.EMAIL_FROM ?? "";
  if (!from) throw new Error('Set EMAIL_FROM (e.g. "Digital BE Log Book <no-reply@example.com>").');
  return from;
}

/** Resend REST API — no extra dependency, plain fetch. */
async function sendViaResend(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  if (!apiKey) throw new Error('Set RESEND_API_KEY to use EMAIL_PROVIDER="resend".');
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the email (${response.status}): ${detail.slice(0, 200)}`);
  }
}

/** Any SMTP server via Nodemailer. */
async function sendViaSmtp(input: SendEmailInput): Promise<void> {
  const host = process.env.SMTP_HOST ?? "";
  if (!host) throw new Error('Set SMTP_HOST (and SMTP_PORT/USER/PASSWORD) to use EMAIL_PROVIDER="smtp".');
  const { default: nodemailer } = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: (process.env.SMTP_PORT ?? "587") === "465",
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER ?? "", pass: process.env.SMTP_PASSWORD ?? "" }
        : undefined,
  });
  await transporter.sendMail({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
