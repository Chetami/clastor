# Authentication hardening: deployment and operating notes

This change strengthens the existing web/mobile backend contract. The native
SwiftUI implementation remains a separate feature.

## Behaviour

- Access, refresh, OAuth-connect, OAuth-login and RSVP tokens use separate derived
  signing keys, explicit purposes, issuer/audience checks and HS256. Required
  claims and session token lifetimes are validated at runtime.
- Session tokens retain the original `auth_time`. Firebase ID-token exchange
  checks revocation. Issuance, refresh, verification and email-gated actions
  reject disabled/deleted identities and authentication older than Firebase's
  `tokensValidAfterTime` (including password reset/revocation).
- Refresh consumes and replaces a token in one Firestore transaction. A shared
  `refreshTokenFamilies` record serializes rotation with logout and reuse
  revocation. Logout revokes the family even when the submitted token was just
  rotated; other independently signed-in devices have different families.
- Dependency failures before rotation and aborted transactions leave the original
  token usable. If the commit or HTTP response outcome is unknown, the token may
  already be consumed: replay then requires sign-in again. There is deliberately
  no replay grace period or blind automatic retry of the refresh request.
- Client refresh is shared across concurrent requests in one runtime. Network
  failures, HTTP 429 and 5xx preserve local credentials. Confirmed refresh 401s
  clear credentials and cached data. Late results cannot restore a logged-out
  session or replace another account's credentials.
- Signup can resume after Firebase account creation or a lost backend response.
  The supplied password proves ownership when a Firebase account already exists.
  Backend provisioning creates a user atomically and never overwrites an existing
  profile, role or settings. Lookup outages do not trigger provisioning.
- Native Google exchange checks the Firebase sign-in provider. Browser Google
  login codes and consent retry state preserve the verified authentication time.
- YAML login/verification contracts now describe the actual wire format and
  distinguish Firebase credential exchange from Clastor API authorization.

## Session invalidation policy

Existing Clastor access/refresh tokens are rejected after this deployment. Users
must sign in once again. The Firebase project and user records do not change.
In-flight OAuth redirects from the previous release must also be restarted.

New access tokens remain stateless with a maximum 15-minute lifetime. Revoking a
refresh family prevents further refreshes; it does not instantly revoke an
already-issued access token on every route. Firebase account status is checked
at issuance, refresh, `/verify` and email-gated operations. Other routes can
continue to accept an issued access token until it expires. Immediate global
access-token revocation would require an additional per-request server check.

Previously emailed RSVP links remain accepted only for their original, bounded
30-day lifetime and exact legacy payload shape. They cannot authenticate an API
request. The current `JWT_SECRET` must remain available for those links.

## Deployment sequence

1. Validate the change in an isolated Firebase/backend environment. Use test users
   to exercise both email/password and browser Google login, registration retry,
   verification, refresh, logout and a Firebase password reset/revocation.
2. Deploy the updated web client before, or together with, the backend so outage
   handling is available during the transition. Existing Expo clients should
   pick up the rebuilt shared runtime on their next release.
3. Coordinate replacement of backend instances. Avoid a prolonged mix of old and
   new servers: they disagree on token format and refresh storage semantics.
   Advise users of the one-time sign-in requirement.
4. Keep the existing `JWT_SECRET` and `REFRESH_TOKEN_SECRET` in backend secret
   storage. No new signing-secret environment variables are required: the code
   derives keys separately for each purpose. Never expose these root keys to
   clients or logs.
5. Ensure the backend service account can read/write `refreshTokenFamilies` as
   well as `refreshTokens`. Client Firestore rules must deny access to both
   collections; the Admin SDK uses IAM rather than client rules. Document-ID
   lookups do not require composite indexes.
6. Configure optional Firestore TTL cleanup on `expiresAt` for both collections.
   Expiry is enforced by the application; TTL cleanup may be delayed. Existing
   legacy refresh-token records cannot authenticate and can expire normally.
7. Confirm sign-in, refresh and logout on the deployed version. Monitor counts
   of 401, 429 and 5xx without recording tokens, passwords, OAuth codes or full
   SDK request/response errors.

Prefer a forward fix to restoring the previous token verifier. This repository
change does not deploy the backend or change Firebase/IAM settings automatically.

## Verification

Regression tests cover cross-purpose token rejection, legacy RSVP compatibility,
revocation cutoffs, transaction commit failures, concurrent refresh, logout races,
registration recovery, provider validation and transient client failures. The
Firestore service tests use a transactional fake; they do not replace the
isolated-environment deployment checks above.

Run:

```bash
npm run build:interfaces
npm run build:shared
npm test --workspace=backend
npm test --workspace=frontend
npm run lint --workspace=frontend
npm run build:backend
npm run build:frontend
gitleaks git . --log-opts=--all --redact=100 --no-banner
```

The checked-in Gitleaks workflow uses a version and SHA-256 pinned upstream
binary with read-only repository permissions. Local hook setup is documented in
[CONTRIBUTING.md](../CONTRIBUTING.md).

GitHub secret scanning and push protection are enabled for this repository.
These settings complement the local hook and CI; they cannot detect every secret.
