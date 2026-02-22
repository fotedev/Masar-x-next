"use client";

import {
  Shield,
  LogOut,
  Sun,
  Moon,
  GraduationCap,
  FileText,
  Lock,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useRouter, usePathname } from "next/navigation";
import { NotificationDropdown } from "./NotificationDropdown";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

export const Header = React.memo(function Header() {
  const {
    user,
    loading,
    isAdmin,
    isAdminLoading,
    signOut,
    avatarUrl,
    displayName,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Visibility Logic (Obfuscated)
  const [showAccessInput, setShowAccessInput] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [hasSecretAccess, setHasSecretAccess] = useState(false);
  const [isMatrixActive, setIsMatrixActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const logoClickCount = useRef(0);
  const logoClickTimeout = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const enterMatrix = async () => {
    setIsMatrixActive(true);

    if (user) {
      try {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ show_extra_assets: true })
          .eq("id", user.id);

        if (updateError) throw updateError;
      } catch (e) {
        console.error("Failed to persist access:", e);
      }
    }

    setTimeout(() => {
      setIsMatrixActive(false);
      setHasSecretAccess(true);
      setShowAccessInput(false);
      handleNavigate("non-academic");
    }, 4000);
  };

  // Fetch profile to check obfuscated visibility flag
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("show_extra_assets")
          .eq("id", user.id)
          .single();
        setProfile(data);
      };
      fetchProfile();

      // Listen for profile updates from the Profile page
      const handleProfileUpdate = (event: any) => {
        if (
          event.detail &&
          typeof event.detail.show_extra_assets === "boolean"
        ) {
          setProfile((prev: any) => ({
            ...prev,
            show_extra_assets: event.detail.show_extra_assets,
          }));
        }
      };

      window.addEventListener("profileUpdate", handleProfileUpdate);
      return () =>
        window.removeEventListener("profileUpdate", handleProfileUpdate);
    }
  }, [user]);

  const isTRWVisible =
    isMounted && (hasSecretAccess || profile?.show_extra_assets === true);

  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimeout.current) clearTimeout(logoClickTimeout.current);

    if (logoClickCount.current >= 5) {
      setShowAccessInput(true);
      logoClickCount.current = 0;
    } else {
      logoClickTimeout.current = setTimeout(() => {
        logoClickCount.current = 0;
        handleNavigate("home");
      }, 500);
    }
  };

  const verifyAccessKey = async () => {
    if (isVerifying) return;

    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast.error("النظام مغلق", {
        description: `محاولات كثيرة جداً. حاول مرة أخرى بعد ${remaining} ثانية.`,
      });
      return;
    }

    if (!accessKey.trim()) {
      toast.error("مطلوب إدخال الكود");
      return;
    }

    try {
      setIsVerifying(true);
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("system_access_codes")
        .select("*")
        .eq("access_key", accessKey.trim())
        .gt("expires_at", now)
        .single();

      if (data && !error) {
        if (data.used_count >= data.max_uses) {
          toast.error("خطأ في النظام", {
            description:
              "عذراً، هذا الكود استنفد جميع محاولات الاستخدام المتاحة.",
          });
          setAttempts((prev) => prev + 1);
          return;
        }

        setAttempts(0);
        setLockoutUntil(null);

        const { error: updateError } = await supabase
          .from("system_access_codes")
          .update({ used_count: data.used_count + 1 })
          .eq("id", data.id);

        if (updateError) throw updateError;

        enterMatrix();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 5) {
          const lockTime = Date.now() + 30 * 1000;
          setLockoutUntil(lockTime);
          toast.error("تنبيه أمني", {
            description: "محاولات فاشلة كثيرة. تم قفل النظام لمدة 30 ثانية.",
          });
        } else {
          toast.error("خطأ في النظام", {
            description: "الكود الذي أدخلته غير صحيح أو منتهي الصلاحية.",
          });
        }
      }
    } catch (err) {
      console.error("Verification error:", err);
      toast.error("خطأ في الاتصال");
    } finally {
      setIsVerifying(false);
    }
  };

  const currentPage =
    pathname === "/" ? "home" : pathname?.substring(1) || "home";

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch {
      // ignore
    }
  };

  const playToggleSound = () => {
    // Clean up previous audio and timeout
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio("/lightswitch.mp3");
    audioRef.current = audio;
    audio.play().catch(() => {
      // Silently handle autoplay restrictions
    });

    audioTimeoutRef.current = setTimeout(() => {
      if (audioRef.current === audio) {
        audio.pause();
        audio.currentTime = 0;
        audioRef.current = null;
      }
    }, 300);
  };

  const handleThemeToggle = () => {
    playToggleSound();
    toggleTheme();
  };

  const handleNavigate = (page: string, id?: string) => {
    router.push(id ? `/${page}/${id}` : `/${page}`);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Matrix Entry Animation Overlay */}
      {isMatrixActive && (
        <div
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden font-mono"
          dir="ltr"
        >
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="relative text-center space-y-8 p-4">
            <div className="flex justify-center gap-1">
              {"Welcome to the real world".split("").map((char, i) => (
                <span
                  key={i}
                  className="text-red-600 text-xl sm:text-4xl font-bold animate-pulse inline-block"
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    opacity: 0,
                    animation: `matrix-fade-in 0.5s forwards ${i * 0.15}s, pulse 2s infinite ${i * 0.15 + 2}s`,
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </div>
            <div className="h-1 w-0 bg-red-600 mx-auto animate-matrix-line" />
          </div>
          <style jsx global>{`
            @keyframes matrix-fade-in {
              from {
                opacity: 0;
                transform: translateY(10px);
                filter: blur(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
                filter: blur(0);
              }
            }
            @keyframes matrix-line {
              0% {
                width: 0;
                opacity: 0;
              }
              50% {
                width: 100%;
                opacity: 1;
              }
              100% {
                width: 80%;
                opacity: 0.5;
              }
            }
            .animate-matrix-line {
              animation: matrix-line 3s ease-in-out forwards 1s;
            }
          `}</style>
        </div>
      )}

      <header className="bg-white/95 dark:bg-brand-navy/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/5 sticky top-0 z-50 shadow-sm dark:shadow-black/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-15 sm:h-[60px]">
            <div className="relative flex items-center mr-4 sm:mr-8">
              <button
                onClick={handleLogoClick}
                className="flex items-center text-slate-900 dark:text-white hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <Image
                  src="/logo.png"
                  alt="Masar X Logo"
                  width={48}
                  height={48}
                  className="object-contain w-10 h-10 sm:w-12 sm:h-12"
                  priority
                />
              </button>

              {showAccessInput && (
                <div className="absolute top-16 right-0 bg-white dark:bg-brand-navy border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl z-[100] w-64 animate-in fade-in slide-in-from-top-4 duration-300">
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-right">
                    System Authentication
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      placeholder="Input key"
                      className="bg-slate-100 dark:bg-white/5 border-none rounded-lg px-3 py-2 text-sm w-full focus:ring-1 focus:ring-red-500 transition-all outline-none text-right"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && verifyAccessKey()}
                    />
                    <button
                      onClick={verifyAccessKey}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAccessInput(false)}
                    className="mt-2 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 w-full text-center underline"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            <nav className="flex items-center justify-end lg:justify-between">
              <div className="hidden lg:flex items-center justify-start">
                {/* ── Navigation Links ── */}
                <div className="flex items-center gap-0.5 lg:ml-8">
                  <button
                    onClick={() => handleNavigate("home")}
                    className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                      isMounted && currentPage === "home"
                        ? "text-brand-blue"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    الرئيسية
                    {isMounted && currentPage === "home" && (
                      <span className="absolute bottom-0.5 right-3 left-3 h-0.5 bg-brand-blue rounded-full" />
                    )}
                  </button>

                  {isTRWVisible && (
                    <button
                      onClick={() => handleNavigate("non-academic")}
                      className={`relative px-3.5 py-2 rounded-lg text-sm font-bold transition-all duration-500 ${
                        isMounted &&
                        (currentPage === "non-academic" ||
                          currentPage.startsWith("non-academic/"))
                          ? "text-red-600 shadow-[0_0_12px_rgba(220,38,38,0.2)]"
                          : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 animate-pulse"
                      }`}
                    >
                      TRW
                    </button>
                  )}

                  <button
                    onClick={() => handleNavigate("news")}
                    className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isMounted && currentPage === "news"
                        ? "text-brand-blue"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    الأخبار
                    {isMounted && currentPage === "news" && (
                      <span className="absolute bottom-0.5 right-3.5 left-3.5 h-0.5 bg-brand-blue rounded-full" />
                    )}
                  </button>

                  {/* Thin separator */}
                  <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />

                  <button
                    onClick={() => handleNavigate("subjects")}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isMounted && currentPage === "subjects"
                        ? "text-brand-blue bg-brand-blue/8"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    المواد
                  </button>

                  <button
                    onClick={() => handleNavigate("courses")}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isMounted &&
                      (currentPage === "courses" ||
                        currentPage.startsWith("courses/"))
                        ? "text-green-600 dark:text-green-400 bg-green-500/8"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    الكورسات
                  </button>

                  <button
                    onClick={() => handleNavigate("quizzes")}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isMounted && currentPage === "quizzes"
                        ? "text-purple-600 dark:text-purple-400 bg-purple-500/8"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    الامتحانات
                  </button>

                  <button
                    onClick={() => handleNavigate("ai-assistant")}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isMounted && currentPage === "ai-assistant"
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/8"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path d="M12 8V4H8" />
                      <rect width="16" height="12" x="4" y="8" rx="2" />
                      <path d="M2 14h2" />
                      <path d="M20 14h2" />
                      <path d="M15 13v2" />
                      <path d="M9 13v2" />
                    </svg>
                    مساعدة
                  </button>
                </div>

                {/* ── Actions ── */}
                <div className="flex items-center gap-1 ml-auto">
                  {/* Subtle separator before actions */}
                  <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mr-1" />

                  <NotificationDropdown />

                  <button
                    onClick={handleThemeToggle}
                    className="p-3 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all duration-200"
                    aria-label={
                      theme === "dark"
                        ? "تفعيل الوضع الفاتح"
                        : "تفعيل الوضع الداكن"
                    }
                  >
                    {theme === "dark" ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                  </button>

                  {!isMounted || loading ? (
                    // Skeleton placeholder while auth state is resolving — prevents flash
                    <div className="flex items-center gap-2 ml-1">
                      <div className="h-8 w-20 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                  ) : user ? (
                    <>
                      {!isAdminLoading && isAdmin && (
                        <>
                          <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" />
                          <button
                            onClick={() => handleNavigate("admin")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              currentPage === "admin"
                                ? "bg-brand-orange/10 text-brand-orange"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5"
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                            الإدارة
                          </button>
                        </>
                      )}

                      <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" />

                      {/* Profile avatar */}
                      <button
                        onClick={() => handleNavigate("profile")}
                        aria-label="الملف الشخصي"
                        title="الملف الشخصي"
                        className={`relative w-9 h-9 rounded-full overflow-hidden transition-all duration-200 ${
                          currentPage === "profile"
                            ? "ring-2 ring-brand-blue ring-offset-1 dark:ring-offset-brand-navy/90"
                            : "ring-1 ring-slate-200 dark:ring-white/10 hover:ring-2 hover:ring-brand-blue/40"
                        }`}
                      >
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={
                              displayName ||
                              user?.email?.split("@")[0] ||
                              "User"
                            }
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs">
                            {(displayName || user?.email?.split("@")[0] || "U")
                              .trim()
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                        )}
                      </button>

                      {/* Logout */}
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
                      >
                        <LogOut className="w-4 h-4" />
                        خروج
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" />
                      <button
                        onClick={() => handleNavigate("login")}
                        className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all duration-200"
                      >
                        دخول
                      </button>
                      <button
                        onClick={() => handleNavigate("signup")}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky shadow-md shadow-brand-blue/20 transition-all duration-200"
                      >
                        تسجيل
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="lg:hidden flex items-center gap-2 flex-row-reverse sm:flex-row">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden relative w-10 h-10 flex flex-col items-center justify-center rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 transition-all duration-300 group z-[70]"
                  aria-label="قائمة التنقل"
                >
                  <div
                    className={`w-6 h-0.5 bg-brand-blue rounded-full transition-all duration-400 absolute ${isMobileMenuOpen ? "translate-y-0 rotate-45 w-6" : "-translate-y-1.5 w-4 mr-auto ml-2"}`}
                  />
                  <div
                    className={`w-6 h-0.5 bg-brand-blue rounded-full transition-all duration-400 ${isMobileMenuOpen ? "opacity-0 scale-x-0" : "opacity-100"}`}
                  />
                  <div
                    className={`w-6 h-0.5 bg-brand-blue rounded-full transition-all duration-400 absolute ${isMobileMenuOpen ? "translate-y-0 -rotate-45 w-6" : "translate-y-1.5 w-4 ml-auto mr-2"}`}
                  />
                </button>

                <div className="flex items-center gap-2">
                  <NotificationDropdown />
                  <button
                    onClick={handleThemeToggle}
                    className="p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label={
                      theme === "dark"
                        ? "تفعيل الوضع الفاتح"
                        : "تفعيل الوضع الداكن"
                    }
                  >
                    {theme === "dark" ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </nav>

            <div
              className={`lg:hidden fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm transition-all duration-500 ${isMounted && isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div
                className={`fixed top-14 left-0 right-0 bg-white dark:bg-brand-navy border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[calc(100vh-3.5rem)] overflow-y-auto transition-all duration-500 ease-out transform ${isMounted && isMobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <nav className="flex flex-col px-4 py-6 space-y-2">
                  <button
                    onClick={() => handleNavigate("home")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "home" ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    <span className="text-xl">🏠</span>
                    <span>الرئيسية</span>
                  </button>
                  {isTRWVisible && (
                    <button
                      onClick={() => handleNavigate("non-academic")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold ${currentPage === "non-academic" ? "bg-red-600/10 text-red-600" : "text-red-500"}`}
                    >
                      <span>The Real World</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleNavigate("news")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "news" ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    <span className="text-xl">📰</span>
                    <span>الأخبار</span>
                  </button>
                  <button
                    onClick={() => handleNavigate("subjects")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "subjects" ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    <span className="text-xl">📚</span>
                    <span>المواد</span>
                  </button>
                  <button
                    onClick={() => handleNavigate("courses")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "courses" || currentPage.startsWith("courses/") ? "bg-green-500/10 text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    <span className="text-xl">🎓</span>
                    <span>الكورسات</span>
                  </button>
                  <button
                    onClick={() => handleNavigate("quizzes")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "quizzes" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    <span className="text-xl">📝</span>
                    <span>الامتحانات</span>
                  </button>
                  <button
                    onClick={() => handleNavigate("ai-assistant")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "ai-assistant" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    <span className="text-xl">🤖</span>
                    <span>مساعدة</span>
                  </button>
                  {!isMounted || loading ? (
                    // Skeleton while auth state resolves — prevents mobile menu flash
                    <>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                      <div className="flex flex-col gap-2 px-4">
                        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      </div>
                    </>
                  ) : user ? (
                    <>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                      {!isAdminLoading && isAdmin && (
                        <button
                          onClick={() => handleNavigate("admin")}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "admin" ? "bg-brand-orange/10 text-brand-orange" : "text-slate-600 dark:text-slate-400"}`}
                        >
                          <span className="text-xl">🛡️</span>
                          <span>الإدارة</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleNavigate("profile")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold ${currentPage === "profile" ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600 dark:text-slate-400"}`}
                      >
                        <span className="text-xl">👤</span>
                        <span>الملف الشخصي</span>
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-red-600"
                      >
                        <span className="text-xl">🚪</span>
                        <span>خروج</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                      <button
                        onClick={() => handleNavigate("signup")}
                        className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-bold bg-brand-blue text-white"
                      >
                        <span className="text-xl">📝</span>
                        <span>تسجيل جديد</span>
                      </button>
                      <button
                        onClick={() => handleNavigate("login")}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold"
                      >
                        <span className="text-xl">🔑</span>
                        <span>تسجيل الدخول</span>
                      </button>
                    </>
                  )}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
});
