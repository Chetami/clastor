/**
 * localStorage-style key for the short-lived access JWT.
 * Kept here (not in each app) so the web and mobile clients share the
 * exact same key, making the storage adapter a drop-in.
 */
export const TOKEN_KEY = "jwtToken";

/**
 * localStorage-style key for the longer-lived refresh token.
 */
export const REFRESH_TOKEN_KEY = "refreshToken";
