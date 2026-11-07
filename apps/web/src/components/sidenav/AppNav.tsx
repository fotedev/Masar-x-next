"use client";

import { Fragment, memo, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useLocale, useTranslations } from "next-intl";
import { logger } from "@/lib/logger";

import { useAuth } from "@/contexts/AuthContext";
import { DynamicLogo } from "@/components/DynamicLogo";
import { MobileNav } from "@/components/header/MobileNav";
import { SecretAccessGate } from "@/components/header/SecretAccessGate";
import { SideNav } from "./SideNav";

export const SIDENAV_EXPANDED_KEY = "masarx_sidenav_expanded";
/** Rail width shared with Layout's content padding via a root CSS variable. */
const SIDENAV_WIDTH_VAR = "--sidenav-w";

/**
 * App navigation shell — replaces the old fixed top navbar (Header) with a
 * collapsible side rail on desktop and a slim logo-only top bar + drawer on
 * mobile (owner decision 2026-11-05: no burger icon anywhere; the logo
 * itself toggles). The logo also keeps the 5-click secret access gate.
 */
export const AppNav = memo(function AppNav() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const tMobileNav = useTranslations("mobileNav");
  const locale = useLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const { user, profile: authProfile, loading, isAdmin, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [sidenavExpanded, setSidenavExpanded] = useState(false);

  // Visibility Logic (Obfuscated) — carried over from the old Header.
  const [showAccessInput, setShowAccessInput] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [hasSecretAccess, setHasSecretAccess] = useState(false);
  const [isMatrixActive, setIsMatrixActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const logoClickCount = useRef(0);
  const logoClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    let saved = false;
    try {
      saved = localStorage.getItem(SIDENAV_EXPANDED_KEY) === "1";
    } catch {
      // storage unavailable — default collapsed
    }
    if (saved) setSidenavExpanded(true);
  }, []);

  // Content push: Layout pads by the same variable the rail animates, so
  // the two stay in sync without prop drilling (SSR default = collapsed).
  useEffect(() => {
    document.documentElement.style.setProperty(
      SIDENAV_WIDTH_VAR,
      sidenavExpanded ? "15rem" : "4rem",
    );
  }, [sidenavExpanded]);

  const toggleSidenav = () => {
    setSidenavExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDENAV_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const button = mobileMenuButtonRef.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = "";
      document.body.style.touchAction = prevTouchAction;
      button?.focus();
    };
  }, [isMounted, isMobileMenuOpen]);

  const enterMatrix = async () => {
    setIsMatrixActive(true);

    // Entitlement is granted server-side by redeem_system_access_code
    // (migration 018) — no client-side profiles write here; the guard
    // trigger would reject it for never-entitled users anyway (audit H36).

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

  /**
   * Shared logo click handler: single click runs the surface's action after
   * a short debounce (desktop rail = toggle, mobile top bar = open drawer),
   * five rapid clicks reveal the secret access gate. Mobile skips the
   * debounce entirely — a 500ms drawer delay reads as a broken button.
   */
  const registerLogoClick = (singleClickAction: () => void, immediate = false) => {
    if (immediate) {
      singleClickAction();
      return;
    }
    logoClickCount.current += 1;
    if (logoClickTimeout.current) clearTimeout(logoClickTimeout.current);

    if (logoClickCount.current >= 5) {
      setShowAccessInput(true);
      logoClickCount.current = 0;
    } else {
      logoClickTimeout.current = setTimeout(() => {
        logoClickCount.current = 0;
        singleClickAction();
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

      // Verification + grant run server-side via a security-definer RPC so
      // the key values never cross the wire, used_count is consumed
      // atomically, and show_extra_assets entitlement is granted by the
      // database — never by a client-side profiles write (migration 018;
      // audit H36: the old verify-then-client-update path let any user
      // PATCH their own entitlement straight through PostgREST).
      const { data: result, error } = await supabase.rpc(
        "redeem_system_access_code",
        { p_access_key: accessKey.trim() },
      );

      const outcome = (result ?? {}) as { success?: boolean; reason?: string };

      if (!error && outcome.success) {
        setAttempts(0);
        setLockoutUntil(null);
        enterMatrix();
      } else if (!error && outcome.reason === "exhausted") {
        toast.error(tHeader("access.systemErrorTitle"), {
          description: tHeader("access.maxUsesDescription"),
        });
        setAttempts((prev) => prev + 1);
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
    },
    {
      key: "news",
      page: "news",
      label: tNav("news"),
      isActive: () => isMounted && currentPage === "news",
    },
    {
      key: "subjects",
      page: "subjects",
      label: tNav("subjects"),
      isActive: () => isMounted && currentPage === "subjects",
    },
    {
      key: "materials",
      page: "materials",
      label: tNav("materials"),
      isActive: () => isMounted && currentPage === "materials",
    },
    {
      key: "schedules",
      page: "schedules",
      label: tNav("schedules"),
      isActive: () => isMounted && currentPage === "schedules",
    },
    {
      key: "courses",
      page: "courses",
      label: tNav("courses"),
      isActive: () =>
        isMounted &&
        (currentPage === "courses" || currentPage.startsWith("courses/")),
    },
    {
      key: "quizzes",
      page: "quizzes",
      label: tNav("quizzes"),
      isActive: () => isMounted && currentPage === "quizzes",
    },
    {
      key: "assistant",
      page: "ai-assistant",
      label: tNav("assistant"),
      isActive: () => isMounted && currentPage === "ai-assistant",
    },
    {
      key: "downloads",
      page: "downloads",
      label: tNav("downloads"),
      isActive: () => isMounted && currentPage === "downloads",
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

      <SideNav
        isMounted={isMounted}
        expanded={sidenavExpanded}
        onLogoActivate={() => registerLogoClick(toggleSidenav)}
        items={primaryNavItems}
        trwVisible={isTRWVisible}
        currentPage={currentPage}
        loading={loading}
        user={user}
        authProfile={authProfile}
        isAdmin={isAdmin}
        isAdminLoading={false}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        tNav={tNav}
        tMobileNav={tMobileNav}
      />

      {/* Mobile: slim top bar, logo-only (tapping it opens the drawer). */}
      <header
        dir={dir}
        className="lg:hidden fixed top-0 inset-x-0 z-header flex h-14 items-center border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md"
      >
        <button
          ref={mobileMenuButtonRef}
          type="button"
          aria-label={
            isMobileMenuOpen
              ? tMobileNav("closeMenuAriaLabel")
              : tMobileNav("openMenuAriaLabel")
          }
          aria-haspopup="dialog"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() =>
            registerLogoClick(() => setIsMobileMenuOpen(true), true)
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors focus:outline-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6]"
        >
          <DynamicLogo
            variant="mark"
            width={32}
            height={32}
            className="object-contain w-8 h-8"
            priority
          />
        </button>
      </header>

      <MobileNav
        dir={dir}
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
        isAdminLoading={false}
        handleSignOut={handleSignOut}
        tNav={tNav}
        tMobileNav={tMobileNav}
      />
    </Fragment>
  );
});
