import {
  PinpointSMSVoiceV2Client,
  SendNotifyTextMessageCommand,
  type PinpointSMSVoiceV2ClientConfig,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';

const REGION = 'us-west-1';

/** Notify configuration ID (End User Messaging). Override with INTERA_NOTIFY_CONFIGURATION_ID. */
const DEFAULT_NOTIFY_CONFIGURATION_ID = 'notify-cb19ae925d014cdba7b540cca202f72d';

function notifyConfigurationId(): string {
  return process.env.INTERA_NOTIFY_CONFIGURATION_ID?.trim() || DEFAULT_NOTIFY_CONFIGURATION_ID;
}

/**
 * SMS template id for SendNotifyTextMessage (required by AWS; variables are validated per template).
 * AWS docs / CLI use e.g. `notify-code-verification-english-001`. List yours:
 * `aws pinpoint-sms-voice-v2 describe-notify-templates --region us-west-1`
 */
function notifyTemplateId(): string {
  const id = process.env.INTERA_NOTIFY_TEMPLATE_ID?.trim();
  if (id && id.length > 0) return id;
  /** Default for CODE_VERIFICATION SMS per AWS End User Messaging Notify getting-started examples. */
  return 'notify-code-verification-english-001';
}

/**
 * Key in `TemplateVariables` for the 6-digit code — must match that template’s placeholder (often `code`).
 * AWS examples use `code`, not `otp`.
 */
function otpTemplateKey(): string {
  const k = process.env.INTERA_NOTIFY_TEMPLATE_OTP_KEY?.trim();
  return k && k.length > 0 ? k : 'code';
}

/**
 * SMS for the Intera app via AWS End User Messaging (Pinpoint SMS Voice v2) — Notify text API.
 * Message body comes from the Notify template selected by INTERA_NOTIFY_TEMPLATE_ID.
 */
export class SmsProvider {
  private readonly client: PinpointSMSVoiceV2Client;

  constructor(config?: PinpointSMSVoiceV2ClientConfig) {
    this.client = new PinpointSMSVoiceV2Client({
      region: REGION,
      ...config,
    });
  }

  /**
   * Send a one-time verification code via SMS.
   *
   * @param to - Destination number (E.164 preferred, e.g. +15551234567)
   * @param code - Substituted under key `INTERA_NOTIFY_TEMPLATE_OTP_KEY` (default `code`); must match template.
   */
  async sendVerificationSMS(to: string, code: string): Promise<void> {
    const key = otpTemplateKey();
    const command = new SendNotifyTextMessageCommand({
      NotifyConfigurationId: notifyConfigurationId(),
      TemplateId: notifyTemplateId(),
      DestinationPhoneNumber: normalizeE164(to),
      TemplateVariables: { [key]: code },
    });

    await this.client.send(command);
  }
}

/** Best-effort E.164: pass through if already +…, else strip non-digits and prefix +. */
function normalizeE164(to: string): string {
  const trimmed = to.trim();
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) {
    throw new Error('Invalid phone number');
  }
  return `+${digits}`;
}
