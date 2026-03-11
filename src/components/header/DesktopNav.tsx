interface NavItem {
  key: string;
  page: string;
  label: string;
  isActive: () => boolean;
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
              currentPage === "non-academic"
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
  );
}
