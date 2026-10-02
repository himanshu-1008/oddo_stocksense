import { userRepository } from "@/repositories/user.repository";
import { otpRepository } from "@/repositories/otp.repository";
import {
  LoginInput,
  SignupInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
  UpdateProfileInput,
  ChangePasswordInput,
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import {
  hashPassword,
  verifyPassword,
  generateOTP,
  hashOTP,
  verifyOTP,
} from "@/lib/auth/password";
import { createSessionToken, SessionPayload } from "@/lib/auth/session";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "@/lib/auth/reset-token";
import { sendPasswordResetOtpEmail } from "@/lib/email/resend";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/api-error";

export class AuthService {
  /**
   * Registers a new user account and creates a session token.
   */
  async signup(input: SignupInput) {
    signupSchema.parse(input);
    const existingUser = await userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError("An account with this email address already exists.");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    const sessionPayload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = await createSessionToken(sessionPayload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  /**
   * Authenticates user credentials and generates a session token.
   */
  async login(input: LoginInput) {
    loginSchema.parse(input);
    const user = await userRepository.findByEmail(input.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isPasswordValid = await verifyPassword(
      input.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const sessionPayload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = await createSessionToken(sessionPayload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  /**
   * Generates a 6-digit OTP for password reset and dispatches it via Resend email.
   */
  async requestPasswordReset(input: ForgotPasswordInput) {
    forgotPasswordSchema.parse(input);
    const user = await userRepository.findByEmail(input.email);

    // Generic safe response to prevent email enumeration
    if (!user || !user.isActive) {
      return {
        success: true,
        message:
          "If an account exists for this email, a verification code has been sent.",
      };
    }

    // Enforce 60-second cooldown on resending to prevent spam
    const recentOtp = await otpRepository.findRecentOTP(user.id, 60);
    if (recentOtp) {
      throw new ValidationError(
        "Please wait 60 seconds before requesting another verification code."
      );
    }

    const otp = generateOTP(6);
    const otpHash = await hashOTP(otp);

    // Store in DB with 10-minute validity and 5 max attempts
    await otpRepository.createOTP(user.id, otpHash, 10);

    console.log(`Password reset OTP generated for ${user.email}`);

    // Send email using Resend
    let devOtp: string | undefined =
      process.env.NODE_ENV !== "production" ? otp : undefined;

    try {
      const res = await sendPasswordResetOtpEmail({
        to: user.email,
        otp,
      });
      if (res.devOtp) {
        devOtp = res.devOtp;
      }
    } catch (err: any) {
      console.error("Email dispatch failed:", err);
      if (process.env.NODE_ENV === "production") {
        throw new ValidationError(
          "Unable to send verification code. Please check email configuration or try again later."
        );
      }
    }

    return {
      success: true,
      message:
        "If an account exists for this email, a verification code has been sent.",
      ...(devOtp ? { devOtp } : {}),
    };
  }

  /**
   * Verifies an OTP and issues a cryptographically signed reset token.
   */
  async verifyOtp(input: VerifyOtpInput) {
    verifyOtpSchema.parse(input);
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new ValidationError("Invalid or expired verification code.");
    }

    const activeOtp = await otpRepository.findLatestActiveOTP(user.id);
    if (!activeOtp) {
      throw new ValidationError(
        "This verification code has expired. Please request a new code."
      );
    }

    if (activeOtp.attempts >= activeOtp.maxAttempts) {
      await otpRepository.markAsUsed(activeOtp.id);
      throw new ValidationError(
        "Too many incorrect attempts. Please request a new code."
      );
    }

    const isMatch = await verifyOTP(input.otp, activeOtp.otpHash);
    if (!isMatch) {
      const updatedOtp = await otpRepository.incrementAttempts(activeOtp.id);
      if (updatedOtp.attempts >= updatedOtp.maxAttempts) {
        await otpRepository.markAsUsed(activeOtp.id);
        throw new ValidationError(
          "Too many incorrect attempts. Please request a new code."
        );
      }
      const remaining = updatedOtp.maxAttempts - updatedOtp.attempts;
      throw new ValidationError(
        `Invalid verification code. ${remaining} attempt(s) remaining.`
      );
    }

    // Generate signed reset authorization token valid for 10 minutes
    const resetToken = await createPasswordResetToken({
      userId: user.id,
      email: user.email,
      otpId: activeOtp.id,
    });

    return {
      success: true,
      valid: true,
      resetToken,
      message: "Verification code confirmed.",
    };
  }

  /**
   * Resets password using verified reset token or valid OTP.
   */
  async resetPassword(input: ResetPasswordInput) {
    resetPasswordSchema.parse(input);

    let targetUserId: string;
    let targetOtpId: string | null = null;

    if (input.resetToken) {
      const tokenPayload = await verifyPasswordResetToken(input.resetToken);
      if (!tokenPayload) {
        throw new ValidationError(
          "Password reset session has expired or is invalid. Please request a new code."
        );
      }
      targetUserId = tokenPayload.userId;
      targetOtpId = tokenPayload.otpId;

      // Verify OTP has not already been used
      const otpRecord = await otpRepository.findById(targetOtpId);
      if (!otpRecord || otpRecord.usedAt !== null) {
        throw new ValidationError(
          "This verification code has already been used. Please request a new code."
        );
      }
    } else if (input.email && input.otp) {
      const user = await userRepository.findByEmail(input.email);
      if (!user) {
        throw new ValidationError("Invalid or expired verification code.");
      }
      const activeOtp = await otpRepository.findLatestActiveOTP(user.id);
      if (!activeOtp) {
        throw new ValidationError(
          "This verification code has expired. Please request a new code."
        );
      }
      if (activeOtp.attempts >= activeOtp.maxAttempts) {
        await otpRepository.markAsUsed(activeOtp.id);
        throw new ValidationError(
          "Too many incorrect attempts. Please request a new code."
        );
      }
      const isMatch = await verifyOTP(input.otp, activeOtp.otpHash);
      if (!isMatch) {
        await otpRepository.incrementAttempts(activeOtp.id);
        throw new ValidationError("Invalid verification code.");
      }
      targetUserId = user.id;
      targetOtpId = activeOtp.id;
    } else {
      throw new ValidationError("Reset authorization token is required.");
    }

    // Hash new password and update user
    const newPasswordHash = await hashPassword(input.newPassword);
    await userRepository.updatePassword(targetUserId, newPasswordHash);

    // Invalidate the used OTP
    if (targetOtpId) {
      await otpRepository.markAsUsed(targetOtpId);
    }

    return {
      success: true,
      message: "Password has been successfully updated. You can now log in.",
    };
  }

  /**
   * Retrieves user profile details.
   */
  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }
    return user;
  }

  /**
   * Updates user name.
   */
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }
    return userRepository.updateProfile(userId, { name: input.name });
  }

  /**
   * Updates user password while authenticated.
   */
  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await userRepository.findByEmail(userId);
    const fullUser = await userRepository.findById(userId);
    if (!fullUser) {
      throw new NotFoundError("User");
    }

    // Verify existing password
    const userWithPass = await userRepository.findByEmail(fullUser.email);
    if (!userWithPass) {
      throw new NotFoundError("User");
    }

    const isValid = await verifyPassword(
      input.currentPassword,
      userWithPass.passwordHash
    );
    if (!isValid) {
      throw new ValidationError("Current password is incorrect.");
    }

    const newHash = await hashPassword(input.newPassword);
    await userRepository.updatePassword(userId, newHash);

    return {
      success: true,
      message: "Password changed successfully.",
    };
  }
}

export const authService = new AuthService();
