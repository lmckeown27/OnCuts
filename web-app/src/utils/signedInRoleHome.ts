const STORAGE_KEY = 'oncuts_signed_in_home';

type RoleUser = {
  user_type?: string;
  has_barber_profile?: boolean;
  is_admin?: boolean;
} | null;

/** Remember the client or operator home the signed-in user was last using. */
export function rememberSignedInRoleHome(pathname: string) {
  if (pathname.startsWith('/app/barber') || pathname.startsWith('/web/barber')) {
    sessionStorage.setItem(STORAGE_KEY, pathname.startsWith('/app') ? '/app/barber' : '/web/barber');
    return;
  }
  if (pathname.startsWith('/app/consumer') || pathname.startsWith('/web/consumer')) {
    sessionStorage.setItem(STORAGE_KEY, pathname.startsWith('/app') ? '/app/consumer' : '/web/consumer');
  }
}

/** Home for the signed-in role. Guests stay on the public landing page. */
export function signedInRoleHome(user: RoleUser, isAuthenticated: boolean): string {
  if (!isAuthenticated || !user) return '/';

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (
    stored === '/app/barber' ||
    stored === '/web/barber' ||
    stored === '/app/consumer' ||
    stored === '/web/consumer'
  ) {
    return stored;
  }

  const operator =
    user.user_type === 'barber' ||
    (Boolean(user.is_admin) && Boolean(user.has_barber_profile));
  return operator ? '/web/barber' : '/web/consumer';
}
