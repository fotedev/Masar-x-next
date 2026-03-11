import { LanguageToggle } from "../LanguageToggle";
import { Shield, User, LogOut, LogIn, UserPlus } from "lucide-react";

interface NavItem {
  key: string;
  page: string;
  label: string;
  isActive: () => boolean;
}

interface MobileNavProps {
  isMounted: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  mobileBackdropRef: React.RefObject<HTMLDivElement>;
  primaryNavItems: readonly NavItem[];
  handleNavigate: (page: string) => void;
  isTRWVisible: boolean;
  currentPage: string;
  loading: boolean;
  user: any;
  isAdmin: boolean;
  isAdminLoading: boolean;
  handleSignOut: () => void;
  tNav: (key: string) => string;
}

export function MobileNav({
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
}: MobileNavProps) {
  return (
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
          isMounted && isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
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
  );
}
