import { Role } from "./user";

/**
 * JWT Payload interface
 * Represents the payload stored in the custom JWT token
 */
export interface JWTPayload {
  uid: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;  // 1 hour from issuance
}

/**
 * Login Request interface
 * Sent from frontend to backend /api/auth/login endpoint
 */
export interface LoginRequest {
  firebaseToken: string;
}

/**
 * User info returned from API (without JWT timestamps)
 */
export interface UserInfo {
  uid: string;
  email: string;
  role: Role;
}

/**
 * Login Response interface
 * Returned from backend /api/auth/login endpoint
 */
export interface LoginResponse {
  jwtToken: string;
  user: UserInfo;
}

/**
 * API Error response interface
 */
export interface ApiError {
  message: string;
  code?: string;
}
