import * as nodemailerNs from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";

// Nodemailer is CommonJS. In ESM mode with verbatimModuleSyntax + NodeNext,
// a namespace import (`* as`) always resolves cleanly — the real runtime
// value lives on `.default` when Node wraps it, or on the namespace directly
// when tsx's loader handles it. Resolve the shape once here.
const nodemailer: typeof nodemailerNs =
  "createTransport" in nodemailerNs
    ? nodemailerNs
    : ((nodemailerNs as unknown as { default: typeof nodemailerNs }).default ?? nodemailerNs);

export interface SendMailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

const getMailerConfig = () => {
  const user = process.env.MAILER_USER;
  const pass = process.env.MAILER_PASS;
  const host = process.env.MAILER_HOST ?? "smtp.gmail.com";
  const portRaw = process.env.MAILER_PORT ?? "465";
  const port = Number(portRaw);
  const secure = (process.env.MAILER_SECURE ?? "true") === "true";

  if (!user || !pass) {
    console.warn(
      "⚠️  MAILER_USER or MAILER_PASS missing in .env. Emails will NOT be sent. " +
        "Configure Gmail credentials to enable real email delivery."
    );
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass: pass.replace(/\s+/g, ""), // strip spaces from 16-char App Password
    },
  } as const;
};

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  const cfg = getMailerConfig();
  if (!cfg) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.auth,
    });
  }
  return transporter;
};

/**
 * Verify SMTP connection on startup. Called once from server.ts after DB connect.
 */
export const verifyMailer = async (): Promise<boolean> => {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.verify();
    console.log("✅ Email SMTP connection ready (Gmail)");
    return true;
  } catch (err) {
    console.error("❌ Email SMTP connection FAILED:", err);
    console.error(
      "   → Check MAILER_USER, MAILER_PASS in .env. Ensure:\n" +
      "     1. 2-Step Verification is ON for the Gmail account\n" +
      "     2. You generated an App Password at https://myaccount.google.com/apppasswords\n" +
      "     3. Less secure app access is NOT needed (App Passwords bypass it)\n" +
      "     4. If on a corporate network, port 465/587 outbound is open"
    );
    return false;
  }
};

export const sendMail = async (params: SendMailParams): Promise<void> => {
  const { to, toName, subject, html, text } = params;
  const t = getTransporter();

  if (!t) {
    throw new Error(
      "Mailer not configured — set MAILER_USER and MAILER_PASS in .env"
    );
  }

  const fromName = process.env.MAILER_FROM_NAME ?? "FPI Admin Portal";
  const fromUser = process.env.MAILER_USER!;

  const mail: SendMailOptions = {
    from: `"${fromName}" <${fromUser}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, ""), // plaintext fallback generated from HTML
  };

  const info = await t.sendMail(mail);
  console.log(`📧 Email sent via Gmail → ${to} (msgid: ${info.messageId})`);
};