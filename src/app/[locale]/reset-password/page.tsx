"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { Lock, ArrowLeft, EyeOff } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

function ResetPasswordContent() {
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

  // Check for valid reset token from URL parameters
  useEffect(() => {
    const token = searchParams?.get("token");

    if (!token) {
      setError("رابط إعادة التعيين غير صالح. يرجى طلب رابط جديد.");
      setTimeout(() => onNavigate("login"), 3000);
      return;
    }

    // Token exists, assume valid for now (will be validated on submit)
    setIsValidSession(true);
  }, [searchParams, onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("كلمة المرور غير متطابقة");
      return;
    }

    if (newPassword.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      // Get reset token from URL
      const resetToken = searchParams?.get("token");
      if (!resetToken) {
        throw new Error("رمز إعادة التعيين مفقود من الرابط");
      }

      // Call the Edge Function to validate token and reset password
      const { data, error: invokeError } = await supabase.functions.invoke(
        "reset-password",
        {
          body: {
            token: resetToken,
            newPassword: newPassword,
          },
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message || "فشل في تحديث كلمة المرور");
      }

      if (data?.error) {
        throw new Error(data.error || "فشل في تحديث كلمة المرور");
      }

      setSuccess(
        "تم تحديث كلمة المرور بنجاح! سيتم توجيهك إلى صفحة تسجيل الدخول...",
      );

      // Redirect after successful password reset
      setTimeout(() => {
        onNavigate("login");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تحديث كلمة المرور. يرجى المحاولة مرة أخرى.",
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
            إعادة تعيين كلمة المرور
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            أدخل كلمة مرور جديدة
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
                كلمة المرور الجديدة
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
                تأكيد كلمة المرور الجديدة
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
                  <span>جاري تحديث كلمة المرور...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>تحديث كلمة المرور</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              جاري التحقق من صحة الرابط...
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => onNavigate("login")}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة إلى تسجيل الدخول</span>
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
