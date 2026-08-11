import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import {
  applyBookingOgTags,
  bookingLinkCopy,
  bookingOgImageUrl,
  bookingOgJpeg,
  fallbackBookingHtml,
  isBookingLinkBarberId,
  loadBookingLinkOgTarget,
  loadSpaIndexHtml,
  ogImageCacheKey,
  publicOriginFromRequest,
} from '../services/booking-link-og.service';

function stripHelmetHtmlGuards(res: Response): void {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Content-Security-Policy-Report-Only');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  res.removeHeader('Origin-Agent-Cluster');
}

/**
 * SPA booking page with per-operator Open Graph tags for iMessage / SMS unfurls.
 * GET /web/consumer/book/:barberId  and  GET /app/consumer/book/:barberId
 */
export const serveBookingLinkPage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const barberId = String(req.params.barberId || '').trim();
    if (!isBookingLinkBarberId(barberId)) {
      return next();
    }

    const origin = publicOriginFromRequest(req);
    const pageUrl = `${origin}${req.originalUrl.split('?')[0]}`;
    const target = await loadBookingLinkOgTarget(barberId);
    const copy = bookingLinkCopy(target);
    const imageUrl = bookingOgImageUrl(origin, barberId, ogImageCacheKey(target));

    stripHelmetHtmlGuards(res);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');

    const spa = loadSpaIndexHtml();
    if (!spa) {
      logger.warn('FRONTEND_DIST index.html not found; serving OG-only HTML for booking link');
    }
    const html = spa
      ? applyBookingOgTags(spa, {
          pageUrl,
          title: copy.title,
          description: copy.description,
          imageUrl,
        })
      : fallbackBookingHtml({
          pageUrl,
          title: copy.title,
          description: copy.description,
          imageUrl,
        });

    return res.status(200).send(html);
  } catch (error) {
    logger.error('Booking-link OG HTML failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      const origin = publicOriginFromRequest(req);
      const barberId = String(req.params.barberId || '').trim() || 'unknown';
      stripHelmetHtmlGuards(res);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(
        fallbackBookingHtml({
          pageUrl: `${origin}${req.originalUrl.split('?')[0]}`,
          title: 'OnCuts',
          description:
            'Fair prices for students, great earnings for barbers. Book haircuts on campus with transparent pricing and instant payments.',
          imageUrl: bookingOgImageUrl(origin, barberId, 'logo'),
        })
      );
    } catch {
      return next(error);
    }
  }
};

/**
 * JPEG preview image for crawlers. Profile photo when set, otherwise OnCuts logo.
 * GET /api/v1/og/booking-image/:barberId
 */
export const serveBookingLinkOgImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const barberId = String(req.params.barberId || '').trim();
    const origin = publicOriginFromRequest(req);
    const target = isBookingLinkBarberId(barberId)
      ? await loadBookingLinkOgTarget(barberId)
      : null;
    const jpeg = await bookingOgJpeg(target, origin);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(jpeg);
  } catch (error) {
    logger.error('Booking-link OG image failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return next(error);
  }
};
