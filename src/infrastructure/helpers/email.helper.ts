import nodemailer from 'nodemailer';

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

function smtpConfigOrNull(): null | {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
} {
  const host = String(process.env.SMTP_HOST ?? '').trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = String(process.env.SMTP_SECURE ?? '').trim() === '1';
  const user = String(process.env.SMTP_USER ?? '').trim() || undefined;
  const pass = String(process.env.SMTP_PASS ?? '').trim() || undefined;
  const from =
    String(process.env.SMTP_FROM ?? '').trim() ||
    (user ? user : 'no-reply@localhost');
  return { host, port, secure, user, pass, from };
}

export function isEmailConfigured(): boolean {
  return smtpConfigOrNull() !== null;
}

export async function sendEmail({ to, subject, text }: SendEmailInput) {
  const cfg = smtpConfigOrNull();
  if (!cfg) {
    throw new Error(
      'SMTP não configurado (defina SMTP_HOST/SMTP_PORT/SMTP_FROM)',
    );
  }
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth:
      cfg.user && cfg.pass
        ? {
            user: cfg.user,
            pass: cfg.pass,
          }
        : undefined,
  });
  await transport.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
  });
}
