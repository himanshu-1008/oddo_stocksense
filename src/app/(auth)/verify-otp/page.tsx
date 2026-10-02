"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MailCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState(searchParams.get("email") || "");
  const [otp, setOtp] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(60);

  // 60-second cooldown timer for resend
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Email address is missing. Please enter your email.");
      return;
    }

    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || "Invalid verification code.");
        setIsLoading(false);
        return;
      }

      const resetToken = data.data?.resetToken;
      if (resetToken) {
        router.push(
          `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(
            resetToken
          )}`
        );
      } else {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      setError("An unexpected network error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return;

    if (!email) {
      setError("Email address is required to resend verification code.");
      return;
    }

    setError(null);
    setResendMessage(null);
    setIsResending(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || "Unable to resend verification code. Please try again.");
        setIsResending(false);
        return;
      }

      setResendMessage("A new 6-digit verification code has been dispatched to your email.");
      setCooldown(60);
      setIsResending(false);
    } catch (err) {
      setError("Network error while resending code. Please try again.");
      setIsResending(false);
    }
  };

  return (
    <Card className="shadow-2xl border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
      <CardHeader className="text-center space-y-2 pb-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 mb-1">
          <MailCheck className="w-7 h-7" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Verify Email
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          Enter the 6-digit verification code sent to{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{email || "your email"}</span>.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3.5 border border-rose-200 dark:border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification Error</p>
              <p className="text-[11px] mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {resendMessage && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">{resendMessage}</p>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          {!searchParams.get("email") && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Registered Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@stocksense.io"
                className="bg-slate-50 dark:bg-slate-900/80 h-10 text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              6-Digit Verification Code
            </label>
            <Input
              type="text"
              required
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="bg-slate-50 dark:bg-slate-900/80 font-mono tracking-widest text-center text-2xl font-bold h-13"
            />
            <p className="text-[11px] text-slate-400 text-center">
              The code will expire in 10 minutes.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full h-10 text-sm font-semibold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying Code...
              </>
            ) : (
              <>
                Verify OTP <ArrowRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={cooldown > 0 || isResending}
            className={`flex items-center gap-1.5 font-medium transition-colors ${
              cooldown > 0 || isResending
                ? "text-slate-400 cursor-not-allowed"
                : "text-indigo-600 dark:text-indigo-400 hover:underline"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
          </button>

          <Link
            href="/forgot-password"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Change Email
          </Link>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-center pt-2 pb-6 border-t border-slate-100 dark:border-slate-800/80">
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="w-full max-w-md mx-auto">
      <React.Suspense
        fallback={
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        }
      >
        <VerifyOtpForm />
      </React.Suspense>
    </div>
  );
}

