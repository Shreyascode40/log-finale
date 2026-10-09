/**
 * Email delivery abstraction.
 *
 * Development default is the "console" provider: the message (including the
 * verification / reset link) is printed to the server log, so the whole flow is
 * testable without SMTP credentials. Real providers are wired in F17.
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

  // Real providers arrive in F17 (Resend via REST, Nodemailer for SMTP).
  throw new Error(
    `EMAIL_PROVIDER="${provider}" is not configured yet. Set EMAIL_PROVIDER="console" for development.`,
  );
}
