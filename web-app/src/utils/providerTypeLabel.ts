import { UNCLEAR_OPERATOR_TYPE } from '../types/service-provider';

/** Display label for an operator's provider_type (barber | beauty | unclear). */
export function providerTypeDisplayLabel(raw: string | null | undefined): string {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'beauty') return 'Beauty';
  if (value === 'barber') return 'Barber';
  if (!value || value === 'unclear' || value === UNCLEAR_OPERATOR_TYPE.toLowerCase()) {
    return UNCLEAR_OPERATOR_TYPE;
  }
  return UNCLEAR_OPERATOR_TYPE;
}

export function isClearProviderType(raw: string | null | undefined): raw is 'barber' | 'beauty' {
  const value = (raw || '').trim().toLowerCase();
  return value === 'barber' || value === 'beauty';
}
