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
 * SMS for the Intera app via AWS End User Messaging (Pinpoint SMS Voice v2) — Notify text API.
 * Message body comes from the Notify template in AWS (e.g. "Your Intera verification code is: {otp}").
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
   * @param code - Substituted for template variable `otp` (must match your Notify template)
   */
  async sendVerificationSMS(to: string, code: string): Promise<void> {
    const command = new SendNotifyTextMessageCommand({
      NotifyConfigurationId: notifyConfigurationId(),
      DestinationPhoneNumber: normalizeE164(to),
      TemplateVariables: { otp: code },
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
