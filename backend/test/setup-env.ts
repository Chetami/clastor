/**
 * Test-only environment bootstrap.
 *
 * Production secrets (JWT_SECRET, REFRESH_TOKEN_SECRET) are loaded from the
 * environment and the server refuses to start if they are missing (see
 * `src/utils/jwt.ts`). The unit tests exercise the JWT signing/verifying code
 * paths directly, so we provide deterministic test secrets here before any
 * module that imports `jwt.ts` is loaded.
 */
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-production";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-do-not-use-in-production";
