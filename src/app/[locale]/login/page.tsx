"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../contexts/AuthContext";
import { useAnalytics } from "../../hooks/useAnalytics";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, user } = useAuth();
  const { trackEvent, logError } = useAnalytics();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);

  const onNavigate = useCallback(
    (page: string) => {
      if (page === "home") {
        router.push("/");
      } else {
        router.push(`/${page}`);
      }
    },
    [router],
  );

  useEffect(() => {
    if (user) {
      onNavigate("home");
    }
  }, [user, onNavigate]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("login_attempts");
      if (stored) {
        const { count, timestamp } = JSON.parse(stored);
        const timeDiff = Date.now() - timestamp;
        const lockoutDuration = Math.min(count * 30000, 300000);

        if (timeDiff < lockoutDuration) {
          setAttempts(count);
          setLockoutTime(lockoutDuration - timeDiff);
        } else {
          localStorage.removeItem("login_attempts");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime((prev) => Math.max(0, prev - 1000));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) {
      setError(
        `تم تعليق المحاولات. انتظر ${Math.ceil(lockoutTime / 1000)} ثانية`,
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      setAttempts(0);
      setLockoutTime(0);
      localStorage.removeItem("login_attempts");
      trackEvent("login_success", { method: "email" });
    } catch (err) {
      logError(err instanceof Error ? err : String(err), {
        message: "Login failed",
        metadata: { method: "email" },
      });
      trackEvent("login_failure", { method: "email" });
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const lockoutDuration = Math.min(newAttempts * 30000, 300000);
      localStorage.setItem(
        "login_attempts",
        JSON.stringify({ count: newAttempts, timestamp: Date.now() }),
      );
      if (newAttempts >= 20) {
        setLockoutTime(lockoutDuration);
        setError(
          `تم تعليق المحاولات بسبب محاولات فاشلة متكررة. انتظر ${Math.ceil(lockoutDuration / 1000)} ثانية`,
        );
      } else {
        setError("خطأ في البريد الإلكتروني أو كلمة المرور");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      trackEvent("login_success", { method: "google" });
    } catch (err) {
      logError(err instanceof Error ? err : String(err), {
        message: "Google login failed",
        metadata: { method: "google" },
      });
      trackEvent("login_failure", { method: "google" });
      setError("حدث خطأ أثناء تسجيل الدخول بـ Google. يرجى المحاولة مرة أخرى.");
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني أولاً");
      return;
    }
    setResetLoading(true);
    setError("");
    setResetMessage("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "request-password-reset",
        {
          body: { email },
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message || "Request failed");
      }

      if (data?.error) {
        throw new Error(data.error || "Request failed");
      }

      setSuccess("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
      trackEvent("password_reset_requested", { method: "brevo" });
    } catch (err) {
      logError(err instanceof Error ? err : String(err), {
        message: "Password reset failed",
        metadata: { method: "brevo" },
      });
      trackEvent("password_reset_failure", { method: "brevo" });
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء إرسال رابط إعادة التعيين.",
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="modern-card p-8 sm:p-10">
        <div className="text-center mb-10">
          <div className="bg-brand-blue/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-blue/5">
            <Image
              src="/logo.png"
              alt="Masar X Logo"
              width={56}
              height={56}
              className="object-contain w-14 h-14"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
            {showForgotPasswordForm ? "نسيت كلمة المرور؟" : "مرحباً بك مجدداً"}
          </h1>
          {!showForgotPasswordForm && (
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              سجل دخولك لمتابعة رحلة التعلم
            </p>
          )}
        </div>

        {(error || success || resetMessage) && (
          <div
            className={`mb-8 p-4 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${
              error
                ? "bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {error || success || resetMessage}
          </div>
        )}

        {showForgotPasswordForm ? (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1"
              >
                البريد الإلكتروني
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                placeholder="admin@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={resetLoading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-sky text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-brand-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                <span>إرسال رابط إعادة التعيين</span>
              )}
            </button>
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setResetMessage("");
                  setShowForgotPasswordForm(false);
                }}
                className="text-sm font-bold text-slate-500 hover:text-brand-blue transition-colors"
              >
                العودة إلى تسجيل الدخول
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1"
              >
                البريد الإلكتروني
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-14 pl-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-slate-400 hover:text-brand-blue transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setResetMessage("");
                  setShowForgotPasswordForm(true);
                }}
                className="text-sm font-bold text-brand-blue hover:text-brand-sky transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-brand-blue hover:bg-brand-sky text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-brand-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-6 h-6" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-brand-navy text-slate-400 font-bold">
                أو
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="mt-8 w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-700 dark:border-slate-300"></div>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span>تسجيل الدخول باستخدام Google</span>
        </button>

        <div className="mt-10 text-center space-y-4">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            ليس لديك حساب؟{" "}
            <button
              onClick={() => onNavigate("signup")}
              className="text-brand-blue hover:text-brand-sky font-bold transition-colors"
            >
              إنشاء حساب جديد
            </button>
          </p>
          <button
            onClick={() => onNavigate("home")}
            className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            العودة إلى الصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
