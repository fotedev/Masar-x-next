"use client";

import { Lock, LogIn, LogOut, Shield, User, UserPlus } from "lucide-react";
import React, { Fragment, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import { useRouter, usePathname } from "@/i18n/routing";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";

export const Header = React.memo(function Header() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const { user, loading, isAdmin, isAdminLoading, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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
  const [profile, setProfile] = useState<{
    show_extra_assets?: boolean;
  } | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileBackdropRef = useRef<HTMLDivElement | null>(null);

  const effectivePathname = isMounted ? (pathname ?? "/") : "/";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setHasEntered(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const update = () => {
      setIsScrolled(window.scrollY > 20);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    if (!isMobileMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      mobileMenuButtonRef.current?.focus();
    };
  }, [isMounted, isMobileMenuOpen]);

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
    if (user && !loading) {
      const fetchProfile = async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("show_extra_assets")
            .eq("id", user.id)
            .single();

          if (error) {
            // Silently handle cases where profile might not exist yet or RLS blocks it
            return;
          }
          setProfile(data);
        } catch (err) {
          // ignore
        }
      };
      fetchProfile();

      // Listen for profile updates from the Profile page
      const handleProfileUpdate = (event: Event) => {
        const customEvent = event as CustomEvent<{
          show_extra_assets?: boolean;
        }>;
        if (typeof customEvent.detail?.show_extra_assets === "boolean") {
          setProfile((prev) => ({
            ...(prev || {}),
            show_extra_assets: customEvent.detail.show_extra_assets,
          }));
        }
      };

      window.addEventListener("profileUpdate", handleProfileUpdate);
      return () =>
        window.removeEventListener("profileUpdate", handleProfileUpdate);
    } else if (!loading && !user) {
      // Clear profile if user logs out
      setProfile(null);
    }
  }, [user, loading]);

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
      toast.error(tHeader("access.lockedTitle"), {
        description: tHeader("access.lockedDescription", {
          seconds: remaining,
        }),
      });
      return;
    }

    if (!accessKey.trim()) {
      toast.error(tHeader("access.codeRequired"));
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
          toast.error(tHeader("access.systemErrorTitle"), {
            description: tHeader("access.maxUsesDescription"),
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
          toast.error(tHeader("access.securityAlertTitle"), {
            description: tHeader("access.locked30Description"),
          });
        } else {
          toast.error(tHeader("access.systemErrorTitle"), {
            description: tHeader("access.invalidOrExpiredDescription"),
          });
        }
      }
    } catch (err) {
      console.error("Verification error:", err);
      toast.error(tHeader("access.connectionError"));
    } finally {
      setIsVerifying(false);
    }
  };

  const normalizedPathname = effectivePathname.startsWith("/en")
    ? effectivePathname.replace(/^\/en(\/|$)/, "/")
    : effectivePathname;

  const currentPage =
    normalizedPathname === "/"
      ? "home"
      : normalizedPathname?.substring(1) || "home";

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch {
      // ignore
    }
  };

  const handleNavigate = (page: string, id?: string) => {
    if (page === "home") {
      router.push("/");
    } else {
      router.push(id ? `/${page}/${id}` : `/${page}`);
    }
    setIsMobileMenuOpen(false);
  };

  const primaryNavItems = [
    {
      key: "home",
      page: "home",
      label: tNav("home"),
      isActive: () => isMounted && currentPage === "home",
      activeText: "text-brand-blue",
      activeUnderline: "bg-brand-blue",
    },
    {
      key: "news",
      page: "news",
      label: tNav("news"),
      isActive: () => isMounted && currentPage === "news",
      activeText: "text-brand-blue",
      activeUnderline: "bg-brand-blue",
    },
    {
      key: "subjects",
      page: "subjects",
      label: tNav("subjects"),
      isActive: () => isMounted && currentPage === "subjects",
      activeText: "text-brand-blue",
      activeUnderline: "bg-brand-blue",
    },
    {
      key: "courses",
      page: "courses",
      label: tNav("courses"),
      isActive: () =>
        isMounted &&
        (currentPage === "courses" || currentPage.startsWith("courses/")),
      activeText: "text-green-600 dark:text-green-400",
      activeUnderline: "bg-green-600 dark:bg-green-400",
    },
    {
      key: "quizzes",
      page: "quizzes",
      label: tNav("quizzes"),
      isActive: () => isMounted && currentPage === "quizzes",
      activeText: "text-purple-600 dark:text-purple-400",
      activeUnderline: "bg-purple-600 dark:bg-purple-400",
    },
    {
      key: "assistant",
      page: "ai-assistant",
      label: tNav("assistant"),
      isActive: () => isMounted && currentPage === "ai-assistant",
      activeText: "text-emerald-600 dark:text-emerald-400",
      activeUnderline: "bg-emerald-600 dark:bg-emerald-400",
    },
  ] as const;

  return (
    <Fragment>
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

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          hasEntered
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        } ${
          isScrolled
            ? "bg-[#020617] border-b border-white/10 shadow-xl"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto h-full px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full">
            <div className="relative flex items-center gap-3">
              <button
                onClick={handleLogoClick}
                className="flex items-center text-white hover:opacity-80 transition-opacity flex-shrink-0"
                type="button"
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
                <div className="absolute top-16 start-0 bg-white dark:bg-brand-navy border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl z-[100] w-64 animate-in fade-in slide-in-from-top-4 duration-300">
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-start">
                    System Authentication
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      placeholder="Input key"
                      className="bg-slate-100 dark:bg-white/5 border-none rounded-lg px-3 py-2 text-sm w-full focus:ring-1 focus:ring-red-500 transition-all outline-none text-start"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && verifyAccessKey()}
                    />
                    <button
                      onClick={verifyAccessKey}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                      type="button"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAccessInput(false)}
                    className="mt-2 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 w-full text-center underline"
                    type="button"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center justify-center flex-1 px-6">
              <nav className="flex items-center gap-8">
                {primaryNavItems.map((item) => {
                  const active = item.isActive();
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavigate(item.page)}
                      className={`relative px-3 py-2 rounded-[6px] text-[14px] font-medium tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] ${
                        active
                          ? "text-white bg-[rgba(255,255,255,0.12)]"
                          : "text-[#a1a1aa] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                      } hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.96]`}
                      type="button"
                    >
                      {item.label}
                    </button>
                  );
                })}

                {isTRWVisible && (
                  <button
                    onClick={() => handleNavigate("non-academic")}
                    className={`relative px-3 py-2 rounded-[6px] text-[14px] font-medium tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.96] ${
                      isMounted && currentPage === "non-academic"
                        ? "text-white bg-[rgba(255,255,255,0.12)]"
                        : "text-[#a1a1aa] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                    }`}
                    type="button"
                  >
                    <span>The Real World</span>
                  </button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2">
                <LanguageToggle />

                {!isMounted || loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-24 rounded-lg bg-white/10 animate-pulse" />
                    <div className="h-9 w-24 rounded-lg bg-white/10 animate-pulse" />
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-2">
                    {!isAdminLoading && isAdmin && (
                      <button
                        onClick={() => handleNavigate("admin-dashboard")}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-brand-orange hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                        type="button"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleNavigate("profile")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                      type="button"
                    >
                      <User className="w-4 h-4" />
                      <span>{tNav("profile")}</span>
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50/70 dark:hover:bg-white/5 transition-colors"
                      type="button"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{tNav("logout")}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleNavigate("login")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                      type="button"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{tNav("login")}</span>
                    </button>
                    <button
                      onClick={() => handleNavigate("signup")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-brand-blue text-white hover:opacity-90 transition-opacity"
                      type="button"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{tNav("signup")}</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                ref={mobileMenuButtonRef}
                type="button"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-haspopup="dialog"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="lg:hidden flex flex-col items-center justify-center w-[40px] h-[40px] z-[100] bg-transparent/0 hover:bg-white/10 transition-colors duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6]"
              >
                <div className="relative flex flex-col items-center justify-center w-[24px] h-[18px]">
                  <span
                    className={`absolute block w-[24px] h-[2px] bg-[#ffffff] rounded-[2px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      isMobileMenuOpen
                        ? "top-[8px] rotate-45"
                        : "top-0 rotate-0"
                    }`}
                  />
                  <span
                    className={`absolute top-[8px] block w-[24px] h-[2px] bg-[#ffffff] rounded-[2px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      isMobileMenuOpen
                        ? "opacity-0 translate-x-[10px]"
                        : "opacity-100 translate-x-0"
                    }`}
                  />
                  <span
                    className={`absolute block w-[24px] h-[2px] bg-[#ffffff] rounded-[2px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      isMobileMenuOpen
                        ? "bottom-[8px] -rotate-45"
                        : "bottom-0 rotate-0"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        <div
          className={`lg:hidden fixed inset-0 z-[51] ${
            isMounted && isMobileMenuOpen
              ? "pointer-events-auto"
              : "pointer-events-none"
          }`}
        >
          <div
            ref={mobileBackdropRef}
            className={`absolute inset-0 bg-[rgba(0,0,0,0.85)] backdrop-blur-[12px] transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              isMounted && isMobileMenuOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsMobileMenuOpen(false);
              }
            }}
          />

          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            className={`absolute top-0 bottom-0 right-0 w-full md:w-[320px] bg-[#020617] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              isMounted && isMobileMenuOpen
                ? "translate-x-0"
                : "translate-x-full"
            }`}
          >
            <div className="pt-[80px] px-4 md:px-6 pb-6 overflow-y-auto max-h-[100vh] bg-[#020617]">
              <nav className="flex flex-col gap-4">
                {primaryNavItems.map((item) => {
                  const active = item.isActive();
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavigate(item.page)}
                      className={`flex items-center justify-between px-4 py-3 rounded-[6px] text-[18px] font-medium tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] ${
                        active
                          ? "text-white bg-[rgba(255,255,255,0.12)]"
                          : "text-[#a1a1aa] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                      } hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.96]`}
                      type="button"
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {isTRWVisible && (
                  <button
                    onClick={() => handleNavigate("non-academic")}
                    className={`flex items-center justify-between px-4 py-3 rounded-[6px] text-[18px] font-medium tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] ${
                      isMounted && currentPage === "non-academic"
                        ? "text-white bg-[rgba(255,255,255,0.12)]"
                        : "text-[#a1a1aa] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                    } hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.96]`}
                    type="button"
                  >
                    <span>The Real World</span>
                  </button>
                )}
              </nav>

              <div className="h-px bg-[rgba(255,255,255,0.08)] my-4" />

              <div className="flex items-center justify-between">
                <LanguageToggle />
              </div>

              <div className="h-px bg-[rgba(255,255,255,0.08)] my-4" />

              {!isMounted || loading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-11 rounded-xl bg-white/10 animate-pulse" />
                  <div className="h-11 rounded-xl bg-white/10 animate-pulse" />
                </div>
              ) : user ? (
                <div className="flex flex-col gap-2">
                  {!isAdminLoading && isAdmin && (
                    <button
                      onClick={() => handleNavigate("admin-dashboard")}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-brand-orange hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                      type="button"
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleNavigate("profile")}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                    type="button"
                  >
                    <User className="w-5 h-5" />
                    <span>{tNav("profile")}</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-red-600 hover:bg-red-50/70 dark:hover:bg-white/5 transition-colors"
                    type="button"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{tNav("logout")}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleNavigate("signup")}
                    className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-base font-bold bg-brand-blue text-white hover:opacity-90 transition-opacity"
                    type="button"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>{tNav("signup")}</span>
                  </button>
                  <button
                    onClick={() => handleNavigate("login")}
                    className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                    type="button"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>{tNav("login")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </Fragment>
  );
});
