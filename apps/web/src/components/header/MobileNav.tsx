import { type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageToggle } from "../LanguageToggle";
import { DynamicLogo } from "../DynamicLogo";
import {
  Home,
  Newspaper,
  BookOpen,
  GraduationCap,
  Brain,
  Sparkles,
  Globe,
  Shield,
  User,
  LogOut,
  LogIn,
  UserPlus,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  key: string;
  page: string;
  label: string;
  isActive: () => boolean;
}

interface MobileNavProps {
  dir: "rtl" | "ltr";
  isMounted: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  mobileBackdropRef: RefObject<HTMLDivElement>;
  primaryNavItems: readonly NavItem[];
  handleNavigate: (page: string) => void;
  isTRWVisible: boolean;
  currentPage: string;
  loading: boolean;
  user: { id: string; email?: string; user_metadata?: { full_name?: string } } | null;
  isAdmin: boolean;
  isAdminLoading: boolean;
  handleSignOut: () => void;
  tNav: (key: string) => string;
  tMobileNav: (key: string, values?: Record<string, string | number>) => string;
}

const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  news: Newspaper,
  subjects: BookOpen,
  courses: GraduationCap,
  quizzes: Brain,
  assistant: Sparkles,
};

export function MobileNav({
  dir,
  isMounted,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  mobileBackdropRef,
  primaryNavItems,
  handleNavigate,
  isTRWVisible,
  currentPage,
  loading,
  user,
  isAdmin,
  isAdminLoading,
  handleSignOut,
  tNav,
  tMobileNav,
}: MobileNavProps) {
  const isRTL = dir === "rtl";
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  const drawerVariants = {
    closed: {
      x: isRTL ? "100%" : "-100%",
      transition: { type: "spring" as const, stiffness: 320, damping: 32 },
    },
    open: {
      x: "0%",
      transition: {
        type: "spring" as const,
        stiffness: 320,
        damping: 32,
        staggerChildren: 0.04,
        delayChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    closed: { opacity: 0, x: isRTL ? 15 : -15 },
    open: { opacity: 1, x: 0 },
  };

  if (!isMounted) return null;

  const drawerContent = (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[9999] pointer-events-auto">
          {/* Backdrop overlay */}
          <motion.div
            ref={mobileBackdropRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md touch-none overscroll-none"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Mobile Navigation Drawer - Uses fixed viewport positioning to prevent clipped headers on scroll */}
          <motion.div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            initial="closed"
            animate="open"
            exit="closed"
            variants={drawerVariants}
            className="fixed inset-y-0 start-0 w-[min(340px,88vw)] h-[100dvh] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl z-[10000] flex flex-col border-e border-slate-200/80 dark:border-slate-800/80 overflow-hidden"
          >
            {/* Header section with logo & close button */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <DynamicLogo
                  width={36}
                  height={36}
                  className="object-contain w-9 h-9"
                  priority
                />
                <div className="flex flex-col">
                  <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400 dark:from-blue-400 dark:via-cyan-300 dark:to-sky-300 bg-clip-text text-transparent">
                    {tMobileNav("brand")}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {tMobileNav("platformSubtitle")}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                type="button"
                aria-label={tMobileNav("closeMenuAriaLabel")}
                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex flex-col flex-1 min-h-0 px-4 py-4 overflow-y-auto custom-scrollbar space-y-5">
              {/* User Profile / Greeting Card */}
              <motion.div variants={itemVariants}>
                {user ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900/80 dark:to-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[2px] shrink-0">
                      <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-950 flex items-center justify-center text-blue-600 dark:text-cyan-400 font-black text-lg">
                        {user.email?.[0]?.toUpperCase() || "U"}
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {user.user_metadata?.full_name || user.email?.split("@")[0] || tMobileNav("defaultUserName")}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                        {isAdmin ? tMobileNav("adminLabel") : tMobileNav("studentLabel")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 via-cyan-500/5 to-transparent border border-cyan-500/20 dark:border-cyan-500/10">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                      {tMobileNav("welcomeHeading")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {tMobileNav("welcomeMessage")}
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Primary Navigation Links */}
              <div className="space-y-1.5">
                <span className="px-3 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {tMobileNav("mainNavigation")}
                </span>

                <nav className="flex flex-col gap-1.5 pt-1">
                  {primaryNavItems.map((item) => {
                    const active = item.isActive();
                    const IconComponent = NAV_ICONS[item.key] || BookOpen;

                    return (
                      <motion.button
                        key={item.key}
                        variants={itemVariants}
                        onClick={() => handleNavigate(item.page)}
                        className={`group relative flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent text-cyan-600 dark:text-cyan-400 border-s-4 border-cyan-500 dark:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                            : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                        } active:scale-[0.98]`}
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                              active
                                ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                                : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:bg-cyan-500/10"
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <span>{item.label}</span>
                        </div>

                        {active ? (
                          <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                        ) : (
                          <ArrowIcon className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                        )}
                      </motion.button>
                    );
                  })}

                  {/* Special TRW Option */}
                  {isTRWVisible && (
                    <motion.button
                      variants={itemVariants}
                      onClick={() => handleNavigate("non-academic")}
                      className={`group relative flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 ${
                        isMounted && currentPage === "non-academic"
                          ? "bg-gradient-to-r from-purple-500/15 to-transparent text-purple-600 dark:text-purple-400 border-s-4 border-purple-500 font-black"
                          : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                      } active:scale-[0.98]`}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                          <Globe className="w-4 h-4" />
                        </div>
                        <span>{tMobileNav("theRealWorld")}</span>
                      </div>
                      <ArrowIcon className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                    </motion.button>
                  )}
                </nav>
              </div>

              <div className="h-px bg-slate-200/80 dark:bg-slate-800/80" />

              {/* Language Switcher */}
              <motion.div variants={itemVariants} className="px-1">
                <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
                    {tMobileNav("language")}
                  </span>
                  <LanguageToggle />
                </div>
              </motion.div>

              <div className="h-px bg-slate-200/80 dark:bg-slate-800/80" />

              {/* Account Actions */}
              <motion.div variants={itemVariants} className="space-y-2 pb-2">
                {!isMounted || loading ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-11 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
                    <div className="h-11 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
                  </div>
                ) : user ? (
                  <div className="flex flex-col gap-2">
                    {!isAdminLoading && isAdmin && (
                      <button
                        onClick={() => handleNavigate("admin-dashboard")}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
                        type="button"
                      >
                        <Shield className="w-5 h-5" />
                        <span>{tMobileNav("adminPanel")}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleNavigate("profile")}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-all"
                      type="button"
                    >
                      <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      <span>{tNav("profile")}</span>
                    </button>

                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-all"
                      type="button"
                    >
                      <LogOut className="w-5 h-5 text-red-500" />
                      <span>{tNav("logout")}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => handleNavigate("signup")}
                      className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-sm font-black bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:opacity-95 active:scale-[0.98] transition-all"
                      type="button"
                    >
                      <UserPlus className="w-5 h-5" />
                      <span>{tNav("signup")}</span>
                    </button>
                    <button
                      onClick={() => handleNavigate("login")}
                      className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-sm font-extrabold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-all"
                      type="button"
                    >
                      <LogIn className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      <span>{tNav("login")}</span>
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Footer status badge */}
            <div className="px-5 py-3 bg-slate-100/50 dark:bg-slate-900/30 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
              <span>{tMobileNav("version", { version: "0.5.6" })}</span>
              <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {tMobileNav("online")}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerContent, document.body);
}
