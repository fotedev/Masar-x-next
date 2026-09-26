import { useState, useEffect } from "react";
import Image from "next/image";
import { Shield, LogOut, LogIn, UserPlus } from "lucide-react";

interface UserMenuProps {
  isMounted: boolean;
  loading: boolean;
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  } | null;
  profile?: { avatarUrl?: string | null } | null;
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
  profile,
  isAdmin,
  isAdminLoading,
  handleNavigate,
  handleSignOut,
  tNav,
}: UserMenuProps) {
  const avatarUrl =
    profile?.avatarUrl || user?.user_metadata?.avatar_url || null;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const fullName = user?.user_metadata?.full_name;
  const email = user?.email;
  const initial = (fullName || email || "?").trim().charAt(0).toUpperCase();

  if (!isMounted || loading) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-9 w-20 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-9 w-20 rounded-lg bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-1 xl:gap-2 shrink-0">
        {!isAdminLoading && isAdmin && (
          <button
            onClick={() => handleNavigate("admin-dashboard")}
            className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap text-brand-orange hover:bg-slate-100/70 dark:hover:bg-white/5 border border-transparent hover:border-brand-orange/20 transition-all shadow-sm hover:shadow-md"
            type="button"
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>Admin</span>
          </button>
        )}
        <button
          onClick={() => handleNavigate("profile")}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all shadow-sm hover:shadow-md"
          type="button"
        >
          {avatarUrl && !imgError ? (
            <Image
              src={avatarUrl}
              alt=""
              fill
              unoptimized
              sizes="36px"
              className="object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white"
            >
              {initial}
            </span>
          )}
          <span className="sr-only">{tNav("profile")}</span>
        </button>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-red-600 hover:bg-red-50/70 dark:hover:bg-white/5 transition-colors"
          type="button"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>{tNav("logout")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 xl:gap-2 shrink-0">
      <button
        onClick={() => handleNavigate("login")}
        className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
        type="button"
      >
        <LogIn className="w-4 h-4 shrink-0" />
        <span>{tNav("login")}</span>
      </button>
      <button
        onClick={() => handleNavigate("signup")}
        className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap bg-brand-blue text-white hover:opacity-90 transition-opacity"
        type="button"
      >
        <UserPlus className="w-4 h-4 shrink-0" />
        <span>{tNav("signup")}</span>
      </button>
    </div>
  );
}
