export const ASSISTANT_HEADER = {
  container:
    "bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl p-4 sm:p-5 mb-4 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between shrink-0 z-10 sticky top-0",
  leftSection: "flex items-center gap-4",
  rightSection: "flex items-center gap-1 sm:gap-2",
};

export const ASSISTANT_AVATAR = {
  container:
    "w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20",
  icon: "w-5 h-5 sm:w-6 sm:h-6 text-white",
};

export const ASSISTANT_TITLE = {
  container: "flex flex-col",
  heading:
    "text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight",
  statusBadge: "flex items-center gap-2 mt-0.5",
  statusDot:
    "relative flex h-2 w-2 animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75",
  statusDotStatic: "relative inline-flex rounded-full h-2 w-2 bg-green-500",
  statusText:
    "text-xs font-medium text-slate-500 dark:text-slate-400 ml-1",
};

export const ASSISTANT_CONTROLS_CONTAINER = {
  wrapper:
    "flex items-center gap-1 sm:gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50",
};

export const ASSISTANT_MODE_BUTTON = {
  base: "px-3 py-1.5 text-xs font-bold rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 hover:shadow-sm",
  icon: "sm:hidden flex items-center justify-center",
  iconSvg: "w-4 h-4",
  text: "hidden sm:inline",
};

export const ASSISTANT_SELECT = {
  wrapper: "flex items-center gap-2 px-2",
  input:
    "px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200",
  disabled: "disabled:opacity-60",
};

export const ASSISTANT_ACTION_BUTTONS = {
  startExam:
    "px-3 py-1.5 text-xs font-extrabold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors",
  divider: "w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block",
  summarize:
    "p-2 rounded-xl transition-all text-slate-300 disabled:opacity-50",
  summarizeIcon: "w-4 h-4 sm:w-5 sm:h-5",
  delete:
    "p-2 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all",
  deleteIcon: "w-4 h-4 sm:w-5 sm:h-5",
};

export const ASSISTANT_STATUS_INDICATOR = {
  onlineBadge: "flex items-center gap-2 px-2",
  dot: "h-2 w-2",
  dotPinging: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75",
  dotStatic: "relative inline-flex rounded-full h-2 w-2 bg-green-500",
};

export const ASSISTANT_COLORS = {
  primary: {
    light: "from-indigo-500 to-blue-600",
    shadow: "shadow-indigo-500/20",
    text: "text-indigo-600",
    hover: "hover:text-indigo-600",
  },
  success: {
    bg: "bg-green-500",
    text: "text-green-500",
    light: "bg-green-400",
  },
  danger: {
    text: "text-red-500",
    bg: "bg-red-50",
  },
};

export const ASSISTANT_ANIMATIONS = {
  smoothTransition: "transition-all duration-200",
  hoverScale: "hover:scale-105",
  activeScale: "active:scale-95",
};

export const ASSISTANT_RESPONSIVE = {
  mobileHide: "sm:hidden",
  desktopHide: "hidden sm:inline",
  mobileSmall: "sm:p-5",
  mobileText: "text-lg sm:text-xl",
};
