import { Shield, User, LogOut, LogIn, UserPlus } from "lucide-react";

interface UserMenuProps {
  isMounted: boolean;
  loading: boolean;
  user: { id: string } | null;
  isAdmin: boolean;
  isAdminLoading: boolean;
  handleNavigate: (page: string) => void;
  handleSignOut: () => void;
  tNav: (key: string) => string;
}

export function UserMenu({
  isMounted,
  loading,
  user,
  isAdmin,
  isAdminLoading,
  handleNavigate,
  handleSignOut,
  tNav,
}: UserMenuProps) {
  if (!isMounted || loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-24 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-x-2">
        {!isAdminLoading && isAdmin && (
          <button
            onClick={() => handleNavigate("admin-dashboard")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-brand-orange hover:bg-slate-100/70 dark:hover:bg-white/5 border border-transparent hover:border-brand-orange/20 transition-all shadow-sm hover:shadow-md"
            type="button"
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </button>
        )}
        <button
          onClick={() => handleNavigate("profile")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/5 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm hover:shadow-md"
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
    );
  }

  return (
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
  );
}
