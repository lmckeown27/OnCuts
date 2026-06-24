type JsonRecord = Record<string, unknown>;

function resolveBarberRecordId(record: JsonRecord): string | null {
  if (typeof record.barberId === 'string' && record.barberId) return record.barberId;
  if (typeof record.barber_id === 'string' && record.barber_id) return record.barber_id;
  if (typeof record.barberRecordId === 'string' && record.barberRecordId) return record.barberRecordId;
  if (typeof record.recordId === 'string' && record.recordId) return record.recordId;
  if (typeof record.id === 'string' && record.id && record.userType === 'barber') return record.id;
  return null;
}

/** Recursively add providerId / provider_id alongside barberId / barber_id in JSON payloads. */
export function addProviderIdAliases(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(addProviderIdAliases);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as JsonRecord;
  const out: JsonRecord = {};

  for (const [key, val] of Object.entries(record)) {
    out[key] = addProviderIdAliases(val);
  }

  const barberRecordId = resolveBarberRecordId(record);
  if (barberRecordId) {
    if (out.providerId == null && ('barberId' in record || 'barberRecordId' in record)) {
      out.providerId = barberRecordId;
    }
    if (out.provider_id == null && 'barber_id' in record) {
      out.provider_id = barberRecordId;
    }
  }

  const nestedBarber = out.barber;
  if (nestedBarber && typeof nestedBarber === 'object') {
    const barberObj = nestedBarber as JsonRecord;
    const nestedId = resolveBarberRecordId(barberObj);
    if (nestedId && barberObj.providerId == null) {
      barberObj.providerId = nestedId;
    }
  }

  const barberInfo = out.barberInfo;
  if (barberInfo && typeof barberInfo === 'object') {
    const info = barberInfo as JsonRecord;
    if (typeof info.id === 'string' && info.id && info.providerId == null) {
      info.providerId = info.id;
    }
  }

  const booking = out.booking;
  if (booking && typeof booking === 'object') {
    const bookingObj = booking as JsonRecord;
    const bookingBarberId = resolveBarberRecordId(bookingObj);
    if (bookingBarberId && bookingObj.providerId == null) {
      bookingObj.providerId = bookingBarberId;
    }
  }

  return out;
}

export function normalizeProviderIdOnRequest(req: {
  body?: JsonRecord;
  query?: JsonRecord;
  params?: JsonRecord;
}): void {
  if (req.body && typeof req.body === 'object') {
    if (!req.body.barberId && req.body.providerId) {
      req.body.barberId = req.body.providerId;
    }
    if (!req.body.barber_id && req.body.provider_id) {
      req.body.barber_id = req.body.provider_id;
    }
  }

  if (req.query && typeof req.query === 'object') {
    if (!req.query.barberId && req.query.providerId) {
      req.query.barberId = req.query.providerId;
    }
  }

  if (req.params && typeof req.params === 'object') {
    if (!req.params.barberId && req.params.providerId) {
      req.params.barberId = req.params.providerId;
    }
  }
}
