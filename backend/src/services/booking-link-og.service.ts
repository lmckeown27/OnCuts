import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { Request } from 'express';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_TITLE = 'OnCuts';
const DEFAULT_DESCRIPTION =
  'Fair prices for students, great earnings for barbers. Book haircuts on campus with transparent pricing and instant payments.';

export type BookingLinkOgTarget = {
  barberId: string;
  name: string;
  avatarUrl: string | null;
  isBanned: boolean;
};

let cachedLogoJpeg: Buffer | null = null;

export function isBookingLinkBarberId(value: string): boolean {
  return UUID_RE.test(value);
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function publicOriginFromRequest(req: Request): string {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = forwardedProto || req.protocol || 'https';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || req.get('host') || 'oncuts.com';
  return `${proto}://${host}`.replace(/\/$/, '');
}

export async function loadBookingLinkOgTarget(
  barberId: string
): Promise<BookingLinkOgTarget | null> {
  const result = await pool.query(
    `SELECT
       b.id,
       u."displayName" AS display_name,
       u.first_name,
       u.last_name,
       u."avatarUrl" AS avatar_url,
       u."isBanned" AS is_banned
     FROM barbers b
     JOIN users u ON b."userId" = u.id
     WHERE b.id = $1
     LIMIT 1`,
    [barberId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const name =
    String(row.display_name || '').trim() ||
    `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
    'OnCuts';
  const avatar = String(row.avatar_url || '').trim();
  return {
    barberId: String(row.id),
    name,
    avatarUrl: avatar || null,
    isBanned: row.is_banned === true,
  };
}

export function ogImageCacheKey(target: BookingLinkOgTarget | null): string {
  if (!target || target.isBanned || !target.avatarUrl) return 'logo';
  return crypto.createHash('sha1').update(target.avatarUrl).digest('hex').slice(0, 12);
}

export function bookingOgImageUrl(
  origin: string,
  barberId: string,
  cacheKey: string
): string {
  return `${origin}/api/v1/og/booking-image/${barberId}?v=${encodeURIComponent(cacheKey)}`;
}

function absolutizeAvatarUrl(avatarUrl: string, origin: string): string {
  const trimmed = avatarUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
}

function frontendDistCandidates(): string[] {
  const fromEnv = process.env.FRONTEND_DIST?.trim();
  return [
    fromEnv,
    '/var/www/oncuts/dist',
    path.resolve(process.cwd(), '../web-app/dist'),
    path.resolve(process.cwd(), '../../web-app/dist'),
    path.resolve(__dirname, '../../../web-app/dist'),
    path.resolve(__dirname, '../../../../web-app/dist'),
  ].filter((p): p is string => Boolean(p));
}

function readFirstExistingFile(paths: string[]): Buffer | null {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return fs.readFileSync(filePath);
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function loadSpaIndexHtml(): string | null {
  const html = readFirstExistingFile(
    frontendDistCandidates().map((dir) => path.join(dir, 'index.html'))
  );
  return html ? html.toString('utf8') : null;
}

async function logoJpeg(): Promise<Buffer> {
  if (cachedLogoJpeg) return cachedLogoJpeg;
  const png = readFirstExistingFile([
    ...frontendDistCandidates().map((dir) => path.join(dir, 'icon-512x512.png')),
    path.resolve(process.cwd(), '../web-app/public/icon-512x512.png'),
    path.resolve(__dirname, '../../../web-app/public/icon-512x512.png'),
  ]);
  if (!png) {
    cachedLogoJpeg = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 90, g: 114, b: 104 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();
    return cachedLogoJpeg;
  }
  cachedLogoJpeg = await sharp(png)
    .rotate()
    .resize(800, 800, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();
  return cachedLogoJpeg;
}

async function fetchAvatarJpeg(avatarUrl: string, origin: string): Promise<Buffer | null> {
  const absolute = absolutizeAvatarUrl(avatarUrl, origin);
  if (!absolute) return null;
  try {
    const response = await axios.get<ArrayBuffer>(absolute, {
      responseType: 'arraybuffer',
      timeout: 5000,
      maxContentLength: 8 * 1024 * 1024,
      headers: { Accept: 'image/*,*/*' },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    const input = Buffer.from(response.data);
    return await sharp(input)
      .rotate()
      .resize(800, 800, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (error) {
    logger.warn('Booking-link OG avatar fetch/convert failed; using OnCuts logo', {
      avatarUrl: absolute,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function bookingOgJpeg(
  target: BookingLinkOgTarget | null,
  origin: string
): Promise<Buffer> {
  if (target && !target.isBanned && target.avatarUrl) {
    const jpeg = await fetchAvatarJpeg(target.avatarUrl, origin);
    if (jpeg) return jpeg;
  }
  return logoJpeg();
}

function upsertMeta(
  html: string,
  attr: 'property' | 'name',
  key: string,
  content: string
): string {
  const tag = `<meta ${attr}="${key}" content="${escapeHtmlAttr(content)}" />`;
  const re = new RegExp(`<meta\\s[^>]*${attr}=["']${key}["'][^>]*>`, 'i');
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function upsertTitle(html: string, title: string): string {
  const safe = escapeHtmlAttr(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace(/<\/head>/i, `    <title>${safe}</title>\n  </head>`);
}

export function applyBookingOgTags(
  html: string,
  opts: {
    pageUrl: string;
    title: string;
    description: string;
    imageUrl: string;
  }
): string {
  let next = html;
  next = upsertTitle(next, opts.title);
  next = upsertMeta(next, 'property', 'og:type', 'website');
  next = upsertMeta(next, 'property', 'og:url', opts.pageUrl);
  next = upsertMeta(next, 'property', 'og:title', opts.title);
  next = upsertMeta(next, 'property', 'og:description', opts.description);
  next = upsertMeta(next, 'property', 'og:image', opts.imageUrl);
  next = upsertMeta(next, 'property', 'og:image:secure_url', opts.imageUrl);
  next = upsertMeta(next, 'property', 'og:image:type', 'image/jpeg');
  next = upsertMeta(next, 'property', 'og:image:width', '800');
  next = upsertMeta(next, 'property', 'og:image:height', '800');
  next = upsertMeta(next, 'name', 'twitter:card', 'summary');
  next = upsertMeta(next, 'name', 'twitter:title', opts.title);
  next = upsertMeta(next, 'name', 'twitter:description', opts.description);
  next = upsertMeta(next, 'name', 'twitter:image', opts.imageUrl);
  next = upsertMeta(next, 'name', 'description', opts.description);
  return next;
}

export function bookingLinkCopy(target: BookingLinkOgTarget | null): {
  title: string;
  description: string;
} {
  if (!target) {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }
  return {
    title: `Book with ${target.name}`,
    description: `Book a service with ${target.name} on OnCuts.`,
  };
}

export function fallbackBookingHtml(opts: {
  pageUrl: string;
  title: string;
  description: string;
  imageUrl: string;
}): string {
  const title = escapeHtmlAttr(opts.title);
  const description = escapeHtmlAttr(opts.description);
  const imageUrl = escapeHtmlAttr(opts.imageUrl);
  const pageUrl = escapeHtmlAttr(opts.pageUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
  </head>
  <body>
    <p><a href="${pageUrl}">Continue to OnCuts</a></p>
  </body>
</html>`;
}
