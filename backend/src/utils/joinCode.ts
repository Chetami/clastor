import crypto from "crypto";

/**
 * Characters used for human-shareable join codes. The ambiguous pairs
 * (0/O, 1/I/L) are excluded so codes are readable when spoken or retyped.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

/**
 * Generate a random join code of the configured length using a
 * crypto-strong selection from the unambiguous alphabet. Not guaranteed
 * unique — callers must check the `organisations` collection and retry.
 */
export function generateJoinCode(): string {
  const bytes = crypto.randomBytes(JOIN_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
