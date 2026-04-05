import { SNSClient, PublishCommand, type SNSClientConfig } from '@aws-sdk/client-sns';

const REGION = 'us-west-1';

/**
 * Origination identity resource ID (AWS End User Messaging SMS / SNS).
 * Passed as the OriginationIdentity message attribute expected for SMS Publish.
 */
const DEFAULT_ORIGINATION_IDENTITY = 'phone-7750c1b13c8f4a2c85a50fd2ea3c5a4c';

/** Message attribute key for origination identity ID on SNS SMS Publish. */
const MSG_ATTR_ORIGINATION_IDENTITY = 'AWS.MM.SMS.OriginationIdentity';

/**
 * SMS delivery for the Intera app via Amazon SNS.
 * Uses transactional SMS type and a dedicated origination identity.
 */
export class SmsProvider {
  private readonly client: SNSClient;

  constructor(config?: SNSClientConfig) {
    this.client = new SNSClient({
      region: REGION,
      ...config,
    });
  }

  /**
   * Send a one-time verification code via SMS.
   *
   * @param to - Destination number (E.164 preferred, e.g. +15551234567)
   * @param code - Verification code to include in the message body
   */
  async sendVerificationSMS(to: string, code: string): Promise<void> {
    const phoneNumber = normalizeE164(to);
    const message = `Your Intera code is: ${code}`;

    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
        [MSG_ATTR_ORIGINATION_IDENTITY]: {
          DataType: 'String',
          StringValue: DEFAULT_ORIGINATION_IDENTITY,
        },
      },
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
