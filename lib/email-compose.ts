/**
 * Gmail compose in the browser. Windows `mailto:` often opens Mail/Outlook,
 * which sends through Gmail SMTP without a Message-ID — Colliers and other
 * Mimecast/M365 gateways reject that as `550 5.7.0 Policy Violation: Missing Header`.
 */
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ view: "cm", fs: "1", su: subject, body });
  if (to) params.set("to", to);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  const mailBody = body.replace(/\n/g, "\r\n");
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
  return to ? `mailto:${to}?${q}` : `mailto:?${q}`;
}
