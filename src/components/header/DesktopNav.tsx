interface NavItem {
  key: string;
  page: string;
  label: string;
  isActive: () => boolean;
  activeText: string;
  activeUnderline: string;
}

interface DesktopNavProps {
  primaryNavItems: readonly NavItem[];
  handleNavigate: (page: string) => void;
  isTRWVisible: boolean;
  currentPage: string;
}

export function DesktopNav({
  primaryNavItems,
  handleNavigate,
  isTRWVisible,
  currentPage,
}: DesktopNavProps) {
  return (
    <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-2 xl:px-3">
      <nav className="flex items-center justify-center gap-2 xl:gap-4 min-w-0 flex-nowrap">
        {primaryNavItems.map((item) => {
          const active = item.isActive();
          return (
            <button
              key={item.key}
              onClick={() => handleNavigate(item.page)}
              aria-current={active ? "page" : undefined}
              className={`relative px-2 xl:px-3 py-2 rounded-[6px] text-[13px] xl:text-[14px] font-medium whitespace-nowrap tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] ${
                active
                  ? `${item.activeText} font-semibold`
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              } hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.96]`}
              type="button"
            >
              {item.label}
              {active && (
                <span className={`absolute left-2 right-2 -bottom-0.5 h-0.5 rounded-full ${item.activeUnderline}`} />
              )}
            </button>
          );
        })}

        {isTRWVisible && (
          <button
            onClick={() => handleNavigate("non-academic")}
            className={`relative px-2 xl:px-3 py-2 rounded-[6px] text-[13px] xl:text-[14px] font-medium whitespace-nowrap tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.96] ${
              currentPage === "non-academic"
                ? "text-slate-900 dark:text-slate-100 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
            type="button"
          >
            <span>The Real World</span>
            {currentPage === "non-academic" && (
              <span className="absolute left-2 right-2 -bottom-0.5 h-0.5 rounded-full bg-slate-900 dark:bg-slate-100" />
            )}
          </button>
        )}
      </nav>
    </div>
  );
}
