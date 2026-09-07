import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Bot, Sparkles } from "lucide-react";
import {
  ASSISTANT_HEADER,
  ASSISTANT_AVATAR,
  ASSISTANT_TITLE,
  ASSISTANT_CONTROLS_CONTAINER,
} from "@/constants/assistantUIStyles";

interface AssistantHeaderProps {
  title: string;
  isOnline?: boolean;
  subtitle?: string;
  children?: ReactNode;
}

export function AssistantHeader({
  title,
  isOnline = true,
  subtitle,
  children,
}: AssistantHeaderProps) {
  const t = useTranslations("assistant");
  const tAi = useTranslations("aiAssistant");
  const defaultSubtitle = subtitle ?? (isOnline ? t("onlineReady") : t("offline"));
  return (
    <div className={ASSISTANT_HEADER.container}>
      <div className={ASSISTANT_HEADER.leftSection}>
        <div className={ASSISTANT_AVATAR.container}>
          <Bot className={ASSISTANT_AVATAR.icon} />
        </div>

        {/* Title & Status */}
        <div className={ASSISTANT_TITLE.container}>
          {/* Main Title */}
          <h1 className={ASSISTANT_TITLE.heading}>{title}</h1>

          {/* MVP: "Coming Soon" badge — surfaces the under-development status
              to students without disabling the page or breaking the UI.
              The chat flow stays read-only / disabled upstream in
              apps/web/src/app/[locale]/ai-assistant/page.tsx. */}
          <span
            title={tAi("comingSoonTooltip")}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            aria-label={tAi("comingSoonTooltip")}
          >
            <Sparkles className="h-3 w-3" />
            {tAi("comingSoonBadge")}
          </span>

          {/* Status Badge */}
          <div className={ASSISTANT_TITLE.statusBadge}>
            {/* Online Indicator */}
            {isOnline && (
              <span className="relative flex h-2 w-2">
                <span className={ASSISTANT_TITLE.statusDot}></span>
                <span className={ASSISTANT_TITLE.statusDotStatic}></span>
              </span>
            )}
            <span className={ASSISTANT_TITLE.statusText}>{defaultSubtitle}</span>
          </div>
        </div>
      </div>

      {children && (
        <div className={ASSISTANT_CONTROLS_CONTAINER.wrapper}>{children}</div>
      )}
    </div>
  );
}

export default AssistantHeader;
