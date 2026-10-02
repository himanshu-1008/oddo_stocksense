import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "StockSense <onboarding@resend.dev>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface SendOtpEmailParams {
  to: string;
  otp: string;
}

function getSenderAddress(): string {
  const envSender = process.env.EMAIL_FROM;
  if (!envSender || !envSender.includes("@")) {
    return "StockSense <onboarding@resend.dev>";
  }
  return envSender;
}

export async function sendPasswordResetOtpEmail({
  to,
  otp,
}: SendOtpEmailParams): Promise<{ success: boolean; id?: string; devOtp?: string }> {
  const subject = "StockSense Password Reset OTP";
  
  const textBody = `Hello,

We received a request to reset your StockSense password.

Your verification code is:

${otp}

This code expires in 10 minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
StockSense Team`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { background-color: #ffffff; max-width: 480px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .logo { font-size: 20px; font-weight: bold; color: #4f46e5; margin-bottom: 24px; display: flex; align-items: center; }
    .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; font-size: 32px; font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 6px; color: #0f172a; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">📦 StockSense</div>
    <p>Hello,</p>
    <p>We received a request to reset your StockSense password.</p>
    <p>Your verification code is:</p>
    <div class="otp-box">${otp}</div>
    <p style="color: #64748b; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color: #64748b; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
    <div class="footer">
      <p style="margin: 0;">Regards,<br><strong>StockSense Team</strong></p>
    </div>
  </div>
</body>
</html>
`;

  const apiKey = process.env.RESEND_API_KEY;
  const sender = getSenderAddress();

  if (apiKey) {
    try {
      const client = new Resend(apiKey);
      const response = await client.emails.send({
        from: sender,
        to,
        subject,
        text: textBody,
        html: htmlBody,
      });

      if (response.error) {
        // Handle Resend free-tier sandbox restrictions gracefully in dev
        if (process.env.NODE_ENV !== "production") {
          console.log(`[Dev Fallback] OTP for ${to}: ${otp}`);
          return { success: true, id: "dev-fallback", devOtp: otp };
        }
        throw new Error(response.error.message || "Failed to send email");
      }

      console.log(`Password reset OTP sent to ${to} (id: ${response.data?.id})`);
      return {
        success: true,
        id: response.data?.id,
        devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
      };
    } catch (err: any) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Dev Fallback] OTP for ${to}: ${otp}`);
        return { success: true, id: "dev-fallback", devOtp: otp };
      }
      throw err;
    }
  }

  // Development simulation when RESEND_API_KEY is not set
  console.log(`[Email Simulation] To: ${to} | OTP: ${otp}`);
  return { success: true, id: "simulated", devOtp: otp };
}
