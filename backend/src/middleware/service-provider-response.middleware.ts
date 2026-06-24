import { NextFunction, Response } from 'express';
import { mapBarberToServiceProvider, mapBarbersToServiceProviders } from '../utils/service-provider.mapper';

type JsonBody = Record<string, unknown>;

function transformPayload(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;

  const payload = body as JsonBody;

  if (Array.isArray(payload.data)) {
    return {
      ...payload,
      data: mapBarbersToServiceProviders(payload.data as Record<string, unknown>[]),
    };
  }

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return {
      ...payload,
      data: mapBarberToServiceProvider(payload.data as Record<string, unknown>),
    };
  }

  return body;
}

/**
 * Wraps res.json so barber controller payloads are emitted as ServiceProvider DTOs.
 * Used by /api/v1/providers routes without duplicating barber query logic.
 */
export function transformServiceProviderJsonResponse(
  _req: unknown,
  res: Response,
  next: NextFunction
): void {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(transformPayload(body))) as Response['json'];
  next();
}
