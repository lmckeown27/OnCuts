import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const APPLE_ISSUER = 'https://appleid.apple.com';
const JWKS_URI = `${APPLE_ISSUER}/auth/keys`;

export type AppleIdTokenPayload = {
  sub: string;
  email: string | null;
};

/**
 * Verify an Apple `identityToken` (JWT) using Apple's JWKS.
 * `audience` must be the App ID / Services ID(s) configured for Sign in with Apple
 * (`APPLE_CLIENT_ID`, `APPLE_PROVIDER_CLIENT_ID`, etc.).
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  audience: string | string[]
): Promise<AppleIdTokenPayload> {
  const client = jwksClient({
    jwksUri: JWKS_URI,
    cache: true,
    cacheMaxAge: 86_400_000,
  });

  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded !== 'object' || decoded.header == null) {
    throw new Error('Invalid token structure');
  }
  const kid = decoded.header.kid;
  if (!kid) throw new Error('Missing kid');

  const signingKey = await client.getSigningKey(kid);
  const publicKey = signingKey.getPublicKey();

  const audienceOpt: jwt.VerifyOptions['audience'] =
    typeof audience === 'string'
      ? audience
      : audience.length === 1
        ? audience[0]!
        : (audience as [string, ...string[]]);

  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: audienceOpt,
  }) as jwt.JwtPayload;

  const sub = payload.sub;
  if (!sub || typeof sub !== 'string') {
    throw new Error('Missing sub');
  }

  let email: string | null = null;
  if (typeof payload.email === 'string' && payload.email.trim() !== '') {
    email = payload.email.trim().toLowerCase();
  }

  return { sub, email };
}
