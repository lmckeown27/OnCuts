const TEAM_CONTACT_EMAIL = 'liam.mckeown38415@gmail.com';

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

const MICROSOFT_DOMAINS = new Set([
  'outlook.com',
  'outlook.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'msn.com',
  'passport.com',
]);

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

function isGmailAddress(domain: string): boolean {
  return GMAIL_DOMAINS.has(domain);
}

function isMicrosoftAddress(domain: string): boolean {
  return MICROSOFT_DOMAINS.has(domain) || domain.endsWith('.edu');
}

/**
 * Pick a compose destination from the sender's email domain so Gmail users
 * open Gmail (not Outlook/mailto default), Microsoft/.edu open Outlook web,
 * and everyone else gets a mailto draft.
 */
export function buildContactComposeUrl(options: {
  senderEmail: string;
  senderName: string;
  message: string;
}): string {
  const { senderEmail, senderName, message } = options;
  const to = TEAM_CONTACT_EMAIL;
  const subject = `OnCuts Team Interest from ${senderName}`;
  const body = `Dear OnCuts Team.\n\n${message}\n\nFrom ${senderName}`;
  const domain = emailDomain(senderEmail);

  if (isGmailAddress(domain)) {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      tf: '1',
      to,
      su: subject,
      body,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }

  if (isMicrosoftAddress(domain)) {
    const params = new URLSearchParams({
      to,
      subject,
      body,
    });
    // Consumer Microsoft domains use live; school/work (.edu) use office.
    const host = domain.endsWith('.edu')
      ? 'https://outlook.office.com'
      : 'https://outlook.live.com';
    return `${host}/mail/0/deeplink/compose?${params.toString()}`;
  }

  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openContactCompose(url: string): void {
  // Always open in a new tab/window so the landing page stays put.
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return;

  // Popup blocked: fall back to a temporary link that still targets a new tab.
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
