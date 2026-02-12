"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, Mail, Lock, ArrowLeft, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../contexts/AuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onNavigate = (page: string) => {
    if (page === "home") {
      router.push("/");
    } else {
      router.push(`/${page}`);
    }
  };

  // Load attempts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("signup_attempts");
      if (stored) {
        const { count, timestamp } = JSON.parse(stored);
        const timeDiff = Date.now() - timestamp;
        const lockoutDuration = Math.min(count * 30000, 300000); // Max 5 minutes

        if (timeDiff < lockoutDuration) {
          setAttempts(count);
          setLockoutTime(lockoutDuration - timeDiff);
        } else {
          // Reset if lockout expired
          localStorage.removeItem("signup_attempts");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Countdown timer for lockout
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
    setError("");
    setSuccess("");

    // Check if user is locked out
    if (lockoutTime > 0) {
      setError(
        `تم تعليق المحاولات. انتظر ${Math.ceil(lockoutTime / 1000)} ثانية`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمة المرور غير متطابقة");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      setSuccess(
        "تم إرسال رابط التأكيد إلى بريدك الإلكتروني. يرجى التحقق من بريدك الإلكتروني.",
      );
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      // Reset attempts on successful signup
      setAttempts(0);
      setLockoutTime(0);
      localStorage.removeItem("signup_attempts");
    } catch (err: any) {
      // Increment attempts and set lockout
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // Store in localStorage for persistence
      const lockoutDuration = Math.min(newAttempts * 30000, 300000); // Max 5 minutes
      localStorage.setItem(
        "signup_attempts",
        JSON.stringify({
          count: newAttempts,
          timestamp: Date.now(),
        }),
      );

      if (newAttempts >= 20) {
        setLockoutTime(lockoutDuration);
        setError(
          `تم تعليق المحاولات بسبب محاولات فاشلة متكررة. انتظر ${Math.ceil(
            lockoutDuration / 1000,
          )} ثانية`,
        );
      } else {
        if (err && err.message?.includes("already registered")) {
          setError(
            "هذا البريد الإلكتروني مسجل بالفعل. جرب تسجيل الدخول بدلاً من ذلك.",
          );
        } else {
          setError("حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError("");

    try {
      await signInWithGoogle();
    } catch {
      setError("حدث خطأ ما أثناء إنشاء الحساب");
    } finally {
      setGoogleLoading(false);
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
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
            إنشاء حساب جديد
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            انضم إلى المجتمع للنشر
          </p>
        </div>

        {(error || success) && (
          <div
            className={`mb-8 p-4 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${
              error
                ? "bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {error || success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="signup-email"
              className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1"
            >
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                id="signup-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-12 pl-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                placeholder="student@university.edu"
              />
              <Mail className="absolute right-4 top-4 w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1"
            >
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-14 pl-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4 text-slate-400 hover:text-brand-blue transition-colors"
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
              htmlFor="signup-confirm-password"
              className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1"
            >
              تأكيد كلمة المرور
            </label>
            <div className="relative">
              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pr-14 pl-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-4 text-slate-400 hover:text-brand-blue transition-colors"
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
            className="w-full flex items-center justify-center gap-3 bg-brand-blue hover:bg-brand-sky text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-brand-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>جاري إنشاء الحساب...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-6 h-6" />
                <span>إنشاء حساب</span>
              </>
            )}
          </button>
        </form>

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
          onClick={handleGoogleSignUp}
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
          <span>التسجيل باستخدام Google</span>
        </button>

        <div className="mt-10 text-center space-y-4">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            لديك حساب بالفعل؟{" "}
            <button
              onClick={() => onNavigate("login")}
              className="text-brand-blue hover:text-brand-sky font-bold transition-colors"
            >
              تسجيل الدخول
            </button>
          </p>
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة إلى الصفحة الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
}
