/**
 * Google Calendar Service — DISABLED
 *
 * Integration commented out. Restore implementation from git history and
 * re-enable routes in `backend/src/index.ts` to turn this back on.
 */

export function createOAuth2Client(): never {
  throw new Error('Google Calendar integration is disabled');
}

export function generateAuthUrl(_barberUserId: string): string {
  throw new Error('Google Calendar integration is disabled');
}

export async function handleOAuthCallback(
  _code: string,
  _barberUserId: string
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Google Calendar integration is disabled' };
}

export async function getAuthenticatedClient(_barberId: string): Promise<never> {
  throw new Error('Google Calendar integration is disabled');
}

export async function isCalendarConnected(_barberId: string): Promise<boolean> {
  return false;
}

export async function disconnectCalendar(_barberId: string): Promise<void> {
  return;
}

export async function getBusyTimes(
  _barberId: string,
  _startDate: Date,
  _endDate: Date
): Promise<Array<{ start: Date; end: Date }>> {
  return [];
}

export async function addBookingToCalendar(
  _barberId: string,
  _booking: {
    id: string;
    consumerName: string;
    serviceName: string;
    scheduledDate: Date;
    durationMinutes: number;
    location?: string;
  }
): Promise<string | null> {
  return null;
}

export async function removeBookingFromCalendar(
  _barberId: string,
  _googleEventId: string
): Promise<boolean> {
  return false;
}

export default {
  generateAuthUrl,
  handleOAuthCallback,
  isCalendarConnected,
  disconnectCalendar,
  getBusyTimes,
  addBookingToCalendar,
  removeBookingFromCalendar,
};

/*
 * --- Original implementation (disabled) ---
 * See git history for googleapis OAuth, freebusy query, and calendar event sync.
 */
