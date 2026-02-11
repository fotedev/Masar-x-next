"use client";

import {
  Plus,
  Shield,
  LogOut,
  Sun,
  Moon,
  MessageSquare,
  User,
  Menu,
  X,
  GraduationCap,
  FileText,
} from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useRouter, usePathname } from "next/navigation";
import { NotificationDropdown } from "./NotificationDropdown";

export const Header = React.memo(function Header() {
  const { user, isAdmin, isAdminLoading, adminRole, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const currentPage =
    pathname === "/" ? "home" : pathname?.substring(1) || "home";

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
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
            className="flex items-center text-slate-900 dark:text-white hover:opacity-80 transition-opacity min-w-0"
          >
            <img
              src="/logo.png"
              alt="Masar X Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
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

              <button
                onClick={() => handleNavigate("add-summary")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  currentPage === "add-summary"
                    ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Plus className="w-4 h-4" />
                إضافة ملخص
              </button>

              {user ? (
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
              )}
            </div>

            {/* Right side elements - Always visible */}
            <div className="flex items-center gap-2">
              {/* Notifications Dropdown */}
              <NotificationDropdown />

              {/* Theme Toggle Button - Always visible */}
              <button
                onClick={toggleTheme}
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
                className="lg:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="قائمة التنقل"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </nav>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div
              className="lg:hidden fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div
                className="fixed top-14 left-0 right-0 bg-white dark:bg-brand-navy border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in slide-in-from-top duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <div className="flex justify-end p-4 pb-0">
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="إغلاق القائمة"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="flex flex-col px-4 pb-4 space-y-2">
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

                  {isAdmin && adminRole === "doctor" && (
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

                  {/* User Actions */}
                  {user ? (
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
                  )}
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
