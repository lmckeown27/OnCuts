import { NextFunction, Request, Response } from 'express';
import { addProviderIdAliases, normalizeProviderIdOnRequest } from '../utils/provider-id-alias.utils';

/** Accept providerId / provider_id as aliases for barberId / barber_id on incoming requests. */
export function normalizeProviderIdRequest(req: Request, _res: Response, next: NextFunction): void {
  normalizeProviderIdOnRequest(req);
  next();
}

/** Append providerId aliases to booking and messaging JSON responses. */
export function appendProviderIdAliasResponse(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(addProviderIdAliases(body))) as Response['json'];
  next();
}
