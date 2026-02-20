"use client";

import {
  Shield,
  LogOut,
  Sun,
  Moon,
  MessageSquare,
  User,
  GraduationCap,
  FileText,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useRouter, usePathname } from "next/navigation";
import { NotificationDropdown } from "./NotificationDropdown";

export const Header = React.memo(function Header() {
  const { user, isAdmin, isAdminLoading, adminRole, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    const audio = new Audio("/lightswitch.mp3");
    // Play only the first 0.3 seconds to avoid the repeated/long sound
    audio.currentTime = 0;
    audio.play().catch((e) => console.error("Error playing sound:", e));

    // Stop the sound after 300ms
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 300);
  };

  const handleThemeToggle = () => {
    playToggleSound();
    toggleTheme();
  };

  const handleNavigate = (page: string, id?: string) => {
    router.push(id ? `/${page}/${id}` : `/${page}`);
    setIsMobileMenuOpen(false); // إغلاق القائمة المحمولة عند الانتقال
  };

  return (
    <header className="bg-white/90 dark:bg-brand-navy/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo/Brand */}
          <button
            onClick={() => handleNavigate("home")}
            className="flex items-center text-slate-900 dark:text-white hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <Image
              src="/logo.png"
              alt="Masar X Logo"
              width={48}
              height={48}
              className="object-contain w-12 h-12"
              priority
            />
          </button>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            {/* Desktop Navigation - Hidden on mobile, shown on tablet/desktop */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-2">
              <button
                onClick={() => handleNavigate("home")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "home"
                    ? "bg-brand-blue/10 text-brand-blue"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                الرئيسية
              </button>

              <button
                onClick={() => handleNavigate("news")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "news"
                    ? "bg-brand-blue/10 text-brand-blue"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                الأخبار
              </button>

              <button
                onClick={() => handleNavigate("subjects")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "subjects"
                    ? "bg-brand-blue/10 text-brand-blue"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                المواد
              </button>

              <button
                onClick={() => handleNavigate("courses")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "courses" ||
                  currentPage.startsWith("courses/")
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                الكورسات
              </button>

              <button
                onClick={() => handleNavigate("quizzes")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "quizzes"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                الامتحانات
              </button>

              <button
                onClick={() => handleNavigate("ai-assistant")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "ai-assistant"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                AI assistant
              </button>

              {isMounted && user ? (
                <>
                  {isAdminLoading ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-400">
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    isAdmin && (
                      <button
                        onClick={() => handleNavigate("admin")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          currentPage === "admin"
                            ? "bg-brand-orange/10 text-brand-orange"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        الإدارة
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handleNavigate("profile")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      currentPage === "profile"
                        ? "bg-brand-blue/10 text-brand-blue"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    الملف الشخصي
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    خروج
                  </button>
                </>
              ) : (
                isMounted && (
                  <>
                    <button
                      onClick={() => handleNavigate("signup")}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-brand-blue text-white hover:bg-brand-sky shadow-lg shadow-brand-blue/25 transition-all duration-200"
                    >
                      تسجيل
                    </button>
                    <button
                      onClick={() => handleNavigate("login")}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                      دخول
                    </button>
                  </>
                )
              )}
            </div>

            {/* Right side elements - Always visible */}
            <div className="flex items-center gap-2">
              {/* Notifications Dropdown */}
              <NotificationDropdown />

              {/* Theme Toggle Button - Always visible */}
              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={
                  theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"
                }
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {/* Mobile Menu Button - Mobile only, hidden on tablet+ */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden relative w-10 h-10 flex flex-col items-center justify-center rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 transition-all duration-300 group overflow-hidden"
                aria-label="قائمة التنقل"
              >
                <div
                  className={`w-6 h-0.5 bg-brand-blue rounded-full transition-all duration-400 absolute ${
                    isMobileMenuOpen
                      ? "translate-y-0 rotate-45 w-6"
                      : "-translate-y-1.5 w-4 mr-auto ml-2"
                  }`}
                />
                <div
                  className={`w-6 h-0.5 bg-brand-blue rounded-full transition-all duration-400 ${
                    isMobileMenuOpen
                      ? "opacity-0 -translate-x-8"
                      : "opacity-100"
                  }`}
                />
                <div
                  className={`w-6 h-0.5 bg-brand-blue rounded-full transition-all duration-400 absolute ${
                    isMobileMenuOpen
                      ? "translate-y-0 -rotate-45 w-6"
                      : "translate-y-1.5 w-4 ml-auto mr-2"
                  }`}
                />
              </button>
            </div>
          </nav>

          {/* Mobile Menu Content */}
          <div
            className={`lg:hidden fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm transition-all duration-500 ${
              isMounted && isMobileMenuOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              className={`fixed top-14 left-0 right-0 bg-white dark:bg-brand-navy border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[calc(100vh-3.5rem)] overflow-y-auto transition-all duration-500 ease-out transform ${
                isMounted && isMobileMenuOpen
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-8 opacity-0"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="flex flex-col px-4 py-6 space-y-2">
                {/* Mobile Navigation Links */}
                <button
                  onClick={() => handleNavigate("home")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                    currentPage === "home"
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-xl">🏠</span>
                  <span>الرئيسية</span>
                </button>

                <button
                  onClick={() => handleNavigate("news")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                    currentPage === "news"
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-xl">📰</span>
                  <span>الأخبار</span>
                </button>

                <button
                  onClick={() => handleNavigate("subjects")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                    currentPage === "subjects"
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-xl">📚</span>
                  <span>المواد</span>
                </button>

                {isMounted && isAdmin && adminRole === "doctor" && (
                  <button
                    onClick={() => handleNavigate("courses")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                      currentPage === "courses"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-xl">🎓</span>
                    <span>الكورسات</span>
                  </button>
                )}

                <button
                  onClick={() => handleNavigate("quizzes")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                    currentPage === "quizzes"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-xl">📝</span>
                  <span>الامتحانات</span>
                </button>

                <button
                  onClick={() => handleNavigate("ai-assistant")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                    currentPage === "ai-assistant"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-xl">💬</span>
                  <span>AI assistant</span>
                </button>

                <button
                  onClick={() => handleNavigate("add-summary")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                    currentPage === "add-summary"
                      ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-xl">➕</span>
                  <span>إضافة ملخص</span>
                </button>

                {isMounted && user ? (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                    {isAdmin && (
                      <button
                        onClick={() => handleNavigate("admin")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                          currentPage === "admin"
                            ? "bg-brand-orange/10 text-brand-orange"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <span className="text-xl">🛡️</span>
                        <span>الإدارة</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleNavigate("profile")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all touch-manipulation ${
                        currentPage === "profile"
                          ? "bg-brand-blue/10 text-brand-blue"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <span className="text-xl">👤</span>
                      <span>الملف الشخصي</span>
                    </button>

                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all touch-manipulation"
                    >
                      <span className="text-xl">🚪</span>
                      <span>خروج</span>
                    </button>
                  </>
                ) : (
                  isMounted && (
                    <>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                      <button
                        onClick={() => handleNavigate("signup")}
                        className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-bold bg-brand-blue text-white shadow-lg shadow-brand-blue/20 transition-all touch-manipulation"
                      >
                        <span className="text-xl">📝</span>
                        <span>تسجيل جديد</span>
                      </button>

                      <button
                        onClick={() => handleNavigate("login")}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all touch-manipulation"
                      >
                        <span className="text-xl">🔑</span>
                        <span>تسجيل الدخول</span>
                      </button>
                    </>
                  )
                )}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});
