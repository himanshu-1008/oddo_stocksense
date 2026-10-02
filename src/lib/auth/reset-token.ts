import { SignJWT, jwtVerify } from "jose";

export interface ResetTokenPayload {
  userId: string;
  email: string;
  otpId: string;
  purpose: "PASSWORD_RESET";
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "stocksense-default-hackathon-jwt-secret-key-32chars";
  return new TextEncoder().encode(secret);
}

/**
 * Creates a short-lived (10 minutes) cryptographically signed reset token.
 */
export async function createPasswordResetToken(payload: Omit<ResetTokenPayload, "purpose">): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload, purpose: "PASSWORD_RESET" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

/**
 * Verifies a password reset token. Returns payload if valid, or null if expired/tampered.
 */
export async function verifyPasswordResetToken(token: string): Promise<ResetTokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== "PASSWORD_RESET") {
      return null;
    }
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      otpId: payload.otpId as string,
      purpose: "PASSWORD_RESET",
    };
  } catch (error) {
    return null;
  }
}
