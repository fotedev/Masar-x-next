"use client";

import { Fragment, useState, useEffect, useRef, memo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter, usePathname } from "@/i18n/routing";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useTranslations, useLocale } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { logger } from "@/lib/logger";

import { DynamicLogo } from "./DynamicLogo";
import { DesktopNav } from "./header/DesktopNav";
import { MobileNav } from "./header/MobileNav";
import { UserMenu } from "./header/UserMenu";
import { SecretAccessGate } from "./header/SecretAccessGate";

export const Header = memo(function Header() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const locale = useLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
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

  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null!);
  const mobileBackdropRef = useRef<HTMLDivElement>(null!);

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
    const button = mobileMenuButtonRef.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      button?.focus();
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
        logger.error("Failed to persist access", e);
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
        } catch {
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
      logger.error("Verification error", err);
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
      <SecretAccessGate
        isMatrixActive={isMatrixActive}
        showAccessInput={showAccessInput}
        accessKey={accessKey}
        setAccessKey={setAccessKey}
        verifyAccessKey={verifyAccessKey}
        setShowAccessInput={setShowAccessInput}
      />

      <header
        dir={dir}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-[72px] ${
          hasEntered
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        } ${
          isScrolled
            ? "bg-[#020617] border-b border-white/10 shadow-xl"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto h-full px-4 md:px-6 lg:px-8 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-full gap-x-8">
            <div className="flex-1 flex items-center justify-start min-w-0">
              <button
                onClick={handleLogoClick}
                className="flex items-center text-white hover:opacity-80 transition-opacity flex-shrink-0 p-1"
                type="button"
              >
                <DynamicLogo
                  width={48}
                  height={48}
                  className="object-contain w-10 h-10 sm:w-12 sm:h-12"
                  priority
                />
              </button>
            </div>

            <div className="flex-[2] hidden lg:flex items-center justify-center min-w-0">
              <DesktopNav
                primaryNavItems={primaryNavItems}
                handleNavigate={handleNavigate}
                isTRWVisible={isTRWVisible}
                currentPage={currentPage}
              />
            </div>

            <div className="flex-1 flex items-center justify-end gap-x-2 min-w-0">
              <div className="hidden lg:flex items-center gap-x-2">
                <LanguageToggle />

                <UserMenu
                  isMounted={isMounted}
                  loading={loading}
                  user={user}
                  isAdmin={isAdmin}
                  isAdminLoading={isAdminLoading}
                  handleNavigate={handleNavigate}
                  handleSignOut={handleSignOut}
                  tNav={tNav}
                />
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

        <MobileNav
          isMounted={isMounted}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          mobileBackdropRef={mobileBackdropRef}
          primaryNavItems={primaryNavItems}
          handleNavigate={handleNavigate}
          isTRWVisible={isTRWVisible}
          currentPage={currentPage}
          loading={loading}
          user={user}
          isAdmin={isAdmin}
          isAdminLoading={isAdminLoading}
          handleSignOut={handleSignOut}
          tNav={tNav}
        />
      </header>
    </Fragment>
  );
});
