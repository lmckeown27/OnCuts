# Intera — Sign in with Apple (aligned with CampusCuts API)

Use this document when prompting an AI or implementing **Intera** so the client **does not invent** endpoints or field names. The backend is **CampusCuts** `backend/` (Node + PostgreSQL).

---

## 1. Apple’s one-time data (non-negotiable)

- `ASAuthorizationAppleIDCredential.email` and `fullName` (given + family) are delivered **only on the first successful authorization** for your app (per Apple ID). Later sign-ins usually return **`nil`** for both.
- The **`identityToken`** (JWT) is present on subsequent sign-ins; it **may** include `email` on first sign-in only—**do not rely on the JWT alone** for name or relay email.
- **Client responsibility:** On every authorization where `email` or `fullName` is non-`nil`, read them immediately and **persist locally** (Keychain). On later logins, send **saved** `email` (and names if you still want to let the user edit before POST) with the token if the credential no longer returns them.

Request scopes: **`.fullName`** and **`.email`**.

---

## 2. Backend endpoint (exact)

**`POST /api/v1/auth/apple`** (legacy mirror: **`POST /api/auth/apple`**)

### Request JSON (UTF-8)

| Field | Required | Notes |
|--------|----------|--------|
| `identityToken` | **Yes** | JWT string from `credential.identityToken` (base64url), **not** the raw `Data` without encoding. |
| `email` | **If not in JWT** | Use `credential.email` when non-nil; for Hide My Email use Apple’s relay (`…@privaterelay.appleid.com`). |
| `firstName` / `lastName` | Strongly recommended on first auth | From `credential.fullName`. |
| `givenName` / `familyName` | Optional aliases | Backend accepts these **same as** `firstName` / `lastName`. |
| `fullName` | Optional object | `{ "givenName": "…", "familyName": "…" }` — backend merges like Apple’s `PersonNameComponents`. |
| `userEmail`, `appleEmail`, `contactEmail` | Optional | Extra aliases for `email` only. |
| `campusId` | Optional | UUID or campus slug string. |

The server verifies the JWT (**RS256**, `iss` = `https://appleid.apple.com`, `aud` = **`APPLE_CLIENT_ID`** env = iOS bundle ID). It uses JWT claim **`sub`** as **`users.apple_sub`** (source of truth).

### Email precedence (Hide My Email vs Create Account prefill)

- If the JWT `email` is an Apple **private relay** (`@privaterelay.appleid.com`) and the JSON body includes a **non-relay** address (via `email` / `userEmail` / etc.), the API uses the **body** address for **lookup and new inserts** (so Create Account `@icloud.com` is not overridden by the relay).
- If the JWT `email` is **non-relay**, it wins for lookup/insert when both sides are non-relay.
- After sign-in, if the stored row still has a **relay** and the body sends a **free non-relay** email, the API **`UPDATE`s `users.email`** to upgrade legacy relay-only rows (only when that email is not used by another user).

### Success response (`200`)

Same envelope as email password login:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "role": "...",
      "campusId": "...",
      "emailVerified": true,
      "profile_picture_url": null,
      "hasBarberProfile": false,
      "phoneNumber": null,
      "needsPlatformPassword": true
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

**Important:** The flag is **`needsPlatformPassword`** (camelCase). When **`true`**, the user must complete **`PUT /api/v1/users/me/set-initial-password`** before the account is treated as having a user-chosen password (`has_platform_password` in DB).

**Do not** implement or expect `requiresPasswordSetup` or `PUT /api/v1/auth/set-password` — those are **not** this API.

---

## 3. Set password after Apple (exact)

**`PUT /api/v1/users/me/set-initial-password`**

- **Headers:** `Authorization: Bearer <accessToken>` from the Apple response.
- **Body:** `{ "newPassword": "…" }` — minimum **8** characters.
- **When allowed:** Only while the user row has **`has_platform_password = false`** (new Apple account or legacy Apple row after migration **027**). If a password is already set, API returns **`400`** with code **`PASSWORD_ALREADY_SET`** — use normal change-password flow instead.

Legacy path: **`PUT /api/users/me/set-initial-password`** (same handler if mounted).

---

## 3b. Update name / profile after sign-in (authenticated)

**`PUT /api/v1/users/me`** (legacy: **`PUT /api/users/me`**)

- **Headers:** `Authorization: Bearer <accessToken>`
- **Body (any subset):** `first_name` / `last_name` **or** `firstName` / `lastName` (camelCase), plus optional `displayName`, `bio`, `avatarUrl` / `profile_picture_url`, `phoneNumber`, `instagramHandle`.
- **Response `data`:** includes `firstName`, `lastName`, `needsPlatformPassword`, and other returned columns so Intera can refresh UI after “Confirm your name” **before** the set-password step.

---

## 4. Refreshing session / profile (do not drop the flag)

After saving tokens, if you call **`GET /api/v1/auth/me`**, the payload includes:

- `needs_platform_password` (snake_case) **and**
- **`needsPlatformPassword`** (camelCase)

Decode **either** consistently so a refresh does not look like “password no longer needed” and dismiss your UI.

**`GET /api/v1/users/:id`** profile `data` includes `needs_platform_password` and **`needsPlatformPassword`**.

---

## 5. Names when the user hides email (relay)

If the client sends **no** real names on first sign-in, the backend may store placeholder **`Apple` / `User`** for `@privaterelay.appleid.com` (so the DB is not filled with garbage from the random local part). **Avoid that** by always POSTing **`firstName` / `lastName`** (or `givenName` / `familyName`) from `credential.fullName` on the **first** authorization.

If profile still shows placeholders, show **“Confirm your name”** before set-password; call **`PUT /api/v1/users/me`** (Bearer) with **`firstName` / `lastName`**.

---

## 6. Database / deploy

- Apple columns: migration **`026_apple_oauth_users.sql`** (`apple_sub`, `auth_provider`).
- Password flag: **`027_has_platform_password.sql`** (`has_platform_password`; existing `apple_sub` rows set to need password until set).

From `backend/`: `npm run migrate:sql:apple` (runs **026** then **027**). Deploy migrations **before** API code that selects these columns.

---

## 7. Suggested Intera UX order (product)

1. **Sign in with Apple** → receive credential → build JSON with **`identityToken` + `email` + names** whenever Apple provides them; merge Keychain fallbacks on repeat login.
2. **`POST /api/v1/auth/apple`** → store **`accessToken` / `refreshToken`**.
3. If names need correction (e.g. placeholders **`Apple` / `User`**): **`PUT /api/v1/users/me`** with Bearer token and body `{ "firstName": "…", "lastName": "…" }`.
4. If **`data.user.needsPlatformPassword === true`**: show **set password**. **`PUT /api/v1/users/me/set-initial-password`** with Bearer token.
5. Do **not** dismiss that flow until **`needsPlatformPassword`** is **false** on Apple response **and** after **`/auth/me`** if you refetch there.

---

## 8. Stripe / identity (later)

Use **`users.id`** (and stable **`email`**) as the canonical customer key when creating Stripe customers; **`apple_sub`** is stable for the same person across relay email rotation only if Apple keeps the same relay—prefer **`sub`** + internal **`user.id`** for linkage.
