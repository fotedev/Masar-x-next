"use client";

import { type FormEvent } from "react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Lock, ArrowLeft, EyeOff } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";

function ResetPasswordContent() {
  const t = useTranslations("authPages");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  const onNavigate = useCallback(
    (page: string) => {
      router.push(`/${page}`);
    },
    [router],
  );

  // Check for valid reset token/code from URL parameters
  useEffect(() => {
    const code = searchParams?.get("code");
    const type = searchParams?.get("type");

    if (!code || type !== "recovery") {
      setError(t("resetPassword.invalidLinkError"));
      setTimeout(() => onNavigate("login"), 3000);
      return;
    }

    // Code exists and type is recovery, assume valid for now (will be validated on submit)
    setIsValidSession(true);
  }, [searchParams, onNavigate, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    if (newPassword.length < 6) {
      setError(t("passwordMinLength"));
      return;
    }

    setLoading(true);

    try {
      // Get code from URL
      const code = searchParams?.get("code");
      if (!code) {
        throw new Error(t("resetPassword.missingCodeError"));
      }

      // Exchange the code for a session
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (sessionError || !sessionData.session) {
        throw new Error(t("resetPassword.expiredLinkError"));
      }

      // Update password with the new session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(t("resetPassword.successMessage"));

      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => {
        onNavigate("login");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("resetPassword.genericError"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t("resetPassword.title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t("resetPassword.subtitle")}
          </p>
        </div>

        {(error || success) && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              error
                ? "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                : "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
            }`}
          >
            {error || success}
          </div>
        )}

        {isValidSession ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("resetPassword.newPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-new-password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("resetPassword.confirmPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{t("resetPassword.submitting")}</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>{t("resetPassword.submit")}</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {t("resetPassword.checkingLink")}
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => onNavigate("login")}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("backToLogin")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
